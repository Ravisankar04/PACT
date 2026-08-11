import type { FastifyInstance } from "fastify";
import { prisma } from "@pact/database";

export async function reputationRoutes(app: FastifyInstance) {
  app.get("/reputation/:agentId", async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const agent = await prisma.agent.findFirst({
      where: { OR: [{ id: agentId }, { onChainId: BigInt(agentId) }] },
      include: { reputation: true },
    });
    if (!agent) return reply.code(404).send({ error: "Agent not found" });

    const events = await prisma.reputationEvent.findMany({
      where: { agentOnChainId: agent.onChainId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const score = agent.reputation;
    const successTotal = (score?.successfulTasks ?? 0) + (score?.failedTasks ?? 0);
    const successRate = successTotal === 0 ? 0 : ((score?.successfulTasks ?? 0) / successTotal) * 100;

    return {
      agentId: agent.onChainId.toString(),
      name: agent.name,
      score: score?.score ?? 0,
      successRate: Number(successRate.toFixed(1)),
      successfulTasks: score?.successfulTasks ?? 0,
      failedTasks: score?.failedTasks ?? 0,
      disputes: score?.disputes ?? 0,
      policyViolations: score?.policyViolations ?? 0,
      completedEscrows: score?.completedEscrows ?? 0,
      formula:
        "score = clamp(successRate*70 + volumeBonus*30 - disputePenalty - violationPenalty, 0, 100)",
      events: events.map((e) => ({ ...e, agentOnChainId: e.agentOnChainId.toString() })),
    };
  });
}
