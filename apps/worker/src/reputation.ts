import { prisma } from "@pact/database";

export async function handleReputationJob(data: {
  agentOnChainId: string;
  score: number;
  successfulTasks: number;
  failedTasks: number;
  disputes: number;
  policyViolations: number;
  completedEscrows: number;
}) {
  const agentOnChainId = BigInt(data.agentOnChainId);
  const agent = await prisma.agent.findFirst({ where: { onChainId: agentOnChainId } });
  if (!agent) return;

  await prisma.reputationScore.upsert({
    where: { agentOnChainId },
    create: {
      agentId: agent.id,
      agentOnChainId,
      score: data.score,
      successfulTasks: data.successfulTasks,
      failedTasks: data.failedTasks,
      disputes: data.disputes,
      policyViolations: data.policyViolations,
      completedEscrows: data.completedEscrows,
    },
    update: {
      score: data.score,
      successfulTasks: data.successfulTasks,
      failedTasks: data.failedTasks,
      disputes: data.disputes,
      policyViolations: data.policyViolations,
      completedEscrows: data.completedEscrows,
    },
  });
}
