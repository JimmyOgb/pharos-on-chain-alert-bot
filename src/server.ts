import cors from "cors";
import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { parseUnits } from "viem";
import { CONFIG, NETWORKS } from "./config.js";
import { storage } from "./db/storage.js";
import { dispatcher } from "./services/dispatcher.js";
import { rpcService } from "./services/rpc.js";
import { scanner } from "./services/scanner.js";
import { AlertRule, NetworkId } from "./types.js";
import { DASHBOARD_HTML, DASHBOARD_CSS, DASHBOARD_JS } from "./views.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Explicit Static and Dashboard Routes (Guaranteed 100% serverless safe without filesystem dependencies)
app.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(DASHBOARD_HTML);
});

app.get("/style.css", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/css; charset=utf-8");
  res.send(DASHBOARD_CSS);
});

app.get("/app.js", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.send(DASHBOARD_JS);
});

// Serve static frontend files fallback
try {
  const publicDir = path.resolve(__dirname, "../public");
  app.use(express.static(publicDir));
} catch {
  // Ignore in serverless
}

// Initialize storage on startup
storage.init().catch((err) => console.error("Storage initialization error:", err));

// ============================================================================
// 1. SYSTEM HEALTH & DIAGNOSTICS
// ============================================================================
app.get("/health", async (req: Request, res: Response) => {
  try {
    const atlanticBlock = await rpcService.getLatestBlockNumber("atlantic").catch(() => null);
    const pacificBlock = await rpcService.getLatestBlockNumber("pacific").catch(() => null);

    const alerts = await storage.getAlerts();
    const cursor = await storage.getCursor("atlantic");

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      networks: {
        atlantic: {
          chainId: NETWORKS.atlantic.chainId,
          rpcUrl: NETWORKS.atlantic.rpcUrl,
          latestBlock: atlanticBlock !== null ? Number(atlanticBlock) : null,
          lastMonitoredBlock: cursor,
          status: atlanticBlock !== null ? "ONLINE" : "OFFLINE",
        },
        pacific: {
          chainId: NETWORKS.pacific.chainId,
          rpcUrl: NETWORKS.pacific.rpcUrl,
          latestBlock: pacificBlock !== null ? Number(pacificBlock) : null,
          status: pacificBlock !== null ? "ONLINE" : "OFFLINE",
        },
      },
      activeAlertsCount: alerts.filter((a) => a.enabled).length,
      storageType: "durable_file_storage",
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ============================================================================
// 2. DASHBOARD LIVE TELEMETRY
// ============================================================================
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    const network = (req.query.network as NetworkId) || "atlantic";
    const netConfig = NETWORKS[network] || NETWORKS.atlantic;

    const latestBlockBig = await rpcService.getLatestBlockNumber(network).catch(() => 0n);
    const latestBlock = Number(latestBlockBig);
    const cursor = (await storage.getCursor(network)) || latestBlock;

    const alerts = await storage.getAlerts();
    const activeAlerts = alerts.filter((a) => a.enabled && a.network === network);

    const stats = await storage.getStats(network);
    const recentEvents = await storage.getRecentEvents(10);

    res.json({
      network,
      networkName: netConfig.name,
      chainId: netConfig.chainId,
      caip2: netConfig.caip2,
      explorerUrl: netConfig.explorerUrl,
      latestBlock,
      lastMonitoredBlock: cursor,
      blocksRemaining: Math.max(0, latestBlock - cursor),
      activeAlertsCount: activeAlerts.length,
      totalAlertsCount: alerts.length,
      totalEventsDetected: stats.totalEvents,
      totalDelivered: stats.totalDelivered,
      rpcStatus: latestBlock > 0 ? "ONLINE" : "DEGRADED",
      channelConfigured: {
        telegram: Boolean(CONFIG.TELEGRAM_BOT_TOKEN),
        discord: Boolean(CONFIG.DISCORD_WEBHOOK_URL),
      },
      recentEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 3. ALERT RULES MANAGEMENT
// ============================================================================
app.get("/api/alerts", async (_req: Request, res: Response) => {
  try {
    const alerts = await storage.getAlerts();
    res.json({ alerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/alerts", async (req: Request, res: Response) => {
  try {
    const {
      name,
      network = "atlantic",
      type = "LARGE_TRANSFER",
      contractAddress,
      threshold = "100",
      senderAddress,
      recipientAddress,
      methodSelector,
      channel = "TELEGRAM",
      targetChatId,
    } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Alert name is required." });
    }

    if (!NETWORKS[network as NetworkId]) {
      return res.status(400).json({ error: `Invalid network: ${network}. Choose 'atlantic' or 'pacific'.` });
    }

    // Determine decimals and atomic threshold
    let decimals = 18;
    let symbol = "TOKEN";

    if (contractAddress && contractAddress.startsWith("0x")) {
      const metadata = await rpcService.getTokenMetadata(network as NetworkId, contractAddress);
      decimals = metadata.decimals;
      symbol = metadata.symbol;
    } else if (network === "atlantic") {
      // Default to Test USDC if not specified
      decimals = 6;
      symbol = "USDC";
    }

    let thresholdAtomic = "0";
    try {
      thresholdAtomic = parseUnits(threshold.toString(), decimals).toString();
    } catch {
      thresholdAtomic = "0";
    }

    const newAlert: AlertRule = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      network: network as NetworkId,
      type,
      enabled: true,
      contractAddress: contractAddress?.toLowerCase().trim(),
      threshold: threshold.toString(),
      thresholdAtomic,
      tokenDecimals: decimals,
      tokenSymbol: symbol,
      senderAddress: senderAddress ? senderAddress.toLowerCase().trim() : undefined,
      recipientAddress: recipientAddress ? recipientAddress.toLowerCase().trim() : undefined,
      methodSelector: methodSelector ? methodSelector.toLowerCase().trim() : undefined,
      channel,
      targetChatId: targetChatId?.trim(),
      createdAt: new Date().toISOString(),
    };

    await storage.saveAlert(newAlert);
    res.status(201).json({ message: "Alert rule created successfully.", alert: newAlert });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/alerts/:id/toggle", async (req: Request, res: Response) => {
  try {
    const alert = await storage.getAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found." });
    }
    alert.enabled = !alert.enabled;
    await storage.saveAlert(alert);
    res.json({ message: "Alert state toggled.", alert });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/alerts/:id", async (req: Request, res: Response) => {
  try {
    const success = await storage.deleteAlert(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Alert not found." });
    }
    res.json({ message: "Alert deleted." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 4. EVENT HISTORY & DEDUPLICATION AUDIT
// ============================================================================
app.get("/api/events", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const events = await storage.getRecentEvents(limit);
    res.json({ count: events.length, events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 5. MONITORING SCANNER EXECUTION (VERCEL CRON & INTERACTIVE TRIGGER)
// ============================================================================
app.all("/api/monitor", async (req: Request, res: Response) => {
  try {
    const network = (req.query.network as NetworkId) || (req.body?.network as NetworkId) || "atlantic";

    // Optional Cron Secret Verification for external cron providers
    if (CONFIG.CRON_SECRET) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${CONFIG.CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized cron invocation." });
      }
    }

    const report = await scanner.runScan(network);
    res.json({
      status: "success",
      report,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.message,
    });
  }
});

// ============================================================================
// 6. CHANNEL TEST PING
// ============================================================================
app.post("/api/test-notify", async (req: Request, res: Response) => {
  try {
    const { channel = "TELEGRAM", target } = req.body;
    const result = await dispatcher.sendTestPing(channel, target);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export app for Vercel serverless / local start
export { app };

if (process.env.NODE_ENV !== "test") {
  app.listen(CONFIG.PORT, () => {
    console.log(`=======================================================`);
    console.log(`Pharos On-Chain Alert Bot live on http://localhost:${CONFIG.PORT}`);
    console.log(`Connected Network: ${NETWORKS[CONFIG.DEFAULT_NETWORK].name}`);
    console.log(`RPC Endpoint: ${NETWORKS[CONFIG.DEFAULT_NETWORK].rpcUrl}`);
    console.log(`Explorer: ${NETWORKS[CONFIG.DEFAULT_NETWORK].explorerUrl}`);
    console.log(`=======================================================`);
  });
}
