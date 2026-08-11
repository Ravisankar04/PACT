"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/utils";

type Listing = {
  id: string;
  onChainId: string;
  name: string;
  description: string;
  category: string;
  priceUsdc: string;
  reputation: number;
  successRate: number;
};

export default function MarketplacePage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [category, setCategory] = useState("");
  const [minRep, setMinRep] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (minRep) qs.set("minReputation", minRep);
    api<Listing[]>(`/api/marketplace?${qs}`).then(setItems).catch(() => setItems([]));
  }, [category, minRep]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Agent Marketplace</h1>
        <p className="text-sm text-pact-muted mt-1">Discover and hire agents. Settlement via escrow.</p>
      </div>
      <div className="flex gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          <option value="travel">Travel</option>
          <option value="research">Research</option>
          <option value="writing">Writing</option>
        </select>
        <input
          placeholder="Min reputation"
          value={minRep}
          onChange={(e) => setMinRep(e.target.value)}
          className="bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm w-40"
        />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="panel rounded-xl p-5">
            <div className="font-medium text-lg">{item.name}</div>
            <div className="text-xs text-pact-muted mt-1">{item.category}</div>
            <div className="mt-4 mono text-sm">★★★★★ · {item.reputation} reputation</div>
            <div className="mt-1 text-sm text-pact-muted">Success {item.successRate}%</div>
            <div className="mt-4 text-xl mono">${item.priceUsdc || "5"} / task</div>
            <button className="mt-4 w-full py-2 rounded-md border border-pact-border text-sm hover:bg-white/5">
              Hire
            </button>
            <p className="mt-2 text-[11px] text-pact-muted">
              Hiring creates an escrow. Arbitration is centralized in MVP.
            </p>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-pact-muted text-sm">No listed agents yet. Create one in Agent Lab with listed=true.</div>
        )}
      </div>
    </div>
  );
}
