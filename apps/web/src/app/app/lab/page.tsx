"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseAbi, toFunctionSelector } from "viem";
import { contracts, api } from "@/lib/utils";
import { parseUsdc } from "@pact/shared";

const registryAbi = parseAbi([
  "function registerAgent(address agentAddress, string metadataURI) returns (uint256 agentId)",
  "function agentIdByAddress(address) view returns (uint256)",
]);
const policyAbi = parseAbi([
  "function createPolicy(uint256 agentId,uint256 maxTransaction,uint256 dailyLimit,uint256 lifetimeLimit,uint64 expiration,address[] allowedTargets,bytes4[] allowedFunctions,address[] allowedTokens) returns (uint256)",
  "function policyIdByAgent(uint256) view returns (uint256)",
]);

export default function AgentLabPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [name, setName] = useState("TravelBot");
  const [description, setDescription] = useState("Books flights within policy limits");
  const [budget, setBudget] = useState("200");
  const [maxTx, setMaxTx] = useState("50");
  const [daily, setDaily] = useState("100");
  const [lifetime, setLifetime] = useState("500");
  const [status, setStatus] = useState<string>("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const ready = useMemo(
    () => Boolean(contracts.agentRegistry && contracts.policyManager && contracts.mockUsdc),
    [],
  );

  async function createAgent() {
    if (!address || !publicClient || !contracts.agentRegistry || !contracts.policyManager) {
      setStatus("Connect wallet and configure contract addresses.");
      return;
    }
    try {
      setStatus("Registering agent on-chain…");
      const regTx = await writeContractAsync({
        address: contracts.agentRegistry,
        abi: registryAbi,
        functionName: "registerAgent",
        args: [address, `pact://${name}`],
      });
      setTxHash(regTx);
      await publicClient.waitForTransactionReceipt({ hash: regTx });

      const agentId = await publicClient.readContract({
        address: contracts.agentRegistry,
        abi: registryAbi,
        functionName: "agentIdByAddress",
        args: [address],
      });

      setStatus(`Agent #${agentId} registered. Creating policy…`);
      const selector = toFunctionSelector("purchaseFlight(string,uint256)");
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
      const targets = contracts.mockFlightProvider ? [contracts.mockFlightProvider] : [];
      const tokens = contracts.mockUsdc ? [contracts.mockUsdc] : [];

      const polTx = await writeContractAsync({
        address: contracts.policyManager,
        abi: policyAbi,
        functionName: "createPolicy",
        args: [
          agentId,
          parseUsdc(maxTx),
          parseUsdc(daily),
          parseUsdc(lifetime),
          expiration,
          targets,
          targets.length ? [selector] : [],
          tokens,
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: polTx });
      const policyId = await publicClient.readContract({
        address: contracts.policyManager,
        abi: policyAbi,
        functionName: "policyIdByAgent",
        args: [agentId],
      });

      await api("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          onChainId: agentId.toString(),
          ownerAddress: address,
          agentAddress: address,
          name,
          description,
          category: "travel",
          listed: true,
        }),
      });

      await api("/api/policies", {
        method: "POST",
        body: JSON.stringify({
          onChainId: policyId.toString(),
          agentOnChainId: agentId.toString(),
          ownerAddress: address,
          maxTransaction: maxTx,
          dailyLimit: daily,
          lifetimeLimit: lifetime,
          expiration: Number(expiration),
          allowedTargets: targets,
          allowedFunctions: targets.length ? [selector] : [],
          allowedTokens: tokens,
        }),
      });

      setStatus(
        `Created ${name} · Agent #${agentId} · Policy #${policyId} · Budget intent $${budget} (deposit via vault separately)`,
      );
    } catch (err: any) {
      setStatus(err?.shortMessage ?? err?.message ?? "Failed");
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Agent Lab</h1>
        <p className="text-sm text-pact-muted mt-1">
          Create an agent and policy on-chain. The smart contract enforces limits — not the UI.
        </p>
      </div>

      <div className="panel rounded-xl p-5 space-y-4">
        <div className="text-xs uppercase tracking-wider text-pact-muted">Create agent</div>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Description" value={description} onChange={setDescription} />
        <Field label="Budget ($)" value={budget} onChange={setBudget} />
        <Field label="Max transaction ($)" value={maxTx} onChange={setMaxTx} />
        <Field label="Daily limit ($)" value={daily} onChange={setDaily} />
        <Field label="Lifetime limit ($)" value={lifetime} onChange={setLifetime} />
        <button
          onClick={createAgent}
          disabled={!isConnected || !ready}
          className="w-full py-2.5 rounded-md bg-pact-accent text-black font-medium text-sm disabled:opacity-40"
        >
          {isConnected ? "Create Agent" : "Connect wallet"}
        </button>
        {!ready && (
          <p className="text-xs text-pact-warn">
            Contract addresses missing. Deploy locally and set NEXT_PUBLIC_* env vars.
          </p>
        )}
        {status && <p className="mono text-xs text-pact-muted whitespace-pre-wrap">{status}</p>}
        {isSuccess && txHash && <p className="mono text-xs text-pact-good">Tx confirmed: {txHash}</p>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-pact-muted mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/30 border border-pact-border rounded-md px-3 py-2 text-sm outline-none focus:border-pact-accent"
      />
    </label>
  );
}
