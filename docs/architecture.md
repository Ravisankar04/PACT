# Architecture

PACT separates **authoritative chain state** from **indexed application state**.

## Layers

1. **Contracts** — AgentRegistry, PolicyManager, AgentVault, Escrow, ReputationRegistry
2. **SDK** — EIP-712 sign → submit → wait → receipt
3. **API** — REST + WebSocket; never bypasses vault authorization
4. **Worker** — BullMQ queues for indexing, webhooks, reputation, AI tasks
5. **Web** — Agent Lab, Policy Builder, Marketplace, Explorer, Investigate

## Source of truth

| Concern | Authority |
|---|---|
| Balances, policy, escrow, settlement | Blockchain |
| Search, analytics, activity feed, webhooks | PostgreSQL index |

## Data flow

Wallet signs AgentAction → AgentVault verifies → PolicyManager.enforceAndRecord → target call → ActionExecuted receipt → indexer → API/UI.
