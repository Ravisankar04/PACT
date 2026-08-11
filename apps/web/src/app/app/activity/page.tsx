"use client";

import { LiveActivity } from "@/components/LiveActivity";
import { useEffect, useState } from "react";
import { api } from "@/lib/utils";

export default function ActivityPage() {
  const [indexed, setIndexed] = useState<any[]>([]);

  useEffect(() => {
    api<{ indexed: any[] }>("/api/activity?limit=40")
      .then((d) => setIndexed(d.indexed ?? []))
      .catch(() => setIndexed([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Activity</h1>
        <p className="text-sm text-pact-muted mt-1">Realtime stream + historical indexed events.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <LiveActivity limit={20} />
        <div className="panel rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-pact-border text-sm font-medium">Indexed events</div>
          <ul className="divide-y divide-pact-border max-h-[640px] overflow-auto">
            {indexed.map((e) => (
              <li key={e.id} className="px-4 py-3 mono text-xs">
                <div className="text-pact-accent">{e.eventName}</div>
                <div className="text-pact-muted mt-1">
                  block {e.blockNumber} · {e.transactionHash?.slice(0, 12)}…
                </div>
              </li>
            ))}
            {indexed.length === 0 && (
              <li className="px-4 py-8 text-pact-muted text-sm">No indexed events yet. Start worker + Anvil.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
