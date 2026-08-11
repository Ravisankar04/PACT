"use client";

import { contracts } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-pact-muted mt-1">Network configuration from environment variables.</p>
      </div>
      <div className="panel rounded-xl p-5 mono text-xs space-y-2">
        <div>CHAIN_ID: {process.env.NEXT_PUBLIC_CHAIN_ID}</div>
        <div>RPC: {process.env.NEXT_PUBLIC_RPC_URL}</div>
        <div>API: {process.env.NEXT_PUBLIC_API_URL}</div>
        <div className="pt-3 text-pact-muted">Contracts</div>
        {Object.entries(contracts).map(([k, v]) => (
          <div key={k}>
            {k}: {v ?? "(unset)"}
          </div>
        ))}
      </div>
    </div>
  );
}
