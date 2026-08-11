export type Hex = `0x${string}`;

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
  contracts: ContractAddresses;
}

export interface ContractAddresses {
  mockUsdc: Hex;
  agentRegistry: Hex;
  policyManager: Hex;
  agentVault: Hex;
  escrow: Hex;
  reputationRegistry: Hex;
  mockFlightProvider: Hex;
}

export interface AgentActionRequest {
  agentId: string;
  policyId: string;
  target: Hex;
  value?: bigint | string;
  token: Hex;
  amount: string;
  data: Hex;
  nonce: string;
  deadline: number;
}

export interface PactReceipt {
  receiptId: Hex;
  receiptHash: Hex;
  agentId: string;
  policyId: string;
  target: Hex;
  token: Hex;
  amount: string;
  nonce: string;
  transactionHash: Hex;
  blockNumber: string;
  timestamp: number;
  status: "CONFIRMED" | "REJECTED" | "PENDING";
}

export interface PolicySimulationResult {
  allowed: boolean;
  reason: string;
  maxTransaction?: string;
  requested?: string;
  dailyRemaining?: string;
  lifetimeRemaining?: string;
}

export interface LiveActivityItem {
  id: string;
  type: string;
  agentId?: string;
  agentName?: string;
  message: string;
  amount?: string;
  status: "success" | "rejected" | "pending" | "info";
  transactionHash?: Hex;
  timestamp: string;
}

export const WEBHOOK_EVENTS = [
  "agent.action.executed",
  "agent.action.rejected",
  "escrow.created",
  "escrow.completed",
  "escrow.disputed",
  "policy.violation",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const AGENT_ACTION_TYPES = {
  AgentAction: [
    { name: "agentId", type: "uint256" },
    { name: "policyId", type: "uint256" },
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "dataHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function formatUsdc(amount: bigint | string): string {
  const v = typeof amount === "string" ? BigInt(amount) : amount;
  const whole = v / 1_000_000n;
  const frac = v % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr.length ? `${whole}.${fracStr}` : whole.toString();
}

export function parseUsdc(amount: string): bigint {
  const [w, f = ""] = amount.split(".");
  const frac = (f + "000000").slice(0, 6);
  return BigInt(w || "0") * 1_000_000n + BigInt(frac);
}
