"use client";

import { useMemo, useState } from "react";
import { contracts, api } from "@/lib/utils";

export default function PolicyBuilderPage() {
  const [maxTx, setMaxTx] = useState(50);
  const [daily, setDaily] = useState(100);
  const [lifetime, setLifetime] = useState(500);
  const [days, setDays] = useState(7);
  const [flights, setFlights] = useState(true);
  const [hotels, setHotels] = useState(true);
  const [transport, setTransport] = useState(true);
  const [simAmount, setSimAmount] = useState("80");
  const [simResult, setSimResult] = useState<any>(null);
  const [policyId, setPolicyId] = useState("");

  const preview = useMemo(() => {
    const allows = [
      flights && "Flight booking",
      hotels && "Hotel booking",
      transport && "Transport",
    ].filter(Boolean) as string[];
    const blocks = [
      "Arbitrary transfers",
      "Unknown contracts",
      `Transactions > $${maxTx}`,
    ];
    return { allows, blocks };
  }, [flights, hotels, transport, maxTx]);

  async function simulate() {
    if (!policyId) {
      setSimResult({
        status: "REJECTED",
        reason: Number(simAmount) > maxTx ? "Transaction exceeds policy max" : "Connect a real policy id for on-chain simulate",
        requested: simAmount,
        maximum: String(maxTx),
        local: true,
      });
      return;
    }
    const res = await api(`/api/policies/${policyId}/simulate`, {
      method: "POST",
      body: JSON.stringify({
        target: contracts.mockFlightProvider,
        token: contracts.mockUsdc,
        amount: simAmount,
        functionSelector: "0x00000000",
      }),
    });
    setSimResult(res);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl">Policy Builder</h1>
          <p className="text-sm text-pact-muted mt-1">Visual limits that map 1:1 to PolicyManager.</p>
        </div>
        <div className="panel rounded-xl p-5 space-y-4">
          <Slider label="Maximum transaction" value={maxTx} set={setMaxTx} max={500} />
          <Slider label="Daily spending" value={daily} set={setDaily} max={1000} />
          <Slider label="Lifetime spending" value={lifetime} set={setLifetime} max={5000} />
          <Slider label="Expiration (days)" value={days} set={setDays} max={90} />
          <div className="space-y-2 text-sm">
            <Toggle label="FlightProvider" value={flights} set={setFlights} />
            <Toggle label="HotelProvider" value={hotels} set={setHotels} />
            <Toggle label="TransportProvider" value={transport} set={setTransport} />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-pact-muted mb-3">This policy allows</div>
          <ul className="space-y-2 text-sm">
            {preview.allows.map((a) => (
              <li key={a} className="text-pact-good">✓ {a}</li>
            ))}
          </ul>
          <div className="text-xs uppercase tracking-wider text-pact-muted mt-5 mb-3">Blocks</div>
          <ul className="space-y-2 text-sm">
            {preview.blocks.map((b) => (
              <li key={b} className="text-pact-bad">✗ {b}</li>
            ))}
          </ul>
        </div>

        <div className="panel rounded-xl p-5 space-y-3">
          <div className="text-sm font-medium">Transaction simulation</div>
          <input
            placeholder="On-chain policy id"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            className="w-full bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm"
          />
          <input
            value={simAmount}
            onChange={(e) => setSimAmount(e.target.value)}
            className="w-full bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm"
          />
          <button onClick={simulate} className="px-4 py-2 rounded-md bg-white/10 text-sm">
            Simulate
          </button>
          {simResult && (
            <div className="mono text-xs whitespace-pre-wrap border border-pact-border rounded-md p-3">
              {simResult.status === "REJECTED" || simResult.reason
                ? `TRANSACTION SIMULATION\n\nAmount: $${simResult.requested ?? simAmount}\n\nResult:\n✗ REJECTED\n\nReason:\n${simResult.reason}\n\nMaximum:\n$${simResult.maximum ?? maxTx}\n\nRequested:\n$${simResult.requested ?? simAmount}`
                : JSON.stringify(simResult, null, 2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  set,
  max,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  max: number;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs text-pact-muted mb-1">
        <span>{label}</span>
        <span className="mono text-pact-text">${value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function Toggle({
  label,
  value,
  set,
}: {
  label: string;
  value: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}
