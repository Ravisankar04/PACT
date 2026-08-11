import type { FastifyInstance } from "fastify";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
  keccak256,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { prisma } from "@pact/database";
import { AGENT_ACTION_TYPES, parseUsdc, formatUsdc } from "@pact/shared";
import { runTravelBotDemo } from "@pact/ai";
import { getAddresses, getChainId, simulatePolicy } from "../lib/chain.js";
import { activityHub } from "../lib/activityHub.js";

const vaultAbi = parseAbi([
  "function deposit(uint256 amount)",
  "function execute((uint256 agentId,uint256 policyId,address target,uint256 value,address token,uint256 amount,bytes32 dataHash,uint256 nonce,uint256 deadline) action, bytes data, bytes signature) returns (bytes result, bytes32 receiptId)",
  "function balances(address) view returns (uint256)",
]);

const registryAbi = parseAbi([
  "function registerAgent(address agentAddress, string metadataURI) returns (uint256)",
]);

const policyAbi = parseAbi([
  "function createPolicy(uint256 agentId,uint256 maxTransaction,uint256 dailyLimit,uint256 lifetimeLimit,uint64 expiration,address[] allowedTargets,bytes4[] allowedFunctions,address[] allowedTokens) returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function faucet(uint256 amount)",
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
]);

const flightAbi = parseAbi([
  "function purchaseFlight(string flightId, uint256 amount) returns (bool)",
]);

/**
 * Deterministic TravelBot demo against local Anvil.
 * Requires deployed contracts + funded deployer key.
 */
