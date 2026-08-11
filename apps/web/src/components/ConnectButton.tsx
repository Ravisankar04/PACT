"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { shortAddr } from "@/lib/utils";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const target = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {chainId !== target && (
          <button
            onClick={() => switchChain?.({ chainId: target })}
            className="text-xs px-2 py-1 rounded border border-pact-warn text-pact-warn"
          >
            Switch chain
          </button>
        )}
        <span className="mono text-xs text-pact-muted">{shortAddr(address)}</span>
        <button
          onClick={() => disconnect()}
          className="text-xs px-3 py-1.5 rounded-md border border-pact-border hover:bg-white/5"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      disabled={isPending}
      onClick={() => connect({ connector: connectors[0] })}
      className="text-sm px-3 py-1.5 rounded-md bg-pact-accent text-black font-medium disabled:opacity-50"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
