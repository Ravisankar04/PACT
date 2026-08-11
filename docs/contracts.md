# Contracts

| Contract | Role |
|---|---|
| MockUSDC | 6-decimal test stablecoin |
| AgentRegistry | Agent identity + ownership |
| PolicyManager | Spending + target/function allow-lists |
| AgentVault | Deposits + EIP-712 execute |
| Escrow | Agent-to-agent locked funds |
| ReputationRegistry | Event-derived scores |
| MockFlightProvider | Demo commerce target |

Deploy with `forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast`.
