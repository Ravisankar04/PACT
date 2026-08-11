import type { FastifyInstance } from "fastify";
import { prisma } from "@pact/database";
import { activityHub } from "../lib/activityHub.js";
import { formatUsdc } from "@pact/shared";

export async function activityRoutes(app: FastifyInstance) {
  app.get("/activity", async (req) => {
    const q = req.query as { q?: string; limit?: string };
    const limit = Math.min(Number(q.limit ?? 50), 200);

    const events = await prisma.blockchainEvent.findMany({
      where: q.q
        ? {
            OR: [
              { transactionHash: { contains: q.q, mode: "insensitive" } },
              { eventName: { contains: q.q, mode: "insensitive" } },
              { address: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ blockNumber: "desc" }, { logIndex: "desc" }],
      take: limit,
    });

    const live = activityHub.recent(limit);
    return {
      live,
      indexed: events.map((e) => ({
        ...e,
        blockNumber: e.blockNumber.toString(),
      })),
    };
  });

  app.get("/explorer/search", async (req) => {
    const { q } = req.query as { q?: string };
    if (!q) return { results: [] };
    const events = await prisma.blockchainEvent.findMany({
      where: {
        OR: [
          { transactionHash: { equals: q, mode: "insensitive" } },
          { address: { equals: q, mode: "insensitive" } },
          { eventName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { blockNumber: "desc" },
      take: 50,
    });
    const actions = await prisma.agentAction.findMany({
      where: {
        OR: [{ transactionHash: q }, { receiptId: q }],
      },
      include: { agent: true },
      take: 20,
    });
    return {
      events: events.map((e) => ({ ...e, blockNumber: e.blockNumber.toString() })),
      actions: actions.map((a) => ({
        ...a,
        amount: formatUsdc(a.amount),
        nonce: a.nonce.toString(),
        blockNumber: a.blockNumber?.toString() ?? null,
      })),
    };
  });
}
