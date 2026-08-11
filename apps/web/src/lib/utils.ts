export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "/explorer";

export const contracts = {
  mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as `0x${string}` | undefined,
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS as `0x${string}` | undefined,
  policyManager: process.env.NEXT_PUBLIC_POLICY_MANAGER_ADDRESS as `0x${string}` | undefined,
  agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_ADDRESS as `0x${string}` | undefined,
  escrow: process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}` | undefined,
  reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS as `0x${string}` | undefined,
  mockFlightProvider: process.env.NEXT_PUBLIC_MOCK_FLIGHT_PROVIDER_ADDRESS as `0x${string}` | undefined,
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
