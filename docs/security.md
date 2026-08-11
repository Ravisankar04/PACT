# Security

## Protections

- ReentrancyGuard on vault/escrow
- SafeERC20 + forceApprove pull pattern (no stranded funds on failed calls)
- AccessControl on reputation recorders
- Pausable vault
- No delegatecall
- Ownable where appropriate
- Signature replay / nonce / deadline / domain separation tests

## Threat model (MVP)

| Threat | Mitigation |
|---|---|
| Agent steals user key | Agent never holds primary key; owner signs actions |
| Policy bypass via API | API cannot move funds; only vault+policy can |
| Malicious target | Allow-listed targets/selectors; pull allowance cleared |
| Replay | Nonce + deadline + domain |
| Reputation farming | Only RECORDER_ROLE (escrow/protocol) writes scores |

## Centralized arbitration

Escrow disputes are resolved by a designated arbitrator address. Labeled in UI. Future: replace with optimistic / panel / Kleros-style modules without changing escrow accounting events.
