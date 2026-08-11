"use client";

import { useEffect, useState } from "react";
import type { LiveActivityItem } from "@pact/shared";
import { WS_URL, api } from "@/lib/utils";

export function LiveActivity({ limit = 12 }: { limit?: number }) {
  const [items, setItems] = useState<LiveActivityItem[]>([]);

  useEffect(() => {
    api<{ live: LiveActivityItem[] }>(`/api/activity?limit=${limit}`)
      .then((d) => setItems(d.live ?? []))
      .catch(() => undefined);

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "activity" && msg.item) {
          setItems((prev) => [msg.item, ...prev].slice(0, limit));
        }
      };
    } catch {
      // ignore
    }
    return () => ws?.close();
  }, [limit]);

  return (
    <div className="panel rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-pact-border flex items-center justify-between">
        <div className="text-sm font-medium">Live agent activity</div>
        <div className="flex items-center gap-2 text-xs text-pact-good mono">
          <span className="h-1.5 w-1.5 rounded-full bg-pact-good animate-pulse" />
          LIVE
        </div>
      </div>
      <ul className="divide-y divide-pact-border">
        {items.length === 0 && (
          <li className="px-4 py-8 text-sm text-pact-muted">Waiting for indexed / streamed events…</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3 flex items-start gap-3">
            <span
              className={`mt-1.5 h-2 w-2 rounded-full ${
                item.status === "rejected"
                  ? "bg-pact-bad"
                  : item.status === "success"
                    ? "bg-pact-good"
                    : "bg-pact-accent"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <span className="text-pact-text">{item.agentName ?? "Agent"}</span>{" "}
                <span className="text-pact-muted">{item.message}</span>
              </div>
              <div className="mono text-xs text-pact-muted mt-1">
                {item.amount ? `$${item.amount}` : item.type}
                {item.transactionHash ? ` · ${item.transactionHash.slice(0, 10)}…` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
