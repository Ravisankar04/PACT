"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, shortAddr } from "@/lib/utils";

export default function TxDetailPage() {
  const params = useParams<{ hash: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!params.hash) return;
    api(`/api/explorer/search?q=${params.hash}`).then(setData).catch(() => setData(null));
  }, [params.hash]);

  const action = data?.actions?.[0];
  const event = data?.events?.[0];

  return (
    <div className="min-h-screen px-8 py-10 max-w-3xl mx-auto space-y-6">
      <h1 className="font-display text-3xl">Transaction</h1>
      <div className="panel rounded-xl p-5 space-y-3 text-sm">
        <Row label="Status" value={action?.status ?? (event ? "INDEXED" : "UNKNOWN")} />
        <Row label="Agent" value={action?.agent?.name ?? "—"} />
        <Row label="Amount" value={action ? `$${action.amount}` : "—"} />
        <Row label="Target" value={shortAddr(action?.target)} />
        <Row label="Authorization" value={action?.status === "CONFIRMED" ? "VALID" : action?.status ?? "—"} />
        <Row label="Block" value={action?.blockNumber ?? event?.blockNumber ?? "—"} />
        <Row label="Transaction" value={params.hash} />
        <a
          className="text-pact-accent text-xs mono"
          href={`#`}
          onClick={(e) => e.preventDefault()}
        >
          Explorer link uses configured network (local PACT explorer)
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-pact-border/60 pb-2">
      <span className="text-pact-muted">{label}</span>
      <span className="mono text-right break-all">{value}</span>
    </div>
  );
}
