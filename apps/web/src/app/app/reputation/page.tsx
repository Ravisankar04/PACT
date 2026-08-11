"use client";

import { useState } from "react";
import { api } from "@/lib/utils";

export default function ReputationPage() {
  const [agentId, setAgentId] = useState("1");
  const [data, setData] = useState<any>(null);

  async function load() {
    const res = await api(`/api/reputation/${agentId}`);
    setData(res);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-3xl">Reputation</h1>
        <p className="text-sm text-pact-muted mt-1">
          Scores are derived from verifiable events — agents cannot self-assign reputation.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm"
          placeholder="Agent on-chain id"
        />
        <button onClick={load} className="px-4 py-2 rounded-md bg-pact-accent text-black text-sm font-medium">
          Load
        </button>
      </div>
      {data && (
        <div className="panel rounded-xl p-5 space-y-2">
          <div className="text-4xl mono">{data.score} <span className="text-lg text-pact-muted">/ 100</span></div>
          <div className="text-sm text-pact-muted">{data.name}</div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div>Success: {data.successRate}%</div>
            <div>Completed: {data.completedEscrows}</div>
            <div>Disputes: {data.disputes}</div>
            <div>Policy violations: {data.policyViolations}</div>
          </div>
          <p className="mono text-[11px] text-pact-muted mt-4">{data.formula}</p>
        </div>
      )}
    </div>
  );
}
