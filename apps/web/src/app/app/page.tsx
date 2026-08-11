"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/utils";
import { LiveActivity } from "@/components/LiveActivity";

type Metrics = {
  activeAgents: number;
  capitalControlled: string;
  transactions: number;
  successfulTransactions: number;
  blockedTransactions: number;
  openEscrows: number;
  disputes: number;
};

export default function OverviewPage() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    api<Metrics>("/api/metrics").then(setM).catch(() => setM(null));
  }, []);

  const cards = [
    { label: "Active Agents", value: m?.activeAgents ?? "—" },
    { label: "Capital Controlled", value: m ? `$${m.capitalControlled}` : "—" },
    { label: "Transactions", value: m?.transactions ?? "—" },
    { label: "Successful", value: m?.successfulTransactions ?? "—" },
    { label: "Blocked", value: m?.blockedTransactions ?? "—" },
    { label: "Open Escrows", value: m?.openEscrows ?? "—" },
    { label: "Disputes", value: m?.disputes ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Overview</h1>
        <p className="text-sm text-pact-muted mt-1">Indexed protocol metrics — not mocked.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="panel rounded-lg p-4">
            <div className="text-[11px] uppercase tracking-wider text-pact-muted">{c.label}</div>
            <div className="mt-2 text-2xl font-medium mono">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <LiveActivity />
        <div className="panel rounded-xl p-5">
          <div className="text-sm font-medium mb-3">Security model</div>
          <pre className="mono text-xs text-pact-muted whitespace-pre-wrap leading-relaxed">{`USER
 ↓
PACT VAULT
 ↓
POLICY
 ↓
AI AGENT
 ↓
AUTHORIZED ACTION
 ↓
SMART CONTRACT
 ↓
BLOCKCHAIN`}</pre>
        </div>
      </div>
    </div>
  );
}
