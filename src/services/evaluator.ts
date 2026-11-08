import { AlertRule, DetectedEvent } from "../types.js";
import { rpcService } from "./rpc.js";

export class RuleEvaluator {
  /**
   * Evaluates an ERC-20 Transfer log against an active rule.
   */
  async evaluateTransfer(
    rule: AlertRule,
    log: {
      address: string;
      blockNumber: bigint;
      transactionHash: string;
      logIndex: number;
      args: {
        from?: string;
        to?: string;
        value?: bigint;
      };
    }
  ): Promise<DetectedEvent | null> {
    if (!rule.enabled || rule.type !== "LARGE_TRANSFER") {
      return null;
    }

    // 1. Contract Address Match
    if (rule.contractAddress && rule.contractAddress.toLowerCase() !== log.address.toLowerCase()) {
      return null;
    }

    // 2. Sender / Recipient Address Filter
    const fromAddr = (log.args.from || "").toLowerCase();
    const toAddr = (log.args.to || "").toLowerCase();

    if (rule.senderAddress && rule.senderAddress.toLowerCase() !== fromAddr) {
      return null;
    }
    if (rule.recipientAddress && rule.recipientAddress.toLowerCase() !== toAddr) {
      return null;
    }

    // 3. Amount / Threshold Comparison
    const rawValue = log.args.value || 0n;
    const requiredAtomic = BigInt(rule.thresholdAtomic || "0");

    if (rawValue < requiredAtomic) {
      return null; // Transfer below configured threshold
    }

    // 4. Token Decimals & Metadata (use cached metadata from rule if present, otherwise query RPC)
    const decimals = rule.tokenDecimals ?? (await rpcService.getTokenMetadata(rule.network, log.address)).decimals;
    const symbol = rule.tokenSymbol ?? (await rpcService.getTokenMetadata(rule.network, log.address)).symbol;
    const formattedAmount = rpcService.formatTokenValue(rawValue, decimals);

    // 5. Build Unique Composite Event ID
    const eventId = `${rule.network}:${log.transactionHash.toLowerCase()}:${log.logIndex}:${rule.id}`;

    return {
      eventId,
      alertId: rule.id,
      alertName: rule.name,
      network: rule.network,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      timestamp: new Date().toISOString(),
      eventType: "LARGE_TRANSFER",
      description: `Large transfer of ${formattedAmount} ${symbol} from ${fromAddr.slice(0, 8)}... to ${toAddr.slice(0, 8)}...`,
      valueFormatted: formattedAmount,
      tokenSymbol: symbol,
      sender: log.args.from || "0x",
      recipient: log.args.to || "0x",
      contractAddress: log.address,
      explorerUrl: rpcService.buildExplorerTxUrl(rule.network, log.transactionHash),
      deliveryStatus: "PENDING",
    };
  }

  /**
   * Evaluates contract activity or transaction-level alert.
   */
  async evaluateContractActivity(
    rule: AlertRule,
    tx: {
      hash: string;
      blockNumber: bigint;
      from: string;
      to: string | null;
      input: string;
      value: bigint;
    }
  ): Promise<DetectedEvent | null> {
    if (!rule.enabled || rule.type !== "CONTRACT_CALL") {
      return null;
    }

    if (!tx.to) return null;

    if (rule.contractAddress && rule.contractAddress.toLowerCase() !== tx.to.toLowerCase()) {
      return null;
    }

    if (rule.senderAddress && rule.senderAddress.toLowerCase() !== tx.from.toLowerCase()) {
      return null;
    }

    if (rule.methodSelector) {
      const selector = rule.methodSelector.toLowerCase();
      if (!tx.input.toLowerCase().startsWith(selector)) {
        return null;
      }
    }

    const eventId = `${rule.network}:${tx.hash.toLowerCase()}:tx:${rule.id}`;

    return {
      eventId,
      alertId: rule.id,
      alertName: rule.name,
      network: rule.network,
      blockNumber: Number(tx.blockNumber),
      txHash: tx.hash,
      logIndex: 0,
      timestamp: new Date().toISOString(),
      eventType: "CONTRACT_CALL",
      description: `Target contract interaction on ${tx.to.slice(0, 8)}... by ${tx.from.slice(0, 8)}...`,
      valueFormatted: rpcService.formatTokenValue(tx.value, 18),
      tokenSymbol: "PHAROS",
      sender: tx.from,
      recipient: tx.to,
      contractAddress: tx.to,
      explorerUrl: rpcService.buildExplorerTxUrl(rule.network, tx.hash),
      deliveryStatus: "PENDING",
    };
  }
}

export const evaluator = new RuleEvaluator();
