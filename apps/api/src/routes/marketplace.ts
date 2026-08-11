import type { FastifyInstance } from "fastify";
import { prisma } from "@pact/database";
import { formatUsdc } from "@pact/shared";

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get("/marketplace", async (req) => {
    const q = req.query as {
      category?: string;
      minReputation?: string;
      maxPrice?: string;
      minSuccess?: string;
    };

    const agents = await prisma.agent.findMany({
      where: {
        listed: true,
        active: true,
        ...(q.category ? { category: q.category } : {}),
        ...(q.maxPrice ? { priceUsdc: { lte: BigInt(Math.round(Number(q.maxPrice) * 1e6)) } } : {}),
      },
      include: { reputation: true },
      orderBy: { createdAt: "desc" },
    });

    return agents
      .map((a) => {
        const successTotal = (a.reputation?.successfulTasks ?? 0) + (a.reputation?.failedTasks ?? 0);
        const successRate =
          successTotal === 0 ? 100 : ((a.reputation?.successfulTasks ?? 0) / successTotal) * 100;
        return {
          id: a.id,
          onChainId: a.onChainId.toString(),
          name: a.name,
          description: a.description,
          category: a.category,
          priceUsdc: formatUsdc(a.priceUsdc),
          reputation: a.reputation?.score ?? 0,
          successRate: Number(successRate.toFixed(1)),
        };
      })
      .filter((a) => {
        if (q.minReputation && a.reputation < Number(q.minReputation)) return false;
        if (q.minSuccess && a.successRate < Number(q.minSuccess)) return false;
        return true;
      });
  });
}
