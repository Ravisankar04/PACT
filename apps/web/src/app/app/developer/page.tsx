"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/utils";

export default function DeveloperPage() {
  const [data, setData] = useState<any>(null);
  const [apiKey, setApiKey] = useState<any>(null);

  useEffect(() => {
    api("/api/developer").then(setData).catch(() => setData(null));
  }, []);

  async function createKey() {
    const res = await api("/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "default" }),
    });
    setApiKey(res);
  }

  async function createWebhook() {
    await api("/api/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/pact-webhook",
        events: ["agent.action.executed", "agent.action.rejected"],
      }),
    });
    alert("Webhook created (see API response / DB).");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Developer</h1>
        <p className="text-sm text-pact-muted mt-1">API keys, webhooks, SDK, contracts, ABIs.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel rounded-xl p-5 space-y-3">
          <div className="text-sm font-medium">Contract addresses</div>
          <pre className="mono text-[11px] text-pact-muted overflow-auto">
            {JSON.stringify(data?.contracts ?? {}, null, 2)}
          </pre>
          <div className="text-xs text-pact-muted">Chain ID: {data?.chainId}</div>
        </div>
        <div className="panel rounded-xl p-5 space-y-3">
          <div className="text-sm font-medium">SDK example</div>
          <pre className="mono text-[11px] text-pact-muted whitespace-pre-wrap">{data?.examples?.sdk}</pre>
          <div className="flex gap-2">
            <button onClick={createKey} className="px-3 py-2 text-sm rounded-md bg-white/10">
              Create API key
            </button>
            <button onClick={createWebhook} className="px-3 py-2 text-sm rounded-md bg-white/10">
              Create webhook
            </button>
          </div>
          {apiKey && (
            <pre className="mono text-[11px] text-pact-good whitespace-pre-wrap">
              {JSON.stringify(apiKey, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
