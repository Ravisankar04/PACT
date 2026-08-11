# Agent SDK

```ts
import { PactAgent } from "@pact/sdk";

const agent = new PactAgent({
  publicClient,
  walletClient,
  vaultAddress,
  agentId,
  policyId,
  token,
  chainId,
});

const receipt = await agent.execute({
  target,
  amount: "37.42",
  data,
});
```

Flow: validate → EIP-712 sign → submit → wait → receipt.
