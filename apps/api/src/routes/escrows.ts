import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@pact/database";
import { parseUsdc } from "@pact/shared";
import { activityHub } from "../lib/activityHub.js";

export async function escrowsRoutes(app: FastifyInstance) {
  app.post("/escrows", async (req, reply) => {
    const body = z
      .object({
        onChainId: z.string(),
        payerAgentOnChainId: z.string().optional(),
        payeeAgentOnChainId: z.string().optional(),
        payerAddress: z.string(),
        payeeAddress: z.string(),
        amount: z.string(),
        termsHash: z.string(),
        status: z.string().default("Created"),
        transactionHash: z.string().optional(),
      })
      .parse(req.body);

    const payerAgent = body.payerAgentOnChainId
      ? await prisma.agent.findFirst({ where: { onChainId: BigInt(body.payerAgentOnChainId) } })
      : null;
    const payeeAgent = body.payeeAgentOnChainId
      ? await prisma.agent.findFirst({ where: { onChainId: BigInt(body.payeeAgentOnChainId) } })
      : null;

    const escrow = await prisma.escrow.create({
      data: {
        onChainId: BigInt(body.onChainId),
        payerAgentId: payerAgent?.id,
        payeeAgentId: payeeAgent?.id,
        payerAddress: body.payerAddress.toLowerCase(),
        payeeAddress: body.payeeAddress.toLowerCase(),
        amount: parseUsdc(body.amount),
        termsHash: body.termsHash,
        status: body.status,
        transactionHash: body.transactionHash,
      },
    });

    activityHub.publish({
      id: escrow.id,
      type: "EscrowCreated",
      agentName: payerAgent?.name,
      message: `escrow created`,
      amount: body.amount,
      status: "info",
      timestamp: new Date().toISOString(),
    });

    return reply.code(201).send(serializeEscrow(escrow));
  });

  app.get("/escrows/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const escrow = await prisma.escrow.findFirst({
      where: { OR: [{ id }, { onChainId: BigInt(id) }] },
      include: { disputes: true, payerAgent: true, payeeAgent: true },
    });
    if (!escrow) return reply.code(404).send({ error: "Escrow not found" });
    return serializeEscrow(escrow);
  });
}

function serializeEscrow(e: any) {
  return {
    ...e,
    onChainId: e.onChainId?.toString?.(),
    amount: e.amount?.toString?.(),
    arbitrationNote: "MVP uses centralized arbitration. Decentralized arbitration can be added later.",
  };
}
