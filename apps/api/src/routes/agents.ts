import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@pact/database";
import { activityHub } from "../lib/activityHub.js";
import { getAddresses, simulatePolicy } from "../lib/chain.js";
import { parseUsdc } from "@pact/shared";

export async function agentsRoutes(app: FastifyInstance) {
  app.post("/agents", async (req, reply) => {
    const body = z
      .object({
        onChainId: z.string(),
        ownerAddress: z.string(),
        agentAddress: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        metadataURI: z.string().optional(),
        category: z.string().optional(),
        priceUsdc: z.string().optional(),
        listed: z.boolean().optional(),
      })
      .parse(req.body);

    const agent = await prisma.agent.create({
      data: {
        onChainId: BigInt(body.onChainId),
        ownerAddress: body.ownerAddress.toLowerCase(),
        agentAddress: body.agentAddress.toLowerCase(),
        name: body.name,
        description: body.description ?? "",
        metadataURI: body.metadataURI ?? "",
        category: body.category ?? "general",
        priceUsdc: body.priceUsdc ? parseUsdc(body.priceUsdc) : 0n,
        listed: body.listed ?? false,
      },
    });

    activityHub.publish({
      id: crypto.randomUUID(),
      type: "AgentRegistered",
      agentId: agent.onChainId.toString(),
      agentName: agent.name,
      message: `registered`,
      status: "success",
      timestamp: new Date().toISOString(),
    });

    return reply.code(201).send(serializeAgent(agent));
  });

  app.get("/agents", async (req) => {
    const q = req.query as { listed?: string; category?: string };
    const agents = await prisma.agent.findMany({
      where: {
        ...(q.listed === "true" ? { listed: true } : {}),
        ...(q.category ? { category: q.category } : {}),
      },
      include: { reputation: true, policies: true },
      orderBy: { createdAt: "desc" },
    });
    return agents.map(serializeAgent);
  });

  app.get("/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await prisma.agent.findFirst({
      where: {
        OR: [{ id }, { onChainId: BigInt(id) }],
      },
      include: { reputation: true, policies: true, actions: { orderBy: { createdAt: "desc" }, take: 25 } },
    });
    if (!agent) return reply.code(404).send({ error: "Agent not found" });
    return serializeAgent(agent);
  });

  app.post("/agents/:id/actions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        policyId: z.string(),
        target: z.string(),
        token: z.string(),
        amount: z.string(),
        nonce: z.string(),
        deadline: z.number(),
        dataHash: z.string(),
        functionSelector: z.string().default("0x00000000"),
        // Backend NEVER submits authorization bypass — this endpoint only simulates / records intent
        mode: z.enum(["simulate", "record"]).default("simulate"),
        status: z.string().optional(),
        reason: z.string().optional(),
        transactionHash: z.string().optional(),
        blockNumber: z.string().optional(),
        receiptId: z.string().optional(),
        receiptHash: z.string().optional(),
      })
      .parse(req.body);

    const agent = await prisma.agent.findFirst({
      where: { OR: [{ id }, { onChainId: BigInt(id) }] },
    });
    if (!agent) return reply.code(404).send({ error: "Agent not found" });

    const sim = await simulatePolicy({
      policyId: BigInt(body.policyId),
      target: body.target as `0x${string}`,
      functionSelector: body.functionSelector as `0x${string}`,
      token: body.token as `0x${string}`,
      amount: body.amount,
    });

    if (body.mode === "simulate") {
      if (!sim.allowed) {
        return {
          status: "REJECTED",
          title: "TRANSACTION REJECTED",
          reason: sim.reason,
          requested: sim.requested,
          maximum: sim.maxTransaction,
          message: "No funds were transferred.",
        };
      }
      return { status: "ALLOWED", simulation: sim };
    }

    const policy = await prisma.policy.findFirst({ where: { onChainId: BigInt(body.policyId) } });
    const action = await prisma.agentAction.create({
      data: {
        agentId: agent.id,
        policyId: policy?.id,
        target: body.target.toLowerCase(),
        token: body.token.toLowerCase(),
        amount: parseUsdc(body.amount),
        nonce: BigInt(body.nonce),
        deadline: new Date(body.deadline * 1000),
        dataHash: body.dataHash,
        status: body.status ?? (sim.allowed ? "PENDING" : "REJECTED"),
        reason: body.reason ?? (sim.allowed ? null : sim.reason),
        transactionHash: body.transactionHash,
        blockNumber: body.blockNumber ? BigInt(body.blockNumber) : null,
        receiptId: body.receiptId,
        receiptHash: body.receiptHash,
      },
    });

    activityHub.publish({
      id: action.id,
      type: action.status === "REJECTED" ? "ActionRejected" : "ActionExecuted",
      agentId: agent.onChainId.toString(),
      agentName: agent.name,
      message: action.status === "REJECTED" ? `transaction rejected — ${action.reason}` : `action recorded`,
      amount: body.amount,
      status: action.status === "REJECTED" ? "rejected" : "success",
      transactionHash: body.transactionHash as `0x${string}` | undefined,
      timestamp: new Date().toISOString(),
    });

    return serializeAction(action);
  });
}

function serializeAgent(agent: any) {
  return {
    ...agent,
    onChainId: agent.onChainId?.toString?.() ?? agent.onChainId,
    priceUsdc: agent.priceUsdc?.toString?.() ?? agent.priceUsdc,
    policies: agent.policies?.map(serializePolicy),
    actions: agent.actions?.map(serializeAction),
  };
}

function serializePolicy(p: any) {
  return {
    ...p,
    onChainId: p.onChainId?.toString?.(),
    maxTransaction: p.maxTransaction?.toString?.(),
    dailyLimit: p.dailyLimit?.toString?.(),
    lifetimeLimit: p.lifetimeLimit?.toString?.(),
  };
}

function serializeAction(a: any) {
  return {
    ...a,
    amount: a.amount?.toString?.(),
    nonce: a.nonce?.toString?.(),
    blockNumber: a.blockNumber?.toString?.() ?? null,
  };
}

export { serializeAgent, serializePolicy, serializeAction };
