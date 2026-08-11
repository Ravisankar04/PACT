import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { createLogger } from "./lib/logger.js";
import { registerRoutes } from "./routes/index.js";
import { activityHub } from "./lib/activityHub.js";

const logger = createLogger("api");

async function main() {
  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.addHook("onRequest", async (req) => {
    logger.info({ requestId: req.id, method: req.method, url: req.url }, "request");
  });

  app.get("/health", async () => ({ ok: true, service: "pact-api" }));

  app.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket) => {
      activityHub.subscribe(socket);
      socket.send(JSON.stringify({ type: "connected", message: "PACT live activity" }));
    });
  });

  await registerRoutes(app);

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? "0.0.0.0";
  await app.listen({ port, host });
  logger.info({ port, host }, "PACT API listening");
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
