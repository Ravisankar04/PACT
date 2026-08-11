"use client";

import { useState } from "react";
import { api, contracts } from "@/lib/utils";

export default function InvestigatePage() {
  const [question, setQuestion] = useState("Why was this transaction rejected?");
  const [agentId, setAgentId] = useState("1");
  const [policyId, setPolicyId] = useState("1");
  const [amount, setAmount] = useState("80");
  const [result, setResult] = useState<any>(null);

  async function run() {
    const res = await api("/api/investigations", {
      method: "POST",
      body: JSON.stringify({
        question,
        agentId,
        policyId,
        amount,
        target: contracts.mockFlightProvider,
        token: contracts.mockUsdc,
      }),
    });
    setResult(res);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl">Investigate</h1>
        <p className="text-sm text-pact-muted mt-1">
          Evidence-backed analysis from policy simulation and indexed events. No invented chain data.
        </p>
      </div>
      <div className="panel rounded-xl p-5 space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm min-h-24"
        />
        <div className="grid grid-cols-3 gap-2">
          <input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Agent id" className="bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm" />
          <input value={policyId} onChange={(e) => setPolicyId(e.target.value)} placeholder="Policy id" className="bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm" />
        </div>
        <button onClick={run} className="px-4 py-2 rounded-md bg-pact-accent text-black text-sm font-medium">
          Analyze
        </button>
      </div>
      {result && (
        <pre className="panel rounded-xl p-5 mono text-xs whitespace-pre-wrap leading-relaxed">
          {result.analysis}
        </pre>
      )}
    </div>
  );
}