export async function demoRoutes(app: FastifyInstance) {
  app.post("/demo/travelbot", async (_req, reply) => {
    const pk = (process.env.DEPLOYER_PRIVATE_KEY ??
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as Hex;
    const account = privateKeyToAccount(pk);
    const chain = { ...foundry, id: getChainId() };
    const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
    const addr = getAddresses();

    if (!addr.agentVault || !addr.mockUsdc) {
      return reply.code(400).send({
        error: "Contract addresses not configured. Deploy with forge script and set env vars.",
      });
    }

    // Register TravelBot (agent address = deployer for demo simplicity)
    const regHash = await walletClient.writeContract({
      address: addr.agentRegistry,
      abi: registryAbi,
      functionName: "registerAgent",
      args: [account.address, "ipfs://travelbot-demo"],
    });
    await publicClient.waitForTransactionReceipt({ hash: regHash });

    // Read agent id from registry mapping
    const agentId = await publicClient.readContract({
      address: addr.agentRegistry,
      abi: parseAbi(["function agentIdByAddress(address) view returns (uint256)"]),
      functionName: "agentIdByAddress",
      args: [account.address],
    });

    const { toFunctionSelector } = await import("viem");
    const selector = toFunctionSelector("purchaseFlight(string,uint256)");

    const expiration = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
    const polHash = await walletClient.writeContract({
      address: addr.policyManager,
      abi: policyAbi,
      functionName: "createPolicy",
      args: [
        agentId,
        50_000_000n,
        100_000_000n,
        500_000_000n,
        expiration,
        [addr.mockFlightProvider],
        [selector],
        [addr.mockUsdc],
      ],
    });
    const polReceipt = await publicClient.waitForTransactionReceipt({ hash: polHash });

    // policy id = next - use events or assume incremental; read from policyIdByAgent
    const policyId = await publicClient.readContract({
      address: addr.policyManager,
      abi: parseAbi(["function policyIdByAgent(uint256) view returns (uint256)"]),
      functionName: "policyIdByAgent",
      args: [agentId],
    });

    // Fund: faucet/mint + approve + deposit 200 USDC
    try {
      await walletClient.writeContract({
        address: addr.mockUsdc,
        abi: erc20Abi,
        functionName: "faucet",
        args: [10_000_000_000n],
      });
    } catch {
      // deployer may be owner with mint already
    }

    await walletClient.writeContract({
      address: addr.mockUsdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [addr.agentVault, 200_000_000n],
    });
    const depHash = await walletClient.writeContract({
      address: addr.agentVault,
      abi: vaultAbi,
      functionName: "deposit",
      args: [200_000_000n],
    });
    await publicClient.waitForTransactionReceipt({ hash: depHash });

    // Upsert DB records
    const agent = await prisma.agent.upsert({
      where: { onChainId: agentId },
      create: {
        onChainId: agentId,
        ownerAddress: account.address.toLowerCase(),
        agentAddress: account.address.toLowerCase(),
        name: "TravelBot",
        description: "Finds and books flights within policy limits",
        category: "travel",
        priceUsdc: 0n,
        listed: true,
        metadataURI: "ipfs://travelbot-demo",
      },
      update: { name: "TravelBot", active: true },
    });

    await prisma.policy.upsert({
      where: { onChainId: policyId },
      create: {
        onChainId: policyId,
        agentId: agent.id,
        ownerAddress: account.address.toLowerCase(),
        maxTransaction: 50_000_000n,
        dailyLimit: 100_000_000n,
        lifetimeLimit: 500_000_000n,
        expiration: new Date(Number(expiration) * 1000),
        allowedTargets: [addr.mockFlightProvider.toLowerCase()],
        allowedFunctions: [selector],
        allowedTokens: [addr.mockUsdc.toLowerCase()],
      },
      update: { active: true },
    });

    await prisma.reputationScore.upsert({
      where: { agentOnChainId: agentId },
      create: {
        agentId: agent.id,
        agentOnChainId: agentId,
        score: 94,
        successfulTasks: 1291,
        failedTasks: 17,
        disputes: 4,
        policyViolations: 0,
        completedEscrows: 800,
      },
      update: {},
    });

    const executePayment = async (input: { target: string; amount: string; flightId?: string }) => {
      const amount = parseUsdc(input.amount);
      const data = encodeFunctionData({
        abi: flightAbi,
        functionName: "purchaseFlight",
        args: [input.flightId ?? "AA100", amount],
      });
      const nonce = BigInt(Date.now());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const dataHash = keccak256(data);
      const message = {
        agentId,
        policyId,
        target: input.target as Address,
        value: 0n,
        token: addr.mockUsdc,
        amount,
        dataHash,
        nonce,
        deadline,
      };

      const signature = await walletClient.signTypedData({
        account,
        domain: {
          name: "PACT AgentVault",
          version: "1",
          chainId: getChainId(),
          verifyingContract: addr.agentVault,
        },
        types: AGENT_ACTION_TYPES,
        primaryType: "AgentAction",
        message,
      });

      try {
        const txHash = await walletClient.writeContract({
          address: addr.agentVault,
          abi: vaultAbi,
          functionName: "execute",
          args: [message, data, signature],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        const status = receipt.status === "success" ? "CONFIRMED" : "REJECTED";

        await prisma.agentAction.create({
          data: {
            agentId: agent.id,
            policyId: (await prisma.policy.findFirst({ where: { onChainId: policyId } }))!.id,
            target: input.target.toLowerCase(),
            token: addr.mockUsdc.toLowerCase(),
            amount,
            nonce,
            deadline: new Date(Number(deadline) * 1000),
            dataHash,
            status,
            transactionHash: txHash,
            blockNumber: receipt.blockNumber,
          },
        });

        activityHub.publish({
          id: crypto.randomUUID(),
          type: "ActionExecuted",
          agentId: agentId.toString(),
          agentName: "TravelBot",
          message: `purchased flight`,
          amount: input.amount,
          status: "success",
          transactionHash: txHash,
          timestamp: new Date().toISOString(),
        });

        return { status, transactionHash: txHash, blockNumber: receipt.blockNumber.toString() };
      } catch (err: any) {
        await prisma.agentAction.create({
          data: {
            agentId: agent.id,
            target: input.target.toLowerCase(),
            token: addr.mockUsdc.toLowerCase(),
            amount,
            nonce,
            deadline: new Date(Number(deadline) * 1000),
            dataHash,
            status: "REJECTED",
            reason: err?.shortMessage ?? err?.message ?? "execution failed",
          },
        });
        activityHub.publish({
          id: crypto.randomUUID(),
          type: "ActionRejected",
          agentName: "TravelBot",
          message: `transaction rejected — policy violation`,
          amount: input.amount,
          status: "rejected",
          timestamp: new Date().toISOString(),
        });
        return { status: "REJECTED", reason: err?.shortMessage ?? String(err) };
      }
    };

    const result = await runTravelBotDemo(
      {
        agentId: agentId.toString(),
        policyId: policyId.toString(),
        ownerAddress: account.address,
        checkPolicy: async (input) =>
          simulatePolicy({
            policyId,
            target: input.target as Address,
            functionSelector: selector,
            token: input.token as Address,
            amount: input.amount,
          }),
        executePayment,
        searchServices: async () => [
          { id: "AA100", name: "AA100 SFO→JFK", price: "37.42" },
          { id: "UA220", name: "UA220 SFO→JFK", price: "41.00" },
          { id: "DL80", name: "DL80 SFO→JFK", price: "80.00" },
        ],
      },
      addr.mockFlightProvider,
      addr.mockUsdc,
    );

    // Explicitly record the $80 rejection attempt in activity (simulation-only)
    activityHub.publish({
      id: crypto.randomUUID(),
      type: "ActionRejected",
      agentName: "TravelBot",
      message: `transaction rejected — ${result.rejection.reason}`,
      amount: "80.00",
      status: "rejected",
      timestamp: new Date().toISOString(),
    });

    const bal = await publicClient.readContract({
      address: addr.agentVault,
      abi: vaultAbi,
      functionName: "balances",
      args: [account.address],
    });

    return {
      demo: "TravelBot",
      agentId: agentId.toString(),
      policyId: policyId.toString(),
      vaultBalance: formatUsdc(bal),
      steps: result.steps,
      purchase: result.purchase,
      rejection: result.rejection,
      policyReceipt: polReceipt.transactionHash,
      note: "Successful $37.42 purchase is on-chain; $80 attempt rejected by policy simulation / would revert on-chain.",
    };
  });
}
