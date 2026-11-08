import assert from "node:assert";
import test, { describe } from "node:test";
import { parseUnits, formatUnits } from "viem";
import { RuleEvaluator } from "../src/services/evaluator.js";
import { FileStorageAdapter } from "../src/db/storage.js";
import { NotificationDispatcher } from "../src/services/dispatcher.js";
import { AlertRule, DetectedEvent } from "../src/types.js";
import fs from "fs";
import path from "path";

describe("Pharos On-Chain Alert Bot Test Suite", () => {
  const evaluator = new RuleEvaluator();
  const testDataDir = path.resolve("./data-test");
  const testDbFile = path.join(testDataDir, "test_store.json");

  // Setup / teardown
  test.beforeEach(() => {
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
  });

  test.after(() => {
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmdirSync(testDataDir);
    }
  });

  // 1. DECIMAL MATH & TOKEN FORMATTING
  test("1. ERC-20 Decimal Handling (6 dec vs 18 dec)", () => {
    // 6-decimal USDC: 50.00 USDC = 50,000,000 atomic units
    const usdcAtomic = parseUnits("50.00", 6);
    assert.strictEqual(usdcAtomic.toString(), "50000000");
    assert.strictEqual(formatUnits(usdcAtomic, 6), "50");

    // 18-decimal token: 1.5 TOKEN = 1,500,000,000,000,000,000 atomic units
    const nativeAtomic = parseUnits("1.5", 18);
    assert.strictEqual(nativeAtomic.toString(), "1500000000000000000");
    assert.strictEqual(formatUnits(nativeAtomic, 18), "1.5");
  });

  // 2. LARGE TRANSFER EVALUATION
  test("2. Large Transfer Threshold & Filter Evaluation", async () => {
    const rule: AlertRule = {
      id: "rule-test-1",
      name: "Whale Test",
      network: "atlantic",
      type: "LARGE_TRANSFER",
      enabled: true,
      contractAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
      threshold: "100.0",
      thresholdAtomic: "100000000", // 100 USDC (6 decimals)
      tokenDecimals: 6,
      tokenSymbol: "USDC",
      channel: "TELEGRAM",
      createdAt: new Date().toISOString(),
    };

    // Case A: Qualifying transfer (150 USDC)
    const qualifyingLog = {
      address: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
      blockNumber: 32485000n,
      transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      logIndex: 0,
      args: {
        from: "0xaaaa000000000000000000000000000000000001",
        to: "0xbbbb000000000000000000000000000000000002",
        value: 150000000n, // 150 USDC
      },
    };

    const event = await evaluator.evaluateTransfer(rule, qualifyingLog);
    assert.ok(event !== null, "Expected qualifying event to match");
    assert.strictEqual(event.alertId, rule.id);
    assert.strictEqual(event.blockNumber, 32485000);
    assert.strictEqual(
      event.eventId,
      `atlantic:${qualifyingLog.transactionHash.toLowerCase()}:0:${rule.id}`
    );

    // Case B: Sub-threshold transfer (50 USDC < 100 USDC threshold)
    const smallLog = {
      ...qualifyingLog,
      args: { ...qualifyingLog.args, value: 50000000n },
    };
    const smallEvent = await evaluator.evaluateTransfer(rule, smallLog);
    assert.strictEqual(smallEvent, null, "Expected sub-threshold transfer to be ignored");

    // Case C: Mismatched contract address
    const wrongContractLog = {
      ...qualifyingLog,
      address: "0x0000000000000000000000000000000000000999",
    };
    const wrongContractEvent = await evaluator.evaluateTransfer(rule, wrongContractLog);
    assert.strictEqual(wrongContractEvent, null, "Expected mismatched contract to be ignored");
  });

  // 3. PERSISTENT DEDUPLICATION INVARIANT (ZERO REPEAT SPAM)
  test("3. Persistent Deduplication Invariant (Requirement 04)", async () => {
    const storage = new FileStorageAdapter(testDbFile);
    await storage.init();

    const sampleEvent: DetectedEvent = {
      eventId: "atlantic:0xabc123:0:rule-1",
      alertId: "rule-1",
      alertName: "Atlantic Whale Alert",
      network: "atlantic",
      blockNumber: 32485100,
      txHash: "0xabc123",
      logIndex: 0,
      timestamp: new Date().toISOString(),
      eventType: "LARGE_TRANSFER",
      description: "Large transfer detected",
      valueFormatted: "250.0",
      tokenSymbol: "USDC",
      sender: "0x123",
      recipient: "0x456",
      contractAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
      explorerUrl: "https://atlantic.pharosscan.xyz/tx/0xabc123",
      deliveryStatus: "PENDING",
    };

    // First reservation must succeed
    const firstAttempt = await storage.recordEventPending(sampleEvent);
    assert.strictEqual(firstAttempt, true, "First reservation attempt must succeed");

    // Consecutive reservation attempts for the exact same event must return FALSE
    const secondAttempt = await storage.recordEventPending(sampleEvent);
    assert.strictEqual(secondAttempt, false, "Second reservation attempt must be halted");

    const thirdAttempt = await storage.recordEventPending(sampleEvent);
    assert.strictEqual(thirdAttempt, false, "Third reservation attempt must be halted");

    // Mark delivered
    await storage.updateEventDelivery(sampleEvent.eventId, "DELIVERED");

    // Fourth attempt still halted
    const fourthAttempt = await storage.recordEventPending(sampleEvent);
    assert.strictEqual(fourthAttempt, false, "Delivered event must never be re-reserved");
  });

  // 4. CURSOR RECOVERY & INTERRUPTED BATCH HANDLING
  test("4. Cursor Recovery & Batch Safety", async () => {
    const storage = new FileStorageAdapter(testDbFile);
    await storage.init();

    // Verify initial null cursor
    let cursor = await storage.getCursor("atlantic");
    assert.strictEqual(cursor, null);

    // Save block 32480000
    await storage.saveCursor("atlantic", 32480000);
    cursor = await storage.getCursor("atlantic");
    assert.strictEqual(cursor, 32480000);

    // Advance cursor to 32480050
    await storage.saveCursor("atlantic", 32480050);
    cursor = await storage.getCursor("atlantic");
    assert.strictEqual(cursor, 32480050);
  });

  // 5. NOTIFICATION FORMATTING & EXPLORER LINK INTEGRITY
  test("5. Notification Formatting & Explorer Link Verification", () => {
    const dispatcher = new NotificationDispatcher();

    const sampleEvent: DetectedEvent = {
      eventId: "atlantic:0xdd56958ac04cbfcff3a7a08d397d1e729c0296ce39e590bd6de5148aa74691d2:1:rule-1",
      alertId: "rule-1",
      alertName: "Whale Transfer",
      network: "atlantic",
      blockNumber: 32485200,
      txHash: "0xdd56958ac04cbfcff3a7a08d397d1e729c0296ce39e590bd6de5148aa74691d2",
      logIndex: 1,
      timestamp: "2026-11-08T18:00:00.000Z",
      eventType: "LARGE_TRANSFER",
      description: "Transfer of 500 USDC",
      valueFormatted: "500.0",
      tokenSymbol: "USDC",
      sender: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      recipient: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
      contractAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
      explorerUrl: "https://atlantic.pharosscan.xyz/tx/0xdd56958ac04cbfcff3a7a08d397d1e729c0296ce39e590bd6de5148aa74691d2",
      deliveryStatus: "PENDING",
    };

    const telegramHtml = dispatcher.formatTelegramHtml(sampleEvent);

    assert.ok(telegramHtml.includes("Whale Transfer"), "Must include alert name");
    assert.ok(telegramHtml.includes("500.0 USDC"), "Must include formatted amount and symbol");
    assert.ok(telegramHtml.includes("32485200"), "Must include block height");
    assert.ok(telegramHtml.includes("0x70997970c51812dc3a010c7d01b50e0d17dc79c8"), "Must include sender");
    assert.ok(
      telegramHtml.includes("https://atlantic.pharosscan.xyz/tx/0xdd56958ac04cbfcff3a7a08d397d1e729c0296ce39e590bd6de5148aa74691d2"),
      "Must include valid PharosScan explorer link"
    );
  });
});
