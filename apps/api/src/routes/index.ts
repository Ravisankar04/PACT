import type { FastifyInstance } from "fastify";
import { agentsRoutes } from "./agents.js";
import { policiesRoutes } from "./policies.js";
import { escrowsRoutes } from "./escrows.js";
import { activityRoutes } from "./activity.js";
import { reputationRoutes } from "./reputation.js";
import { investigationsRoutes } from "./investigations.js";
import { webhooksRoutes } from "./webhooks.js";
import { marketplaceRoutes } from "./marketplace.js";
import { metricsRoutes } from "./metrics.js";
import { developerRoutes } from "./developer.js";
import { demoRoutes } from "./demo.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(agentsRoutes, { prefix: "/api" });
  await app.register(policiesRoutes, { prefix: "/api" });
  await app.register(escrowsRoutes, { prefix: "/api" });
  await app.register(activityRoutes, { prefix: "/api" });
  await app.register(reputationRoutes, { prefix: "/api" });
  await app.register(investigationsRoutes, { prefix: "/api" });
  await app.register(webhooksRoutes, { prefix: "/api" });
  await app.register(marketplaceRoutes, { prefix: "/api" });
  await app.register(metricsRoutes, { prefix: "/api" });
  await app.register(developerRoutes, { prefix: "/api" });
  await app.register(demoRoutes, { prefix: "/api" });
}
