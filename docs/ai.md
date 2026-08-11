# AI Architecture

## Safety

The LLM never receives:

- private keys / seeds
- unrestricted wallet signing
- arbitrary contract execution

Financial tools (`executePayment`, `createEscrow`) must pass `checkPolicy` which calls on-chain `PolicyManager.simulate` / vault execute.

## TravelBot demo

Deterministic path without an API key:

1. searchServices
2. select cheapest ($37.42)
3. executePayment → on-chain success
4. attempt $80 → rejected by policy

## Investigate

Uses indexed events + policy simulation only. Will refuse to invent chain data when evidence is missing.
