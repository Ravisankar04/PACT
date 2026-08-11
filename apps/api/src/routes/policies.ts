import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@pact/database";
import { parseUsdc } from "@pact/shared";
import { simulatePolicy } from "../lib/chain.js";
import { serializePolicy } from "./agents.js";

export async function policiesRoutes(app: FastifyInstance) {
  app.post("/policies", async (req, reply) => {
    const body = z
      .object({
        onChainId: z.string(),
        agentOnChainId: z.string(),
        ownerAddress: z.string(),
        maxTransaction: z.string(),
        dailyLimit: z.string(),
        lifetimeLimit: z.string(),
        expiration: z.number().optional(),
        allowedTargets: z.array(z.string()).default([]),
        allowedFunctions: z.array(z.string()).default([]),
        allowedTokens: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const agent = await prisma.agent.findFirst({ where: { onChainId: BigInt(body.agentOnChainId) } });
    if (!agent) return reply.code(404).send({ error: "Agent not found — index/register agent first" });

    const policy = await prisma.policy.create({
      data: {
        onChainId: BigInt(body.onChainId),
        agentId: agent.id,
        ownerAddress: body.ownerAddress.toLowerCase(),
        maxTransaction: parseUsdc(body.maxTransaction),
        dailyLimit: parseUsdc(body.dailyLimit),
        lifetimeLimit: parseUsdc(body.lifetimeLimit),
        expiration: body.expiration ? new Date(body.expiration * 1000) : null,
        allowedTargets: body.allowedTargets.map((t) => t.toLowerCase()),
        allowedFunctions: body.allowedFunctions,
        allowedTokens: body.allowedTokens.map((t) => t.toLowerCase()),
      },
    });

    return reply.code(201).send(serializePolicy(policy));
  });

  app.get("/policies/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const policy = await prisma.policy.findFirst({
      where: { OR: [{ id }, { onChainId: BigInt(id) }] },
      include: { agent: true },
    });
    if (!policy) return reply.code(404).send({ error: "Policy not found" });
    return serializePolicy(policy);
  });

  app.post("/policies/:id/simulate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        target: z.string(),
        token: z.string(),
        amount: z.string(),
        functionSelector: z.string().default("0x00000000"),
      })
      .parse(req.body);

    const policy = await prisma.policy.findFirst({
      where: { OR: [{ id }, { onChainId: BigInt(id) }] },
    });
    if (!policy) return reply.code(404).send({ error: "Policy not found" });

    const simulation = await simulatePolicy({
      policyId: policy.onChainId,
      target: body.target as `0x${string}`,
      functionSelector: body.functionSelector as `0x${string}`,
      token: body.token as `0x${string}`,
      amount: body.amount,
    });

    if (!simulation.allowed) {
      return {
        status: "REJECTED",
        title: "TRANSACTION REJECTED",
        reason: simulation.reason,
        requested: simulation.requested,
        maximum: simulation.maxTransaction,
        message: "No funds were transferred.",
        simulation,
      };
    }
    return { status: "ALLOWED", simulation };
  });
}
