import { z } from "zod";
import type { PolicySimulationResult } from "@pact/shared";

export type ToolName =
  | "searchServices"
  | "getAgent"
  | "getPrice"
  | "createEscrow"
  | "executePayment"
  | "checkPolicy";

export interface ToolContext {
  agentId: string;
  policyId: string;
  ownerAddress: string;
  /** Injected executors — financial tools must call PACT, never raw keys */
  checkPolicy: (input: {
    target: string;
    amount: string;
    functionSelector: string;
    token: string;
  }) => Promise<PolicySimulationResult>;
  executePayment?: (input: {
    target: string;
    amount: string;
    flightId?: string;
  }) => Promise<{ status: string; transactionHash?: string; reason?: string }>;
  createEscrow?: (input: {
    payeeAgentId: string;
    amount: string;
    terms: string;
  }) => Promise<{ escrowId: string }>;
  getAgent?: (id: string) => Promise<unknown>;
  searchServices?: (query: string) => Promise<unknown[]>;
}

const paymentSchema = z.object({
  target: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(),
  flightId: z.string().optional(),
});

/**
 * Strict tool permissions — LLM never receives private keys or arbitrary tx capability.
 */
export async function runTool(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case "checkPolicy": {
      const target = String(args.target ?? "");
      const amount = String(args.amount ?? "0");
      const functionSelector = String(args.functionSelector ?? "0x00000000");
      const token = String(args.token ?? "");
      return ctx.checkPolicy({ target, amount, functionSelector, token });
    }
    case "executePayment": {
      if (!ctx.executePayment) throw new Error("executePayment not available");
      const parsed = paymentSchema.parse(args);
      const sim = await ctx.checkPolicy({
        target: parsed.target,
        amount: parsed.amount,
        functionSelector: "0x7c025200",
        token: String(args.token ?? ""),
      });
      if (!sim.allowed) {
        return {
          status: "REJECTED",
          reason: sim.reason,
          requested: parsed.amount,
          maximum: sim.maxTransaction,
        };
      }
      return ctx.executePayment(parsed);
    }
    case "createEscrow": {
      if (!ctx.createEscrow) throw new Error("createEscrow not available");
      return ctx.createEscrow({
        payeeAgentId: String(args.payeeAgentId),
        amount: String(args.amount),
        terms: String(args.terms ?? ""),
      });
    }
    case "getAgent":
      return ctx.getAgent?.(String(args.id)) ?? null;
    case "getPrice":
      return { price: String(args.fallback ?? "5.00"), currency: "USDC" };
    case "searchServices":
      return (
        ctx.searchServices?.(String(args.query ?? "")) ?? [
          { id: "flight-AA100", name: "AA100 SFO→JFK", price: "37.42" },
          { id: "flight-UA220", name: "UA220 SFO→JFK", price: "41.00" },
          { id: "flight-DL80", name: "DL80 SFO→JFK", price: "80.00" },
        ]
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export interface TravelPlanStep {
  step: string;
  status: "pending" | "ok" | "rejected";
  detail?: string;
}

/**
 * Deterministic TravelBot demo planner (works without an LLM key).
 */
export async function runTravelBotDemo(ctx: ToolContext, flightProvider: string, token: string) {
  const steps: TravelPlanStep[] = [];
  const services = (await runTool("searchServices", { query: "flights SFO JFK" }, ctx)) as Array<{
    id: string;
    name: string;
    price: string;
  }>;
  steps.push({ step: "search", status: "ok", detail: `Found ${services.length} flights` });

  const cheapest = [...services].sort((a, b) => Number(a.price) - Number(b.price))[0];
  steps.push({ step: "compare", status: "ok", detail: `Selected ${cheapest.name} @ $${cheapest.price}` });

  const okSim = await ctx.checkPolicy({
    target: flightProvider,
    amount: cheapest.price,
    functionSelector: "0x7c025200",
    token,
  });
  steps.push({
    step: "policy-check-37",
    status: okSim.allowed ? "ok" : "rejected",
    detail: okSim.allowed ? "Within policy" : okSim.reason,
  });

  let purchase: unknown = null;
  if (okSim.allowed && ctx.executePayment) {
    purchase = await ctx.executePayment({
      target: flightProvider,
      amount: cheapest.price,
      flightId: cheapest.id,
    });
    steps.push({ step: "purchase", status: "ok", detail: JSON.stringify(purchase) });
  }

  const over = await ctx.checkPolicy({
    target: flightProvider,
    amount: "80.00",
    functionSelector: "0x7c025200",
    token,
  });
  steps.push({
    step: "attempt-80",
    status: over.allowed ? "ok" : "rejected",
    detail: over.allowed ? "Unexpectedly allowed" : over.reason,
  });

  return { steps, purchase, rejection: over };
}

export async function investigateRejection(evidence: {
  agent?: unknown;
  policy?: unknown;
  action?: unknown;
  events?: unknown[];
  simulation?: PolicySimulationResult;
}): Promise<string> {
  // Evidence-backed only — never invent blockchain data
  if (!evidence.simulation && !evidence.action && !evidence.events?.length) {
    return "Insufficient on-chain/indexed evidence to determine rejection reason.";
  }
  if (evidence.simulation && !evidence.simulation.allowed) {
    return [
      "TRANSACTION ANALYSIS",
      "",
      "The transaction was rejected because of a policy constraint.",
      "",
      `Reason: ${evidence.simulation.reason}`,
      evidence.simulation.requested ? `Requested: $${evidence.simulation.requested}` : "",
      evidence.simulation.maxTransaction ? `Maximum: $${evidence.simulation.maxTransaction}` : "",
      "",
      "Evidence sourced from PolicyManager.simulate / indexed events only.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "TRANSACTION ANALYSIS",
    "",
    "Available evidence:",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}
