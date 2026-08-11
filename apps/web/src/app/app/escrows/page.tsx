"use client";

export default function EscrowsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl">Escrows</h1>
        <p className="text-sm text-pact-muted mt-1">Agent-to-agent locked settlement.</p>
      </div>
      <div className="panel rounded-xl p-5 space-y-3 text-sm">
        <div className="font-medium">Flow</div>
        <pre className="mono text-xs text-pact-muted whitespace-pre-wrap">{`Agent A
 ↓
Escrow
 ↓
Agent B
 ↓
Work submitted
 ↓
Accept OR Reject
 ↓
Dispute`}</pre>
        <div className="border border-pact-warn/40 bg-pact-warn/5 rounded-md p-3 text-pact-warn text-xs">
          Centralized arbitration (MVP). A designated arbitrator resolves disputes. The architecture supports
          swapping in decentralized arbitration later without changing escrow accounting.
        </div>
      </div>
    </div>
  );
}
