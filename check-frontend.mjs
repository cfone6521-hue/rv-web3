import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const htmlPath = path.resolve('public/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('<script src="./config.js"></script>')) throw new Error('config.js não está carregado no frontend.');
if (!html.includes('window.RV_API_BASE')) throw new Error('Configuração de URL do backend não encontrada.');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicateIds.length) throw new Error(`IDs HTML duplicados: ${[...new Set(duplicateIds)].join(', ')}`);
const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
if (!match) throw new Error('Script principal do frontend não encontrado.');
const tmp = path.join(os.tmpdir(), `rv-web3-check-${process.pid}.js`);
try {
  fs.writeFileSync(tmp, match[1]);
  const result = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Falha na verificação JavaScript.');
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}
console.log('Verificação concluída: backend, JavaScript do frontend, config e IDs HTML.');
