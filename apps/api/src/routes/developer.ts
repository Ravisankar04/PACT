import type { FastifyInstance } from "fastify";
import { getAddresses, getChainId } from "../lib/chain.js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export async function developerRoutes(app: FastifyInstance) {
  app.get("/developer", async () => {
    const addresses = getAddresses();
    let abi: unknown = null;
    const abiPath = resolve(process.cwd(), "../../contracts/out/AgentVault.sol/AgentVault.json");
    if (existsSync(abiPath)) {
      try {
        const json = JSON.parse(readFileSync(abiPath, "utf8"));
        abi = json.abi;
      } catch {
        abi = null;
      }
    }

    return {
      chainId: getChainId(),
      rpcUrl: process.env.RPC_URL,
      contracts: addresses,
      abiPreview: Array.isArray(abi) ? abi.slice(0, 15) : null,
      examples: {
        execute: `const result = await pact.agents.execute({
  target: "${addresses.mockFlightProvider ?? "0x..."}",
  amount: "37.42",
  action: { signature: "purchaseFlight(string,uint256)", args: ["AA100", 37420000n] }
})`,
        sdk: `import { PactAgent } from "@pact/sdk";

const agent = new PactAgent({ wallet, policy, vaultAddress, agentId, policyId, token, chainId });
await agent.execute({ target, amount: "37.42", data });`,
      },
      webhooks: {
        events: [
          "agent.action.executed",
          "agent.action.rejected",
          "escrow.created",
          "escrow.completed",
          "escrow.disputed",
          "policy.violation",
        ],
        signing: "HMAC-SHA256 over raw JSON body; header X-PACT-Signature",
      },
    };
  });
}
