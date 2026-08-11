# Authorization (EIP-712)

Typed data primary type: `AgentAction`

```text
agentId, policyId, target, value, token, amount, dataHash, nonce, deadline
```

Domain: `PACT AgentVault` / version `1` / chainId / verifyingContract=AgentVault

## Guarantees

- Signature must be agent **owner**
- Caller must be registered agent address or owner
- Nonce cannot be reused on success path (state update before external call; full revert on failure)
- Deadline enforced
- Domain binds chain + vault address (wrong chain / wrong contract signatures fail)
- PolicyManager is sole spend authority for vault executes
