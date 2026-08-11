import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@pact/database";
import { investigateRejection } from "@pact/ai";
import { simulatePolicy } from "../lib/chain.js";
import { formatUsdc } from "@pact/shared";

export async function investigationsRoutes(app: FastifyInstance) {
  app.post("/investigations", async (req) => {
    const body = z
      .object({
        question: z.string(),
        agentId: z.string().optional(),
        policyId: z.string().optional(),
        transactionHash: z.string().optional(),
        amount: z.string().optional(),
        target: z.string().optional(),
        token: z.string().optional(),
        functionSelector: z.string().optional(),
      })
      .parse(req.body);

    const agent = body.agentId
      ? await prisma.agent.findFirst({
          where: { OR: [{ id: body.agentId }, { onChainId: BigInt(body.agentId) }] },
          include: { policies: true, reputation: true },
        })
      : null;

    const policy = body.policyId
      ? await prisma.policy.findFirst({
          where: { OR: [{ id: body.policyId }, { onChainId: BigInt(body.policyId) }] },
        })
      : agent?.policies?.[0] ?? null;

    const action = body.transactionHash
      ? await prisma.agentAction.findFirst({ where: { transactionHash: body.transactionHash } })
      : null;

    const events = body.transactionHash
      ? await prisma.blockchainEvent.findMany({ where: { transactionHash: body.transactionHash } })
      : [];

    let simulation;
    if (policy && body.amount && body.target && body.token) {
      simulation = await simulatePolicy({
        policyId: policy.onChainId,
        target: body.target as `0x${string}`,
        functionSelector: (body.functionSelector ?? "0x00000000") as `0x${string}`,
        token: body.token as `0x${string}`,
        amount: body.amount,
      });
    }

    const analysis = await investigateRejection({
      agent: agent
        ? {
            id: agent.onChainId.toString(),
            name: agent.name,
            owner: agent.ownerAddress,
          }
        : undefined,
      policy: policy
        ? {
            id: policy.onChainId.toString(),
            maxTransaction: formatUsdc(policy.maxTransaction),
            dailyLimit: formatUsdc(policy.dailyLimit),
            lifetimeLimit: formatUsdc(policy.lifetimeLimit),
          }
        : undefined,
      action: action
        ? {
            status: action.status,
            reason: action.reason,
            amount: formatUsdc(action.amount),
            tx: action.transactionHash,
          }
        : undefined,
      events: events.map((e) => ({
        eventName: e.eventName,
        blockNumber: e.blockNumber.toString(),
        args: e.args,
      })),
      simulation,
    });

    return {
      question: body.question,
      analysis,
      evidence: {
        agentOnChainId: agent?.onChainId?.toString(),
        policyOnChainId: policy?.onChainId?.toString(),
        eventsCount: events.length,
        simulation,
      },
    };
  });
}
