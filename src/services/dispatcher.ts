import { CONFIG } from "../config.js";
import { DetectedEvent } from "../types.js";

export interface DispatchResult {
  success: boolean;
  channel: string;
  statusCode?: number;
  messageId?: string;
  error?: string;
}

export class NotificationDispatcher {
  async dispatch(event: DetectedEvent, customTarget?: string): Promise<DispatchResult> {
    const channel = customTarget?.startsWith("https://discord.com") ? "DISCORD" : "TELEGRAM";

    if (channel === "DISCORD" || customTarget?.startsWith("https://discord.com")) {
      const webhookUrl = customTarget || CONFIG.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        return { success: false, channel: "DISCORD", error: "Discord webhook URL not configured." };
      }
      return await this.sendDiscordWebhook(webhookUrl, event);
    }

    // Default to Telegram
    const botToken = CONFIG.TELEGRAM_BOT_TOKEN;
    const chatId = customTarget || CONFIG.TELEGRAM_DEFAULT_CHAT_ID;

    if (!botToken || !chatId) {
      // If neither is set, log cleanly without throwing, indicating configuration required
      return {
        success: false,
        channel: "TELEGRAM",
        error: "Telegram bot token or chat ID not configured in environment.",
      };
    }

    return await this.sendTelegramMessage(botToken, chatId, event);
  }

  async sendTelegramMessage(botToken: string, chatId: string, event: DetectedEvent): Promise<DispatchResult> {
    const text = this.formatTelegramHtml(event);
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; description?: string; result?: { message_id?: number } };

      if (response.ok && data.ok) {
        return {
          success: true,
          channel: "TELEGRAM",
          statusCode: response.status,
          messageId: data.result?.message_id?.toString(),
        };
      }

      // Safe error masking without leaking token
      return {
        success: false,
        channel: "TELEGRAM",
        statusCode: response.status,
        error: data.description || `HTTP ${response.status} failed`,
      };
    } catch (err: any) {
      return {
        success: false,
        channel: "TELEGRAM",
        error: err.message || "Network error dispatching Telegram alert",
      };
    }
  }

  async sendDiscordWebhook(webhookUrl: string, event: DetectedEvent): Promise<DispatchResult> {
    const payload = {
      username: "Pharos On-Chain Alert Bot",
      avatar_url: "https://atlantic.pharosscan.xyz/favicon.ico",
      embeds: [
        {
          title: `🚨 ${event.alertName} Detected`,
          color: 0x06b6d4, // Cyan
          description: event.description,
          fields: [
            { name: "Network", value: event.network.toUpperCase(), inline: true },
            { name: "Value", value: `${event.valueFormatted} ${event.tokenSymbol}`, inline: true },
            { name: "Block Number", value: event.blockNumber.toString(), inline: true },
            { name: "Sender", value: `\`${event.sender}\``, inline: false },
            { name: "Recipient", value: `\`${event.recipient}\``, inline: false },
            { name: "Transaction Hash", value: `\`${event.txHash}\``, inline: false },
          ],
          url: event.explorerUrl,
          footer: { text: "Pharos Blockchain Real-Time Monitoring" },
          timestamp: new Date(event.timestamp).toISOString(),
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 204 || response.status === 200) {
        return {
          success: true,
          channel: "DISCORD",
          statusCode: response.status,
        };
      }

      return {
        success: false,
        channel: "DISCORD",
        statusCode: response.status,
        error: `Discord webhook rejected with HTTP ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        channel: "DISCORD",
        error: err.message || "Network error dispatching Discord webhook",
      };
    }
  }

  formatTelegramHtml(event: DetectedEvent): string {
    return [
      `🚨 <b>Pharos On-Chain Alert: ${escapeHtml(event.alertName)}</b>`,
      ``,
      `<b>Network:</b> ${escapeHtml(event.network.toUpperCase())}`,
      `<b>Activity:</b> ${escapeHtml(event.description)}`,
      `<b>Amount:</b> <code>${escapeHtml(event.valueFormatted)} ${escapeHtml(event.tokenSymbol)}</code>`,
      `<b>Block Height:</b> <code>${event.blockNumber}</code>`,
      `<b>Sender:</b> <code>${escapeHtml(event.sender)}</code>`,
      `<b>Recipient:</b> <code>${escapeHtml(event.recipient)}</code>`,
      ``,
      `🔗 <a href="${event.explorerUrl}">View Transaction on PharosScan</a>`,
    ].join("\n");
  }

  async sendTestPing(channel: "TELEGRAM" | "DISCORD", target: string): Promise<DispatchResult> {
    const testEvent: DetectedEvent = {
      eventId: `test:${Date.now()}`,
      alertId: "test-alert",
      alertName: "Test Connectivity Alert",
      network: "atlantic",
      blockNumber: 32485000,
      txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      logIndex: 0,
      timestamp: new Date().toISOString(),
      eventType: "CONNECTIVITY_VERIFICATION",
      description: "Automated test notification from Pharos On-Chain Alert Bot",
      valueFormatted: "100.0",
      tokenSymbol: "USDC",
      sender: "0x0000000000000000000000000000000000000000",
      recipient: "0x0000000000000000000000000000000000000000",
      contractAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
      explorerUrl: "https://atlantic.pharosscan.xyz",
      deliveryStatus: "PENDING",
    };

    if (channel === "DISCORD") {
      return await this.sendDiscordWebhook(target, testEvent);
    }
    return await this.sendTelegramMessage(CONFIG.TELEGRAM_BOT_TOKEN, target, testEvent);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const dispatcher = new NotificationDispatcher();
