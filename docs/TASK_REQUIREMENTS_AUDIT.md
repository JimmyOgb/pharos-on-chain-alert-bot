# Task Requirements Audit — Pharos On-Chain Alert Bot

**Target Task:** [Pharos Agent Arena — On-Chain Alert Bot](https://pharos-agent-arena.vercel.app/tasks/on-chain-alert-bot)  
**Category:** Easy / Trading / Monitoring  
**Points:** 50 Base Points + 50 Video Points (Maximum 100 Points)  
**Audit Date:** 2026-11-08  
**Project Workspace:** `C:\Users\NO GO NO\pharosbuild\skills\pharos-on-chain-alert-bot`  
**Target Repository:** `https://github.com/JimmyOgb/pharos-on-chain-alert-bot`  

---

## 1. Official Task Specification & Reviewer Scoring Criteria

From the official Arena task page:

> **What you'll build:**  
> "A bot that watches Pharos for a condition you choose, such as a price crossing a threshold, a large transfer, or a specific contract call, and notifies you when it happens."

### Mandatory Reviewer Scoring Checklist

| ID | Criterion | Description & Scoring Impact | Project Fulfillment Strategy |
| :---: | :--- | :--- | :--- |
| **01** | **At least one configurable alert condition** | User can define parameters (network, contract address, threshold value, method selector, etc.) rather than hardcoded logic. | Support dynamic configuration for: (1) Large ERC-20 transfers with custom token/amount/decimals, (2) Specific contract calls/activity, and (3) Price threshold monitoring when a verifiable pool/oracle exists. |
| **02** | **Delivers alerts to a real channel: Telegram, Discord or similar** | Real notification delivery via genuine external API; no mock/console-only alerts. | Implement genuine Telegram Bot API delivery (and Discord Webhook support) with HTTP response verification, status tracking, and retry logic. |
| **03** | **Each alert includes what happened, the value, and a tx or explorer link** | Transparent message formatting with exact trigger data, formatted amounts, block number, and live PharosScan explorer link. | Standardized alert template including: Event Type, Monitored Target, Formatted Value (with correct decimals), Block Height, Transaction Hash, and clickable `https://atlantic.pharosscan.xyz/tx/<hash>` URL. |
| **04** | **No repeat spam for the same event** | Strict, durable deduplication across polling intervals, restarts, and concurrent executions. | Persistent event identity (`${chainId}:${txHash}:${logIndex}`) stored in a durable database with unique constraints. In-memory or localStorage-only tracking is strictly disallowed. |

---

## 2. Submission Format & Verification Criteria

According to the official Arena specification:
- **Proof Link:** "A proof link reviewers can open — a share link from ai.pharos.xyz, a tx hash on the explorer, or a deployed demo."
  - *Project Plan:* Provide a live production Vercel deployment URL (`https://pharos-on-chain-alert-bot.vercel.app` or similar) with an interactive dashboard, health endpoints, and live monitoring status.
- **Repository Link:** "A repo link if you wrote code."
  - *Project Plan:* New public GitHub repository under `JimmyOgb/pharos-on-chain-alert-bot`.
- **Walkthrough Video:** "Optional: a video walking through the build for +50 points."
  - *Project Plan:* 3–5 minute high-definition walkthrough using the local `live-demo-video-generator` workflow showing real alert configuration, live monitoring cycle, real notification delivery, and deduplication verification.

---

## 3. Network Architecture & Supported Chains

The bot must natively support genuine Pharos infrastructure:

| Parameter | Atlantic Testnet (Primary for Testing) | Pacific Mainnet (Production Option) |
| :--- | :--- | :--- |
| **Chain ID** | `688689` (`0xa8231`) | `1672` (`0x688`) |
| **CAIP-2 Identifier** | `eip155:688689` | `eip155:1672` |
| **Public JSON-RPC Endpoint** | `https://atlantic.dplabs-internal.com` | `https://rpc.pharos.xyz` |
| **Block Explorer** | `https://atlantic.pharosscan.xyz` | `https://pharosscan.xyz` |
| **Tx URL Format** | `https://atlantic.pharosscan.xyz/tx/{txHash}` | `https://pharosscan.xyz/tx/{txHash}` |
| **Address URL Format** | `https://atlantic.pharosscan.xyz/address/{address}` | `https://pharosscan.xyz/address/{address}` |
| **Standard Settlement Asset** | Test USDC (`0xcfc8330f4bcab529c625d12781b1c19466a9fc8b`, 6 dec) | Native PHAROS / Native USDC |

---

## 4. RPC Methods & Event Polling Capabilities

1. **Block Height Tracking:**
   - `eth_blockNumber`: Returns the current canonical block number.
2. **ERC-20 Event Monitoring:**
   - `eth_getLogs`:
     - Filter by `fromBlock` and `toBlock`.
     - Filter by `address` (ERC-20 token address).
     - Filter by topic `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` (Transfer event).
     - Extract `sender = topics[1]`, `recipient = topics[2]`, `value = data`.
     - Dynamically query token `decimals()` and `symbol()` via `eth_call` to prevent incorrect 18-decimal assumptions.
3. **Contract Activity Monitoring:**
   - Transaction receipt scanning via `eth_getBlockByNumber` (with full transaction objects) or `eth_getLogs` for specific contract event signatures.
4. **WebSocket vs HTTP Polling:**
   - The public Pharos endpoints are standard HTTPS JSON-RPC endpoints. While WebSockets may exist in internal nodes, standard serverless hosting (Vercel) cannot maintain long-lived stateful TCP/WebSocket connections.
   - Therefore, a durable **cursor-based HTTP polling architecture** (`fromBlock -> toBlock` with persisted cursor) is required for reliable, serverless execution.

---

## 5. Price Threshold & Oracle Feeds Analysis

- **Authenticity Boundary:** Never manufacture or fabricate price feeds.
- If an official DEX pool (Uniswap v2/v3 fork) or Chainlink-compatible oracle feed is verified on Atlantic Testnet or Pacific Mainnet, price alert monitoring can be enabled with documented pool reserves, decimal math, and freshness timestamps.
- If no active price oracle exists on Atlantic Testnet, this limitation will be explicitly disclosed, and the primary verified alert engines (Large ERC-20 Transfers and Contract Activity) will take precedence without fake data.

---

## 6. Implementation Implications & Risk Mitigations

| Risk | Cause | Mitigation Strategy |
| :--- | :--- | :--- |
| **Missed Events** | Serverless function timeout or interval gap | Durable block cursor stored in database. Poller queries `lastMonitoredBlock + 1` to `min(currentBlock, lastMonitoredBlock + maxBatch)`. |
| **Duplicate Notifications** | Overlapping scheduled runs or network retries | Database uniqueness constraint on `${chainId}:${txHash}:${logIndex}`. Check before and insert atomically with delivery record. |
| **RPC Rate Limiting** | Frequent polling or large block ranges | Limit chunk size to 50–100 blocks per poll; implement exponential backoff; respect HTTP 429. |
| **Secret Exposure** | Committing bot tokens or webhook URLs | All sensitive credentials stored in environment variables (`TELEGRAM_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `DATABASE_URL`); never rendered in frontend or client JSON. |

---

## 7. Audit Sign-Off

The requirements are unambiguous and actionable. The project will now proceed to **Phase 2 — Architecture and Cost Audit**.
