"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { foundry, sepolia } from "wagmi/chains";
import { useState } from "react";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

const anvil = {
  ...foundry,
  id: chainId,
  name: chainId === 31337 ? "PACT Anvil" : foundry.name,
  rpcUrls: {
    default: { http: [rpc] },
  },
} as const;

export const wagmiConfig = createConfig({
  connectors: [injected({ shimDisconnect: true })],
  chains: [anvil, sepolia],
  transports: {
    [anvil.id]: http(rpc),
    [sepolia.id]: http(),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
