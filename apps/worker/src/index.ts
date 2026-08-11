import "dotenv/config";
import { Worker, Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { createLogger } from "./logger.js";
import { startIndexer } from "./indexer.js";
import { handleWebhookJob } from "./webhooks.js";
import { handleReputationJob } from "./reputation.js";

const logger = createLogger("worker");

function connection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
}

async function main() {
  const conn = connection();

  const defaultJobOpts = {
    attempts: 5,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  };

  // Ensure queues exist
  const queues = ["blockchain-indexer", "agent-execution", "ai-tasks", "webhooks", "reputation"] as const;
  for (const name of queues) {
    const q = new Queue(name, { connection: conn, defaultJobOptions: defaultJobOpts });
    await q.waitUntilReady();
    await q.close();
  }

  const webhookWorker = new Worker(
    "webhooks",
    async (job) => {
      logger.info({ jobId: job.id, event: job.data.event }, "webhook job");
      await handleWebhookJob(job.data);
    },
    {
      connection: conn,
      settings: {},
    },
  );

  webhookWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "webhook failed — may move to DLQ");
  });

  const reputationWorker = new Worker(
    "reputation",
    async (job) => {
      logger.info({ jobId: job.id }, "reputation job");
      await handleReputationJob(job.data);
    },
    { connection: conn },
  );

  const indexerQueue = new Queue("blockchain-indexer", { connection: conn, defaultJobOptions: defaultJobOpts });
  await indexerQueue.add(
    "tick",
    {},
    { repeat: { every: 3000 }, jobId: "indexer-tick", ...defaultJobOpts },
  );

  const indexerWorker = new Worker(
    "blockchain-indexer",
    async (job) => {
      await startIndexer(logger);
      return { ok: true, jobId: job.id };
    },
    { connection: conn },
  );

  // Dead-letter observation via QueueEvents
  const events = new QueueEvents("webhooks", { connection: conn });
  events.on("failed", ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, "webhook dead-letter candidate");
  });

  logger.info("PACT workers started");
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
