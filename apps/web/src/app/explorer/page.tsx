"use client";

import { useState } from "react";
import { api } from "@/lib/utils";
import Link from "next/link";

export default function ExplorerPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<any>(null);

  async function search() {
    const res = await api(`/api/explorer/search?q=${encodeURIComponent(q)}`);
    setResult(res);
  }

  return (
    <div className="min-h-screen px-8 py-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-2xl">PACT Explorer</div>
          <p className="text-sm text-pact-muted">Search decoded protocol events.</p>
        </div>
        <Link href="/app" className="text-sm text-pact-accent">
          Dashboard
        </Link>
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="transaction hash / agent / address / event"
          className="flex-1 bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm"
        />
        <button onClick={search} className="px-4 py-2 rounded-md bg-pact-accent text-black text-sm font-medium">
          Search
        </button>
      </div>
      {result && (
        <div className="panel rounded-xl p-5">
          <pre className="mono text-[11px] overflow-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
