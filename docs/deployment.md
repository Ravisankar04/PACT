# Deployment

## Local

1. `docker compose up -d`
2. `anvil --chain-id 31337`
3. `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`
4. Fill `.env` from `contracts/deployments/local.json`
5. `pnpm db:push`
6. Start api, worker, web

## Testnet

Set `RPC_URL`, `CHAIN_ID`, `DEPLOYER_PRIVATE_KEY`, deploy the same script, update addresses. Do not require mainnet.

## Environment

See `.env.example`. Never commit secrets. Never expose deployer keys to the frontend.
