# Architecture & Cost Audit — Pharos On-Chain Alert Bot

**Project:** Pharos On-Chain Alert Bot  
**Audit Date:** 2026-11-08  
**Workspace:** `C:\Users\NO GO NO\pharosbuild\skills\pharos-on-chain-alert-bot`  
**Host Target:** Vercel Serverless (`https://pharos-on-chain-alert-bot.vercel.app`)  
**Target Repository:** `https://github.com/JimmyOgb/pharos-on-chain-alert-bot`  

---

## 1. Environment & Tooling Verification

| Component | Detected Version | Status / Notes |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Pro | Native local development |
| **Node.js** | `v24.15.0` | Latest LTS / Current |
| **npm** | `11.12.1` | Modern package manager |
| **Git** | `2.55.0.windows.2` | Clean repository management |
| **GitHub Identity** | `JimmyOgb` (`Jiangy4545@gmail.com`) | Authenticated for public repository creation |
| **Vercel CLI** | `62.2.0 (native)` | Authenticated as `jiangy4545-9170` |
| **Pharos Skills** | `agy-customizations`, `live-demo-video-generator` | Verified locally in Antigravity |

---

## 2. $0-First Architectural Design

The Pharos On-Chain Alert Bot operates as an autonomous, serverless monitoring system designed to satisfy all 4 Arena criteria without requiring paid infrastructure.

```
┌─────────────────────────────────────────────────────────────┐
│                 Pharos Blockchain Networks                   │
│   Atlantic Testnet (688689)  │   Pacific Mainnet (1672)     │
│   https://atlantic.dplabs-internal.com │ https://rpc.pharos.xyz │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Pharos Monitoring Engine (Vercel Serverless)     │
│                                                             │
│  1. Block Scanner: eth_blockNumber + Cursor Advancement     │
│  2. Event Ingestion: eth_getLogs (Transfer & Contract Sigs) │
│  3. Token Decimals Engine: eth_call decimals() + Symbol     │
│  4. Condition Evaluator: Threshold & Filter Matching        │
│  5. Deduplication Gate: Primary Key on Unique Event ID      │
│  6. Dispatcher: Rate-limited Notification Delivery          │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Durable Persistence     │ │    External Delivery APIs   │
│  - Alert Configurations      │ │  - Telegram Bot API (Live) │
│  - Monitoring Cursors        │ │  - Discord Webhooks (Live) │
│  - Processed Events (Unique) │ │  - PharosScan Verification │
│  - Delivery Logs & Retries   │ └────────────────────────────┘
│  (PostgreSQL / Neon / SQLite)│
└──────────────────────────────┘
```

---

## 3. Blockchain Monitoring Strategy

### A. Polling vs Streaming
- Vercel functions are stateless and ephemeral; WebSockets cannot be maintained persistently across function invocations.
- The bot employs a **durable, cursor-based HTTP JSON-RPC polling model**:
  1. Reads `last_processed_block` from the persistent database.
  2. Queries `eth_blockNumber` from the target Pharos RPC.
  3. If `currentBlock > last_processed_block`, scans blocks in safe chunks:
     $$\text{toBlock} = \min(\text{currentBlock}, \text{last\_processed\_block} + \text{MAX\_CHUNK})$$
     where $\text{MAX\_CHUNK} = 50$ blocks to prevent RPC timeouts and payload limits.
  4. Scans logs with `eth_getLogs` for registered ERC-20 token contracts and event topics.
  5. Advances and commits the database cursor only after successfully processing and recording all qualifying events in that batch.

### B. Decimals & Token Metadata Discovery
- Never assumes standard 18 decimals.
- Queries `decimals()` and `symbol()` directly on the contract via `eth_call`.
- Caches token metadata in-memory and in the database to avoid redundant RPC calls.

---

## 4. Persistent Deduplication & Database Architecture

To strictly satisfy **Requirement 04 ("No repeat spam for the same event")**, deduplication is enforced at the database level:

### Composite Event Identity
$$\text{Event ID} = \text{network} + \text{":"} + \text{txHash} + \text{":"} + \text{logIndex} + \text{":"} + \text{alertId}$$

### Schema Design
1. **`alerts`**: Stores configured conditions (name, network, type, contract address, threshold, sender/recipient filters, destination channel, enabled).
2. **`monitoring_cursor`**: Stores `(network, last_processed_block, updated_at)`.
3. **`processed_events`**:
   - `id` (VARCHAR PRIMARY KEY, composite Event ID).
   - `alert_id` (FOREIGN KEY).
   - `tx_hash` (VARCHAR).
   - `block_number` (BIGINT).
   - `log_index` (INT).
   - `delivery_status` (PENDING, DELIVERED, FAILED).
   - `delivered_at` (TIMESTAMP).
   - `explorer_url` (VARCHAR).
4. **`delivery_logs`**: Full audit log of external HTTP responses and status codes.

### Concurrency & Overlap Protection
- A distributed execution lock (`monitoring_lock`) with a 60-second TTL prevents concurrent cron executions from overlapping.
- Even if two workers attempt to process the same log, the `PRIMARY KEY (id)` constraint on `processed_events` guarantees idempotency: the second attempt throws a unique constraint conflict and halts immediately without sending duplicate messages.

---

## 5. Scheduled Triggering on Vercel

1. **Vercel Cron:**
   - Configured in `vercel.json` targeting `/api/monitor`.
   - Runs periodically according to deployment plan.
2. **Interactive UI Trigger ("Poll Now"):**
   - The dashboard includes a manual trigger to run a monitoring cycle on-demand, allowing instant testing and demonstration without waiting for cron intervals.
3. **External Webhook / Ping Support:**
   - Supports secure token-authenticated GET/POST requests (`/api/monitor?key=...`) for external cron services (e.g., cron-job.org or GitHub Actions) if higher polling frequency is desired.

---

## 6. Cost & Dependency Breakdown

| Service | Provider | Plan | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Application Hosting** | Vercel | Hobby (Free) | $0.00 |
| **Atlantic Testnet RPC** | DP Labs / Pharos | Public | $0.00 |
| **Pacific Mainnet RPC** | Pharos XYZ | Public | $0.00 |
| **Telegram Notifications** | Telegram Bot API | Standard Free | $0.00 |
| **Discord Notifications** | Discord Webhooks | Standard Free | $0.00 |
| **Database Persistence** | Neon / Supabase / SQLite Local | Serverless Free | $0.00 |
| **Total Cost** | — | — | **$0.00 / month** |

---

## 7. Next Steps

With architecture and zero-cost boundaries validated, proceed to **Phase 3 — Functional Requirements & Implementation**.
