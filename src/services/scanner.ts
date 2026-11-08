import { CONFIG, NETWORKS } from "../config.js";
import { storage } from "../db/storage.js";
import { AlertRule, DetectedEvent, NetworkId } from "../types.js";
import { dispatcher } from "./dispatcher.js";
import { evaluator } from "./evaluator.js";
import { rpcService, TRANSFER_EVENT_ABI } from "./rpc.js";

export interface ScanReport {
  timestamp: string;
  network: NetworkId;
  fromBlock: number;
  toBlock: number;
  latestBlock: number;
  activeRulesCount: number;
  logsScanned: number;
  qualifyingEvents: number;
  deliveredCount: number;
  deduplicatedCount: number;
  failedCount: number;
  durationMs: number;
}

export class BlockchainScanner {
  private isScanning = false;

  async runScan(targetNetwork: NetworkId = "atlantic"): Promise<ScanReport> {
    if (this.isScanning) {
      throw new Error("A monitoring cycle is already in progress. Overlapping run prevented.");
    }

    this.isScanning = true;
    const startTime = Date.now();

    try {
      await storage.init();
      const allAlerts = await storage.getAlerts();
      const activeRules = allAlerts.filter((a) => a.enabled && a.network === targetNetwork);

      const client = rpcService.getClient(targetNetwork);
      const latestBlockBig = await client.getBlockNumber();
      const latestBlock = Number(latestBlockBig);

      let cursor = await storage.getCursor(targetNetwork);
      if (cursor === null || cursor <= 0) {
        // Initialize cursor safely 5 blocks prior to head on first run
        cursor = Math.max(0, latestBlock - 5);
        await storage.saveCursor(targetNetwork, cursor);
      }

      if (cursor >= latestBlock) {
        return {
          timestamp: new Date().toISOString(),
          network: targetNetwork,
          fromBlock: cursor,
          toBlock: cursor,
          latestBlock,
          activeRulesCount: activeRules.length,
          logsScanned: 0,
          qualifyingEvents: 0,
          deliveredCount: 0,
          deduplicatedCount: 0,
          failedCount: 0,
          durationMs: Date.now() - startTime,
        };
      }

      const fromBlock = cursor + 1;
      const toBlock = Math.min(latestBlock, cursor + CONFIG.MAX_BLOCK_CHUNK);

      let logsScanned = 0;
      let qualifyingEvents = 0;
      let deliveredCount = 0;
      let deduplicatedCount = 0;
      let failedCount = 0;

      // Scan ERC-20 Transfer logs if any active rules exist
      if (activeRules.length > 0) {
        try {
          const logs = await client.getLogs({
            event: TRANSFER_EVENT_ABI,
            fromBlock: BigInt(fromBlock),
            toBlock: BigInt(toBlock),
          });

          logsScanned = logs.length;

          for (const log of logs) {
            for (const rule of activeRules) {
              const matchedEvent = await evaluator.evaluateTransfer(rule, {
                address: log.address,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                args: log.args as any,
              });

              if (matchedEvent) {
                qualifyingEvents++;

                // Phase 1: Atomic Reservation (Deduplication Gate)
                const reserved = await storage.recordEventPending(matchedEvent);
                if (!reserved) {
                  deduplicatedCount++;
                  continue; // Already processed! Invariant holds.
                }

                // Phase 2: Verified Channel Delivery
                const result = await dispatcher.dispatch(matchedEvent, rule.targetChatId);
                if (result.success) {
                  deliveredCount++;
                  await storage.updateEventDelivery(matchedEvent.eventId, "DELIVERED");
                } else {
                  failedCount++;
                  await storage.updateEventDelivery(matchedEvent.eventId, "FAILED", result.error);
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error querying logs for ${targetNetwork} [${fromBlock} -> ${toBlock}]:`, err);
        }
      }

      // Advance cursor safely only after all batch operations conclude
      await storage.saveCursor(targetNetwork, toBlock);

      return {
        timestamp: new Date().toISOString(),
        network: targetNetwork,
        fromBlock,
        toBlock,
        latestBlock,
        activeRulesCount: activeRules.length,
        logsScanned,
        qualifyingEvents,
        deliveredCount,
        deduplicatedCount,
        failedCount,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isScanning = false;
    }
  }
}

export const scanner = new BlockchainScanner();
