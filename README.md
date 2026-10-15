# RV.Web3 — Carteira Multi-Rede + Binance Web3 API

Projeto inicial funcional com frontend HTML/CSS/JS e backend Node.js. Mantém o tema escuro, verde e dourado do RV.Web3.

## O que inclui
- Frontend responsivo para Ethereum, BNB Smart Chain, Polygon, Arbitrum e Base.
- Conexão EIP-1193 (por exemplo, MetaMask ou navegador DApp compatível).
- Geração/importação de carteira local com ethers v6, incluindo backup JSON cifrado por senha e restauração local. A carteira local só existe na memória até você salvar o backup.
- Consulta de saldo nativo por RPC público e envio de ativo nativo com estimativa de gas antes da assinatura.
- Backend que assina chamadas Binance Web3 API no servidor usando `OC_API_KEY` e `OC_SECRET_KEY`.
- Consulta Binance de ativos e histórico de transações por endereço.
- Validação de endereço EVM, limitação de chamadas e cabeçalhos de segurança.

## Requisitos
- Node.js 20 ou superior.
- Credenciais habilitadas para Binance Web3 API no portal oficial.
- Hospedagem HTTPS para produção.

## Instalação
1. Extraia o ZIP.
2. Na pasta do projeto, instale dependências:
   ```bash
   npm install
   ```
3. Copie `.env.example` para `.env`.
4. Preencha `OC_API_KEY` e `OC_SECRET_KEY` no `.env`. Não compartilhe nem faça commit desse arquivo.
5. Se usar GitHub Pages para o frontend, implante o backend em um serviço Node.js com HTTPS. Configure `FRONTEND_ORIGIN` com a origem exata do site (por exemplo, `https://seu-usuario.github.io`) e ajuste `public/config.js` para `window.RV_API_BASE = 'https://URL-HTTPS-DO-BACKEND';`. O GitHub Pages não executa `server.js` e não pode guardar as chaves secretas.
6. Inicie:
   ```bash
   npm start
   ```
7. Rode `npm run check` para verificar sintaxe e IDs do frontend.
8. Abra `http://localhost:3000`.

## Publicar frontend no GitHub Pages
1. Envie os arquivos do projeto para um repositório GitHub, incluindo `.github/workflows/pages.yml`.
2. Em Settings → Pages, selecione GitHub Actions como fonte de implantação.
3. Antes de publicar, edite `public/config.js` e defina `window.RV_API_BASE` para a URL HTTPS do backend. O workflow publica somente a pasta `public`; ele não publica nem executa o backend.
4. No backend, configure `FRONTEND_ORIGIN` com a origem exata do site. Exemplo de formato: `https://SEU-USUARIO.github.io` (sem caminho de repositório, salvo se a configuração exigir origem diferente; origem não inclui caminho).

## Endpoints do backend
- `GET /api/health` — estado do servidor e se as credenciais foram configuradas (não revela as credenciais).
- `GET /api/binance/chains` — redes suportadas pela Wallet API.
- `GET /api/binance/balances?address=0x...&chainId=1` — saldos de tokens para uma rede por chamada.
- `GET /api/binance/transactions?address=0x...&chains=1&limit=10` — histórico recente conforme disponibilidade da API.

Chain IDs usados no painel: Ethereum `1`, BNB Smart Chain `56`, Polygon `137`, Arbitrum `42161`, Base `8453`. A Binance Wallet API mantém sua própria lista dinâmica de redes suportadas; a seleção no frontend não garante que todos os endpoints tenham dados para cada rede.

## Limites conhecidos
- O envio nesta versão é para o ativo nativo da rede selecionada; envio de ERC-20, swap, staking e bridge não estão implementados.
- WalletConnect ainda não está configurado; exige SDK e um Project ID próprio. As carteiras injetadas compatíveis com EIP-1193 podem conectar diretamente.
- A verificação `npm run check` valida sintaxe/estrutura, não substitui testes com credenciais Binance reais nem auditoria de segurança.

## Segurança — leia antes de usar fundos reais
- A API Secret fica somente no backend no `.env`; não a coloque no HTML, JavaScript público, GitHub Pages ou repositório.
- Nunca solicite ao usuário a frase de recuperação para conectar uma carteira externa. A conexão externa usa o provedor da carteira e pede consentimento.
- O modo “criar/importar local” mantém a carteira em memória durante a sessão. Use o botão de backup para baixar um JSON cifrado com senha e teste a restauração antes de depender dele. O arquivo e a senha são necessários; guarde-os separadamente. Este projeto não foi auditado e não é recomendado para grandes valores.
- Não use uma carteira com fundos relevantes antes de auditoria de segurança e testes em testnet. Não existe recuperação de fundos se a frase for perdida.
- Transações são assinadas pela carteira local em memória ou pela carteira externa. A Binance Web3 Wallet API aqui é usada para leitura de saldos/histórico, não para assinar transações.
- O endpoint de histórico da Binance informa dados on-chain dentro dos limites definidos pela própria API; confirme transações no explorador oficial da rede.
- O saldo USD não é estimado pelo frontend quando a API não fornece preço confiável para o ativo.

## Observações de produção
- Configure HTTPS, CORS restrito se separar frontend/backend, logs sem dados secretos, monitoramento, gestão de rate limits e proteção adicional contra abuso.
- Se hospedar frontend e backend em domínios diferentes, ajuste a arquitetura de origem/CORS explicitamente; não habilite CORS irrestrito.
- Consulte a documentação oficial antes de produção, pois rotas, redes, permissões e limites podem mudar.

## Backup e recuperação
- Carteira local: a seção Criar/Importar permite exportar um JSON cifrado por senha e restaurá-lo posteriormente. O site não envia a carteira ao backend.
- Carteira externa: faça backup pelo aplicativo oficial da carteira; o site não pode exportar sua chave privada.
- Nunca faça commit de `.env`, backups, frases de recuperação ou chaves privadas.

Documentação:
- Wallet API: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/wallet-api
- Authentication: https://web3.binance.com/en/dev-docs/authentication
- Error codes: https://web3.binance.com/en/dev-docs/products/wallet-api/error-codes
