import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAddress } from 'ethers';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const BINANCE_BASE = 'https://web3.binance.com/build';
const API_KEY = process.env.OC_API_KEY || '';
const SECRET_KEY = process.env.OC_SECRET_KEY || '';
const RECV_WINDOW = String(Math.min(Math.max(Number(process.env.OC_RECV_WINDOW || 5000), 1000), 60000));
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
app.use(cors({ origin(origin, callback) { if (!origin || origin === FRONTEND_ORIGIN || (!FRONTEND_ORIGIN && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) return callback(null, true); return callback(new Error('Origem não autorizada pelo backend.')); }, methods: ['GET','OPTIONS'], allowedHeaders: ['Content-Type','Accept'] }));

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '32kb', strict: true }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

function requiredCredentials() {
  if (!API_KEY || !SECRET_KEY) {
    const err = new Error('Binance Web3 API não configurada. Defina OC_API_KEY e OC_SECRET_KEY no .env.');
    err.status = 503;
    throw err;
  }
}
function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}
async function binanceRequest(method, apiPath, params = {}, bodyObj = null) {
  requiredCredentials();
  const query = method === 'GET' ? buildQuery(params) : '';
  const pathWithQuery = query ? `${apiPath}?${query}` : apiPath;
  const signedPath = `/build${pathWithQuery}`;
  const body = bodyObj === null ? '' : JSON.stringify(bodyObj);
  const timestamp = new Date().toISOString();
  const preHash = timestamp + method.toUpperCase() + signedPath + body;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(preHash, 'utf8').digest('base64');
  const url = `${BINANCE_BASE}${pathWithQuery}`;
  const headers = {
    'X-OC-APIKEY': API_KEY,
    'X-OC-TIMESTAMP': timestamp,
    'X-OC-SIGN': signature,
    'X-OC-RECV-WINDOW': RECV_WINDOW,
    'X-OC-NONCE': crypto.randomUUID(),
    'Accept': 'application/json'
  };
  if (bodyObj !== null) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method,
    headers,
    body: bodyObj === null ? undefined : body,
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(data?.msg || `Binance API respondeu HTTP ${response.status}`);
    err.status = response.status === 429 ? 429 : 502;
    throw err;
  }
  // A Binance pode retornar HTTP 200 para erros de negócio; valide também data.code.
  if (data && typeof data.code === 'number' && data.code !== 0) {
    const err = new Error(data.msg || `Binance API code ${data.code}`);
    err.status = data.code === 42900 ? 429 : (data.code >= 40100 && data.code <= 40199 ? 502 : 400);
    throw err;
  }
  return data;
}
function validateAddress(value) {
  if (typeof value !== 'string' || !isAddress(value)) {
    const err = new Error('Endereço EVM inválido.');
    err.status = 400;
    throw err;
  }
  return value;
}
function validateChainId(value) {
  const supported = new Set(['1', '56', '137', '42161', '8453']);
  const chainId = String(value || '');
  if (!supported.has(chainId)) {
    const err = new Error('chainId inválido. Use 1, 56, 137, 42161 ou 8453.');
    err.status = 400;
    throw err;
  }
  return chainId;
}
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'RV.Web3 API',
    binanceConfigured: Boolean(API_KEY && SECRET_KEY),
    supportedEvmChains: [1, 56, 137, 42161, 8453]
  });
});

app.get('/api/binance/chains', asyncRoute(async (_req, res) => {
  const result = await binanceRequest('GET', '/api/v1/dex/balance/supported/chain');
  res.json(result);
}));

app.get('/api/binance/balances', asyncRoute(async (req, res) => {
  const address = validateAddress(req.query.address);
  const chainId = validateChainId(req.query.chainId);
  const result = await binanceRequest('GET', '/api/v1/dex/balance/all-token-balances-by-address', {
    address,
    chains: chainId,
    excludeRiskToken: 'true',
    page: '1',
    pageSize: '100'
  });
  res.json(result);
}));

app.get('/api/binance/transactions', asyncRoute(async (req, res) => {
  const address = validateAddress(req.query.address);
  const chains = validateChainId(req.query.chains);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 100);
  const result = await binanceRequest('GET', '/api/v1/dex/post-transaction/transactions-by-address', {
    address,
    chains,
    limit
  });
  res.json(result);
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint de API não encontrado.' }));
app.use((err, _req, res, _next) => {
  if (err.message === 'Origem não autorizada pelo backend.') return res.status(403).json({ error: err.message });
  const status = Number(err.status) || 500;
  if (status >= 500) console.error('[API]', err.message);
  res.status(status).json({ error: status >= 500 ? err.message : err.message });
});

app.listen(PORT, () => {
  console.log(`RV.Web3 disponível em http://localhost:${PORT}`);
  if (!API_KEY || !SECRET_KEY) console.warn('Binance Web3 API não configurada: preencha OC_API_KEY e OC_SECRET_KEY no .env');
});