"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FlowAnimation } from "@/components/FlowAnimation";
import { ConnectButton } from "@/components/ConnectButton";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="font-display text-2xl tracking-tight">PACT</div>
        <div className="flex items-center gap-4">
          <Link href="/app" className="text-sm text-pact-muted hover:text-pact-text">
            Protocol
          </Link>
          <ConnectButton />
        </div>
      </header>

      <section className="relative px-8 pt-16 pb-24 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <div className="font-display text-[clamp(2.8rem,7vw,5.5rem)] leading-[0.95] tracking-tight">
            GIVE AI AGENTS MONEY.
            <br />
            <span className="text-pact-accent">GIVE THEM RULES.</span>
          </div>
          <p className="mt-6 text-lg text-pact-muted max-w-xl">
            PACT is an authorization and settlement protocol for autonomous AI agents.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/lab"
              className="px-5 py-2.5 bg-pact-accent text-black font-medium text-sm rounded-md hover:brightness-110 transition"
            >
              Launch Agent Lab
            </Link>
            <Link
              href="/app"
              className="px-5 py-2.5 border border-pact-border text-sm rounded-md hover:bg-white/5 transition"
            >
              Explore Protocol
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-16 max-w-md"
        >
          <FlowAnimation />
        </motion.div>
      </section>

      <section className="border-t border-pact-border px-8 py-16 max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
        {[
          {
            t: "Programmable vaults",
            d: "Deposit capital into an AgentVault. Agents spend only through policy-enforced execute().",
          },
          {
            t: "EIP-712 authorization",
            d: "Owners sign typed actions. Agents never hold the primary wallet key.",
          },
          {
            t: "On-chain accountability",
            d: "Escrow, receipts, reputation, and indexed events — blockchain is source of truth.",
          },
        ].map((c) => (
          <div key={c.t}>
            <div className="text-sm font-medium mb-2">{c.t}</div>
            <p className="text-sm text-pact-muted leading-relaxed">{c.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
