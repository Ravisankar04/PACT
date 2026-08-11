import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Log,
} from "viem";
import { foundry } from "viem/chains";
import { prisma } from "@pact/database";
import type { Logger } from "pino";

const EVENTS = [
  parseAbiItem("event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed agentAddress, string metadataURI)"),
  parseAbiItem("event PolicyCreated(uint256 indexed policyId, uint256 indexed agentId, address indexed owner, uint256 maxTransaction, uint256 dailyLimit, uint256 lifetimeLimit, uint64 expiration)"),
  parseAbiItem("event PolicyUpdated(uint256 indexed policyId)"),
  parseAbiItem("event FundsDeposited(address indexed owner, uint256 amount, uint256 newBalance)"),
  parseAbiItem("event ActionExecuted(uint256 indexed agentId, uint256 indexed policyId, address indexed target, address token, uint256 amount, uint256 nonce, bytes32 receiptId, bytes32 receiptHash, bytes result)"),
  parseAbiItem("event ActionRejected(uint256 indexed agentId, uint256 indexed policyId, string reason)"),
  parseAbiItem("event EscrowCreated(uint256 indexed escrowId, uint256 indexed payerAgentId, uint256 indexed payeeAgentId, address payer, address payee, uint256 amount, bytes32 termsHash)"),
  parseAbiItem("event EscrowCompleted(uint256 indexed escrowId)"),
  parseAbiItem("event EscrowDisputed(uint256 indexed escrowId, string reason)"),
  parseAbiItem("event ReputationUpdated(uint256 indexed agentId, uint256 score, uint256 successfulTasks, uint256 failedTasks, uint256 disputes, uint256 policyViolations, uint256 completedEscrows)"),
] as const;

function getClient() {
  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  return createPublicClient({
    chain: { ...foundry, id: chainId },
    transport: http(process.env.RPC_URL ?? "http://127.0.0.1:8545"),
  });
}

function watchedAddresses(): Address[] {
  return [
    process.env.AGENT_REGISTRY_ADDRESS,
    process.env.POLICY_MANAGER_ADDRESS,
    process.env.AGENT_VAULT_ADDRESS,
    process.env.ESCROW_ADDRESS,
    process.env.REPUTATION_REGISTRY_ADDRESS,
  ].filter(Boolean) as Address[];
}

export async function startIndexer(logger: Logger) {
  const addresses = watchedAddresses();
  if (addresses.length === 0) {
    logger.warn("No contract addresses configured — indexer idle");
    return;
  }

  const client = getClient();
  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  const latest = await client.getBlockNumber();

  const state = await prisma.indexerState.upsert({
    where: { id: "default" },
    create: { id: "default", lastBlock: 0n },
    update: {},
  });

  let fromBlock = state.lastBlock + 1n;
  if (fromBlock > latest) return;

  // Cap range for Anvil friendliness
  const toBlock = latest - fromBlock > 2000n ? fromBlock + 2000n : latest;

  for (const event of EVENTS) {
    const logs = await client.getLogs({
      address: addresses,
      event,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      await ingestLog(chainId, event.name!, log, logger);
    }
  }

  await prisma.indexerState.update({
    where: { id: "default" },
    data: { lastBlock: toBlock },
  });

  logger.info(
    { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
    "indexed blocks",
  );
}

async function ingestLog(
  chainId: number,
  eventName: string,
  log: Log & { args?: Record<string, unknown> },
  logger: Logger,
) {
  const args = (log as any).args ?? {};
  const serialized = JSON.parse(
    JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );

  try {
    await prisma.blockchainEvent.create({
      data: {
        chainId,
        address: log.address.toLowerCase(),
        eventName,
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash ?? "",
        logIndex: Number(log.logIndex ?? 0),
        args: serialized,
      },
    });
  } catch (err: any) {
    // unique constraint = idempotent skip
    if (!String(err?.message ?? "").includes("Unique constraint")) {
      logger.error({ err, eventName }, "ingest failed");
    }
    return;
  }

  if (eventName === "ReputationUpdated") {
    const agentOnChainId = BigInt(serialized.agentId);
    const agent = await prisma.agent.findFirst({ where: { onChainId: agentOnChainId } });
    if (agent) {
      await prisma.reputationScore.upsert({
        where: { agentOnChainId },
        create: {
          agentId: agent.id,
          agentOnChainId,
          score: Number(serialized.score),
          successfulTasks: Number(serialized.successfulTasks),
          failedTasks: Number(serialized.failedTasks),
          disputes: Number(serialized.disputes),
          policyViolations: Number(serialized.policyViolations),
          completedEscrows: Number(serialized.completedEscrows),
        },
        update: {
          score: Number(serialized.score),
          successfulTasks: Number(serialized.successfulTasks),
          failedTasks: Number(serialized.failedTasks),
          disputes: Number(serialized.disputes),
          policyViolations: Number(serialized.policyViolations),
          completedEscrows: Number(serialized.completedEscrows),
        },
      });
    }
    await prisma.reputationEvent.create({
      data: {
        agentOnChainId,
        type: "ReputationUpdated",
        payload: serialized,
        txHash: log.transactionHash,
      },
    });
  }

  if (eventName === "ActionExecuted") {
    await prisma.agentAction.updateMany({
      where: { transactionHash: log.transactionHash ?? undefined },
      data: {
        status: "CONFIRMED",
        receiptId: serialized.receiptId,
        receiptHash: serialized.receiptHash,
        blockNumber: log.blockNumber ?? undefined,
      },
    });
  }
}
