# PACT — Autonomous Agent Accountability Protocol

> A blockchain protocol that allows AI agents to autonomously transact and hire services while enforcing cryptographic spending policies, escrow, delegated authorization, and verifiable accountability on-chain.

**Give AI agents money. Give them rules.**

## Portfolio highlights

- Programmable agent wallets (AgentVault)
- EIP-712 delegated authorization
- On-chain spending policies (PolicyManager)
- Agent-to-agent escrow
- Blockchain event indexing (BullMQ worker + PostgreSQL)
- Reputation system from verifiable events
- AI agent execution with strict tools
- Evidence-backed AI investigation
- Real-time transaction monitoring (WebSocket)
- Smart-contract security (OZ, ReentrancyGuard, SafeERC20, Pausable)

## Problem

Giving an AI agent a hot wallet private key is reckless. Agents need capital to act, but humans need hard limits, auditability, and cryptographic enforcement — not soft prompts.

## Why blockchain

The smart contract is the source of truth for funds, authorization, policy, escrow, and settlement. The backend indexes and serves UX; it never bypasses on-chain authorization.

```text
USER → PACT VAULT → POLICY → AI AGENT → AUTHORIZED ACTION → SMART CONTRACT → BLOCKCHAIN
```

## Monorepo

```text
apps/web       Next.js + wagmi + RainbowKit
apps/api       Fastify API + WebSocket activity
apps/worker    BullMQ indexer / webhooks / reputation
packages/sdk   PactAgent EIP-712 client
packages/ai    Tool permissions + TravelBot + investigate
packages/database  Prisma + PostgreSQL
packages/shared    Shared types
contracts/     Foundry Solidity
```

## Quick start (local)

### Prerequisites

- Node 20+
- pnpm
- Foundry (`forge`, `anvil`, `cast`)
- Docker (Postgres + Redis)

### 1. Install

```bash
pnpm install
cp .env.example .env
```

### 2. Infrastructure

```bash
docker compose up -d
pnpm db:push
```

### 3. Contracts

```bash
# terminal A
anvil --chain-id 31337

# terminal B
cd contracts
forge test -vv
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Copy addresses from `contracts/deployments/local.json` into `.env` / `apps/web/.env.local`.

### 4. Run apps

```bash
pnpm --filter @pact/api dev
pnpm --filter @pact/worker dev
pnpm --filter @pact/web dev
```

### 5. Demo

```bash
curl -X POST http://localhost:4000/api/demo/travelbot
```

This registers TravelBot, funds $200, purchases a $37.42 flight on-chain, and shows a $80 policy rejection.

## Documentation

See `docs/` for architecture, contracts, authorization, security, SDK, AI, and deployment.

## Frontend wallet UX

The UI uses **wagmi + viem** with an injected wallet connector (MetaMask / Rabby / etc.).
RainbowKit is listed as a dependency for the intended wallet UX; the production build currently
uses a lean wagmi `ConnectButton` because recent `@wagmi/connectors` + Coinbase CDP transitive
deps (`@x402/*`) break Next.js webpack resolution. Re-enable RainbowKit once those peer deps
are publish-stable, or pin an older connectors release.
## Known limitations

- Arbitration is centralized (MVP) — clearly labeled in UI
- Local Anvil / testnet only by default
- AI TravelBot has a deterministic demo path when no LLM key is set
- Empty allow-lists mean “allow all” for targets/functions/tokens (set lists in production)

## License

MIT
