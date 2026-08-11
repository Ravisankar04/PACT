import type { FastifyInstance } from "fastify";
import { prisma } from "@pact/database";
import { formatUsdc } from "@pact/shared";
import { getAddresses, getChainId } from "../lib/chain.js";

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async () => {
    const [activeAgents, actions, escrows, disputes, deposits] = await Promise.all([
      prisma.agent.count({ where: { active: true } }),
      prisma.agentAction.findMany({ select: { status: true, amount: true } }),
      prisma.escrow.findMany({ select: { status: true, amount: true } }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.blockchainEvent.findMany({
        where: { eventName: "FundsDeposited" },
        select: { args: true },
      }),
    ]);

    const successful = actions.filter((a) => a.status === "CONFIRMED" || a.status === "EXECUTED").length;
    const blocked = actions.filter((a) => a.status === "REJECTED").length;
    const openEscrows = escrows.filter((e) =>
      ["Created", "Funded", "WorkSubmitted", "Disputed"].includes(e.status),
    ).length;

    let capital = 0n;
    for (const d of deposits) {
      const args = d.args as { amount?: string };
      if (args?.amount) capital += BigInt(args.amount);
    }

    return {
      activeAgents,
      capitalControlled: formatUsdc(capital),
      transactions: actions.length,
      successfulTransactions: successful,
      blockedTransactions: blocked,
      openEscrows,
      disputes,
      chainId: getChainId(),
      contracts: getAddresses(),
    };
  });
}
