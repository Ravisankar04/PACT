"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, shortAddr } from "@/lib/utils";
import { LiveActivity } from "@/components/LiveActivity";
import { formatUsdc } from "@pact/shared";

function formatMaybe(v: string | undefined) {
  if (!v) return "—";
  try {
    return `$${formatUsdc(v)}`;
  } catch {
    return v;
  }
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    if (!params.id) return;
    api(`/api/agents/${params.id}`).then(setAgent).catch(() => setAgent(null));
  }, [params.id]);

  if (!agent) {
    return <div className="text-pact-muted">Loading agent…</div>;
  }

  const policy = agent.policies?.[0];
  const rep = agent.reputation;
  const successTotal = (rep?.successfulTasks ?? 0) + (rep?.failedTasks ?? 0);
  const success = successTotal ? ((rep.successfulTasks / successTotal) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-pact-muted mono">AGENT #{agent.onChainId}</div>
        <h1 className="font-display text-3xl mt-1">{agent.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span className="text-pact-good">Status: {agent.active ? "ACTIVE" : "INACTIVE"}</span>
          <span className="text-pact-muted">Owner: <span className="mono text-pact-text">{shortAddr(agent.ownerAddress)}</span></span>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        {[
          { l: "Reputation", v: rep?.score ?? 0 },
          { l: "Success", v: success === "—" ? "—" : `${success}%` },
          { l: "Transactions", v: successTotal || agent.actions?.length || 0 },
          { l: "Policy violations", v: rep?.policyViolations ?? 0 },
        ].map((x) => (
          <div key={x.l} className="panel rounded-lg p-4">
            <div className="text-[11px] text-pact-muted uppercase tracking-wider">{x.l}</div>
            <div className="text-2xl mono mt-1">{x.v}</div>
          </div>
        ))}
      </div>

      {policy && (
        <div className="panel rounded-xl p-5">
          <div className="text-sm font-medium mb-3">POLICY #{policy.onChainId}</div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-pact-muted">Max transaction</div>
              <div className="mono">{formatMaybe(policy.maxTransaction)}</div>
            </div>
            <div>
              <div className="text-pact-muted">Daily</div>
              <div className="mono">{formatMaybe(policy.dailyLimit)}</div>
            </div>
            <div>
              <div className="text-pact-muted">Lifetime</div>
              <div className="mono">{formatMaybe(policy.lifetimeLimit)}</div>
            </div>
          </div>
        </div>
      )}

      <LiveActivity />
    </div>
  );
}
