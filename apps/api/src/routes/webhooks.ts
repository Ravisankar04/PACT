import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHmac, randomBytes, createHash } from "crypto";
import { prisma } from "@pact/database";
import { WEBHOOK_EVENTS } from "@pact/shared";
import { Queue } from "bullmq";
import IORedis from "ioredis";

function redis() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
}

export async function webhooksRoutes(app: FastifyInstance) {
  app.post("/webhooks", async (req, reply) => {
    const body = z
      .object({
        url: z.string().url(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
        userAddress: z.string().optional(),
      })
      .parse(req.body);

    const secret = randomBytes(24).toString("hex");
    let userId: string | undefined;
    if (body.userAddress) {
      const user = await prisma.user.upsert({
        where: { address: body.userAddress.toLowerCase() },
        create: { address: body.userAddress.toLowerCase() },
        update: {},
      });
      userId = user.id;
    }

    const webhook = await prisma.webhook.create({
      data: {
        url: body.url,
        secret,
        events: body.events,
        userId,
      },
    });

    return reply.code(201).send({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret,
      note: "Store the secret securely. Payloads are HMAC-SHA256 signed.",
    });
  });

  app.get("/webhooks/:id/deliveries", async (req, reply) => {
    const { id } = req.params as { id: string };
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return deliveries;
  });

  app.post("/api-keys", async (req, reply) => {
    const body = z.object({ name: z.string(), userAddress: z.string().optional() }).parse(req.body);
    const raw = `pact_${randomBytes(24).toString("hex")}`;
    const prefix = raw.slice(0, 12);
    const keyHash = createHash("sha256").update(raw).digest("hex");

    let userId: string | undefined;
    if (body.userAddress) {
      const user = await prisma.user.upsert({
        where: { address: body.userAddress.toLowerCase() },
        create: { address: body.userAddress.toLowerCase() },
        update: {},
      });
      userId = user.id;
    }

    const key = await prisma.apiKey.create({
      data: { name: body.name, keyHash, prefix, userId },
    });

    return reply.code(201).send({
      id: key.id,
      name: key.name,
      prefix,
      apiKey: raw,
      note: "The full API key is shown once.",
    });
  });
}

export function signWebhookPayload(secret: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return { body, signature };
}

export async function enqueueWebhook(event: string, payload: unknown) {
  const connection = redis();
  const queue = new Queue("webhooks", { connection });
  await queue.add(
    "deliver",
    { event, payload },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  );
  await queue.close();
  connection.disconnect();
}
