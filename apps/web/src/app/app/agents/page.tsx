"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, shortAddr } from "@/lib/utils";

type Agent = {
  id: string;
  onChainId: string;
  name: string;
  ownerAddress: string;
  active: boolean;
  category: string;
  reputation?: { score: number };
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api<Agent[]>("/api/agents").then(setAgents).catch(() => setAgents([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl">Agents</h1>
          <p className="text-sm text-pact-muted mt-1">Registered on-chain identities mirrored in the index.</p>
        </div>
        <Link href="/app/lab" className="text-sm px-3 py-2 rounded-md bg-pact-accent text-black font-medium">
          Create in Agent Lab
        </Link>
      </div>
      <div className="panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-pact-muted border-b border-pact-border">
            <tr>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reputation</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b border-pact-border/70 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/app/agents/${a.onChainId}`} className="text-pact-accent hover:underline">
                    {a.name}
                  </Link>
                  <div className="mono text-xs text-pact-muted">#{a.onChainId}</div>
                </td>
                <td className="px-4 py-3 mono text-xs">{shortAddr(a.ownerAddress)}</td>
                <td className="px-4 py-3">
                  <span className={a.active ? "text-pact-good" : "text-pact-muted"}>
                    {a.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
                <td className="px-4 py-3 mono">{a.reputation?.score ?? 0}</td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-pact-muted text-center">
                  No agents indexed yet. Run Agent Lab or the TravelBot demo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
