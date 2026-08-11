import {
  createPublicClient,
  http,
  type Address,
  type Hex,
  getContract,
  parseAbi,
} from "viem";
import { foundry } from "viem/chains";
import { formatUsdc, parseUsdc, type PolicySimulationResult } from "@pact/shared";

export function getChainId() {
  return Number(process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
}

export function getAddresses() {
  return {
    mockUsdc: (process.env.MOCK_USDC_ADDRESS ?? process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS) as Address,
    agentRegistry: (process.env.AGENT_REGISTRY_ADDRESS ??
      process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS) as Address,
    policyManager: (process.env.POLICY_MANAGER_ADDRESS ??
      process.env.NEXT_PUBLIC_POLICY_MANAGER_ADDRESS) as Address,
    agentVault: (process.env.AGENT_VAULT_ADDRESS ?? process.env.NEXT_PUBLIC_AGENT_VAULT_ADDRESS) as Address,
    escrow: (process.env.ESCROW_ADDRESS ?? process.env.NEXT_PUBLIC_ESCROW_ADDRESS) as Address,
    reputationRegistry: (process.env.REPUTATION_REGISTRY_ADDRESS ??
      process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS) as Address,
    mockFlightProvider: (process.env.MOCK_FLIGHT_PROVIDER_ADDRESS ??
      process.env.NEXT_PUBLIC_MOCK_FLIGHT_PROVIDER_ADDRESS) as Address,
  };
}

export function getPublicClient() {
  const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  return createPublicClient({
    chain: { ...foundry, id: getChainId() },
    transport: http(rpc),
  });
}

const policyAbi = parseAbi([
  "function simulate(uint256 policyId, address target, bytes4 functionSelector, address token, uint256 amount) view returns (bool allowed, string reason)",
  "function getPolicy(uint256 policyId) view returns ((uint256 policyId, uint256 agentId, address owner, uint256 maxTransaction, uint256 dailyLimit, uint256 lifetimeLimit, uint64 expiration, address[] allowedTargets, bytes4[] allowedFunctions, address[] allowedTokens, bool active, uint256 spentLifetime, uint256 spentToday, uint64 dayStart))",
]);

export async function simulatePolicy(input: {
  policyId: bigint;
  target: Address;
  functionSelector: Hex;
  token: Address;
  amount: string | bigint;
}): Promise<PolicySimulationResult> {
  const amount = typeof input.amount === "string" ? parseUsdc(input.amount) : input.amount;
  const client = getPublicClient();
  const addresses = getAddresses();
  if (!addresses.policyManager) {
    return { allowed: false, reason: "PolicyManager address not configured" };
  }

  const [allowed, reason] = await client.readContract({
    address: addresses.policyManager,
    abi: policyAbi,
    functionName: "simulate",
    args: [input.policyId, input.target, input.functionSelector, input.token, amount],
  });

  let maxTransaction: string | undefined;
  try {
    const policy = await client.readContract({
      address: addresses.policyManager,
      abi: policyAbi,
      functionName: "getPolicy",
      args: [input.policyId],
    });
    maxTransaction = formatUsdc(policy.maxTransaction);
  } catch {
    // ignore
  }

  return {
    allowed,
    reason: reason || (allowed ? "" : "Rejected by policy"),
    maxTransaction,
    requested: formatUsdc(amount),
  };
}
