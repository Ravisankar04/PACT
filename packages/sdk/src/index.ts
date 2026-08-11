import {
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  encodeFunctionData,
  keccak256,
  toHex,
} from "viem";
import { AGENT_ACTION_TYPES, type PactReceipt, parseUsdc } from "@pact/shared";

export interface PactAgentConfig {
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, Account>;
  vaultAddress: Address;
  agentId: bigint;
  policyId: bigint;
  token: Address;
  chainId: number;
}

export interface ExecuteParams {
  target: Address;
  amount: string | bigint;
  data?: Hex;
  action?: { signature: Hex; args: readonly unknown[] };
  nonce?: bigint;
  deadlineSeconds?: number;
}

const vaultAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "action",
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "policyId", type: "uint256" },
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "dataHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "data", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [
      { name: "result", type: "bytes" },
      { name: "receiptId", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "ActionExecuted",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "policyId", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
      { name: "receiptId", type: "bytes32", indexed: false },
      { name: "receiptHash", type: "bytes32", indexed: false },
      { name: "result", type: "bytes", indexed: false },
    ],
  },
] as const;

/**
 * PactAgent SDK — validates, EIP-712 signs, submits, waits, returns receipt.
 * Never bypasses on-chain policy enforcement.
 */
export class PactAgent {
  constructor(private readonly config: PactAgentConfig) {}

  async execute(params: ExecuteParams): Promise<PactReceipt> {
    const amount = typeof params.amount === "string" ? parseUsdc(params.amount) : params.amount;
    const data: Hex =
      params.data ??
      (params.action
        ? encodeFunctionData({
            abi: [
              {
                type: "function",
                name: "purchaseFlight",
                inputs: [
                  { name: "flightId", type: "string" },
                  { name: "amount", type: "uint256" },
                ],
                outputs: [{ type: "bool" }],
              },
            ],
            functionName: "purchaseFlight",
            args: params.action.args as [string, bigint],
          })
        : "0x");

    const nonce = params.nonce ?? BigInt(Date.now());
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? 3600));
    const dataHash = keccak256(data);

    const message = {
      agentId: this.config.agentId,
      policyId: this.config.policyId,
      target: params.target,
      value: 0n,
      token: this.config.token,
      amount,
      dataHash,
      nonce,
      deadline,
    };

    const signature = await this.config.walletClient.signTypedData({
      account: this.config.walletClient.account,
      domain: {
        name: "PACT AgentVault",
        version: "1",
        chainId: this.config.chainId,
        verifyingContract: this.config.vaultAddress,
      },
      types: AGENT_ACTION_TYPES,
      primaryType: "AgentAction",
      message,
    });

    const hash = await this.config.walletClient.writeContract({
      address: this.config.vaultAddress,
      abi: vaultAbi,
      functionName: "execute",
      args: [message, data, signature],
      account: this.config.walletClient.account,
      chain: this.config.walletClient.chain,
    });

    const receipt = await this.config.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new PactTxError("TRANSACTION FAILED", "The transaction was rejected by the blockchain.", hash);
    }

    let receiptId = toHex(0, { size: 32 }) as Hex;
    let receiptHash = toHex(0, { size: 32 }) as Hex;
    for (const log of receipt.logs) {
      // Best-effort decode of receiptId from topics/data length
      if (log.address.toLowerCase() === this.config.vaultAddress.toLowerCase() && log.data.length >= 66) {
        // data packs non-indexed fields; receiptId is 3rd 32-byte word after token, amount, nonce... rough parse below via getLogs preferred
      }
    }

    const logs = await this.config.publicClient.getContractEvents({
      address: this.config.vaultAddress,
      abi: vaultAbi,
      eventName: "ActionExecuted",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    const match = logs.find((l) => l.transactionHash === hash);
    if (match) {
      receiptId = match.args.receiptId as Hex;
      receiptHash = match.args.receiptHash as Hex;
    }

    return {
      receiptId,
      receiptHash,
      agentId: this.config.agentId.toString(),
      policyId: this.config.policyId.toString(),
      target: params.target,
      token: this.config.token,
      amount: amount.toString(),
      nonce: nonce.toString(),
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      timestamp: Math.floor(Date.now() / 1000),
      status: "CONFIRMED",
    };
  }
}

export class PactTxError extends Error {
  constructor(
    public readonly title: string,
    message: string,
    public readonly hash?: Hex,
  ) {
    super(message);
    this.name = "PactTxError";
  }
}

export { AGENT_ACTION_TYPES };
