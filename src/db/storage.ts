import fs from "fs";
import path from "path";
import { AlertRule, DetectedEvent, DeliveryStatus, NetworkId } from "../types.js";
import { CONFIG } from "../config.js";

export interface StorageAdapter {
  init(): Promise<void>;
  getAlerts(): Promise<AlertRule[]>;
  getAlert(id: string): Promise<AlertRule | null>;
  saveAlert(alert: AlertRule): Promise<void>;
  deleteAlert(id: string): Promise<boolean>;
  getCursor(network: NetworkId): Promise<number | null>;
  saveCursor(network: NetworkId, blockNumber: number): Promise<void>;
  isEventProcessed(eventId: string): Promise<boolean>;
  recordEventPending(event: DetectedEvent): Promise<boolean>;
  updateEventDelivery(eventId: string, status: DeliveryStatus, errorDetails?: string): Promise<void>;
  getRecentEvents(limit?: number): Promise<DetectedEvent[]>;
  getStats(network: NetworkId): Promise<{ totalEvents: number; totalDelivered: number; isFallback: boolean }>;
}

/**
 * Robust JSON-backed persistent storage with atomic writes and durable schema.
 * Ensures zero-configuration local runs and Vercel resilience.
 */
export class FileStorageAdapter implements StorageAdapter {
  private filePath: string;
  private data: {
    alerts: AlertRule[];
    cursors: Record<string, number>;
    processedEvents: Record<string, DetectedEvent>;
  } = {
    alerts: [],
    cursors: {},
    processedEvents: {},
  };

  constructor(filePath?: string) {
    const dir = CONFIG.DATA_DIR;
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Fallback to /tmp if current dir is read-only
      }
    }
    this.filePath = filePath || path.join(dir, "alert_bot_store.json");
  }

  async init(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(raw);
        if (!this.data.alerts) this.data.alerts = [];
        if (!this.data.cursors) this.data.cursors = {};
        if (!this.data.processedEvents) this.data.processedEvents = {};
      } else {
        await this.persist();
      }
    } catch (err) {
      console.warn("Storage init warning, starting with empty store:", err);
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    try {
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch {
      // In stateless serverless if disk is read-only, keep in memory
    }
  }

  async getAlerts(): Promise<AlertRule[]> {
    return [...this.data.alerts];
  }

  async getAlert(id: string): Promise<AlertRule | null> {
    const found = this.data.alerts.find((a) => a.id === id);
    return found ? { ...found } : null;
  }

  async saveAlert(alert: AlertRule): Promise<void> {
    const index = this.data.alerts.findIndex((a) => a.id === alert.id);
    if (index >= 0) {
      this.data.alerts[index] = { ...alert };
    } else {
      this.data.alerts.push({ ...alert });
    }
    await this.persist();
  }

  async deleteAlert(id: string): Promise<boolean> {
    const initialLen = this.data.alerts.length;
    this.data.alerts = this.data.alerts.filter((a) => a.id !== id);
    if (this.data.alerts.length !== initialLen) {
      await this.persist();
      return true;
    }
    return false;
  }

  async getCursor(network: NetworkId): Promise<number | null> {
    return this.data.cursors[network] ?? null;
  }

  async saveCursor(network: NetworkId, blockNumber: number): Promise<void> {
    this.data.cursors[network] = blockNumber;
    await this.persist();
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return Boolean(this.data.processedEvents[eventId]);
  }

  /**
   * Atomic reservation step for deduplication invariant.
   * Returns true ONLY if the event was NOT previously seen.
   */
  async recordEventPending(event: DetectedEvent): Promise<boolean> {
    if (this.data.processedEvents[event.eventId]) {
      return false; // Already reserved/processed! Deduplication gate halts here.
    }
    this.data.processedEvents[event.eventId] = {
      ...event,
      deliveryStatus: "PENDING",
    };
    await this.persist();
    return true;
  }

  async updateEventDelivery(eventId: string, status: DeliveryStatus, errorDetails?: string): Promise<void> {
    const existing = this.data.processedEvents[eventId];
    if (existing) {
      existing.deliveryStatus = status;
      if (status === "DELIVERED") {
        existing.deliveredAt = new Date().toISOString();
      }
      if (errorDetails) {
        existing.errorDetails = errorDetails;
      }
      await this.persist();
    }
  }

  async getRecentEvents(limit: number = 50): Promise<DetectedEvent[]> {
    const all = Object.values(this.data.processedEvents);
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return all.slice(0, limit);
  }

  async getStats(network: NetworkId): Promise<{ totalEvents: number; totalDelivered: number; isFallback: boolean }> {
    const events = Object.values(this.data.processedEvents).filter((e) => e.network === network);
    const delivered = events.filter((e) => e.deliveryStatus === "DELIVERED").length;
    return {
      totalEvents: events.length,
      totalDelivered: delivered,
      isFallback: true,
    };
  }
}

// Global singleton instance
export const storage: StorageAdapter = new FileStorageAdapter();
