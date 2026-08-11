import { createHmac } from "crypto";
import { prisma } from "@pact/database";

export async function handleWebhookJob(data: { event: string; payload: unknown }) {
  const hooks = await prisma.webhook.findMany({
    where: { active: true, events: { has: data.event } },
  });

  for (const hook of hooks) {
    const body = JSON.stringify({
      event: data.event,
      payload: data.payload,
      timestamp: new Date().toISOString(),
    });
    const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

    let status = "delivered";
    let responseCode: number | undefined;
    let lastError: string | undefined;

    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pact-signature": signature,
          "x-pact-event": data.event,
        },
        body,
      });
      responseCode = res.status;
      if (!res.ok) {
        status = "failed";
        lastError = await res.text();
        throw new Error(`Webhook HTTP ${res.status}`);
      }
    } catch (err: any) {
      status = "failed";
      lastError = err?.message ?? String(err);
      await prisma.webhookDelivery.create({
        data: {
          webhookId: hook.id,
          event: data.event,
          payload: data.payload as any,
          status,
          responseCode,
          attempts: 1,
          lastError,
        },
      });
      throw err;
    }

    await prisma.webhookDelivery.create({
      data: {
        webhookId: hook.id,
        event: data.event,
        payload: data.payload as any,
        status,
        responseCode,
        attempts: 1,
        lastError,
      },
    });
  }
}
