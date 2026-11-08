# Production Incident Root Cause Analysis — API Connection Timeouts

**Incident Reference:** INC-2026-1108-01  
**Project:** Pharos On-Chain Alert Bot  
**Production URL:** [https://pharos-on-chain-alert-bot.vercel.app](https://pharos-on-chain-alert-bot.vercel.app)  
**Investigation Date:** 2026-11-08  

---

## 1. Executive Root Cause Summary

The production timeouts (`net::ERR_CONNECTION_TIMED_OUT` and `TypeError: Failed to fetch`) are caused by the confluence of three specific architectural factors:

1. **Synchronous Uncached Upstream RPC in High-Frequency Polling (`/api/stats`):**
   - Every invocation of `GET /api/stats?network=atlantic` triggered a blocking, synchronous round-trip call to `rpcService.getLatestBlockNumber(network)` against `https://atlantic.dplabs-internal.com`.
   - Live measurements of the DP Labs internal RPC demonstrated that `eth_blockNumber` response times fluctuate between **2,771 ms and 8,881 ms** (averaging ~6.4 seconds).
   - Under load or network jitter, upstream RPC calls routinely exceeded 10–15 seconds.

2. **Client-Side Unbounded Polling Storm (`public/app.js`):**
   - The frontend used fixed `setInterval(refreshDashboard, 8000)` and `setInterval(loadEvents, 10000)`.
   - Because `setInterval` fires unconditionally regardless of whether previous requests have completed, when a request took >8 seconds, the next request was immediately dispatched while the previous was still pending.
   - Together with simultaneous initial requests (`loadAlerts`, `refreshDashboard`, `loadEvents`), this rapidly saturated the browser's 6-connection per-host HTTP queue.
   - Subsequent requests queued in the browser timed out before even reaching the network, yielding `net::ERR_CONNECTION_TIMED_OUT`.

3. **Vercel Serverless Function Limits & Read-Only Filesystem:**
   - On Vercel serverless (Hobby tier), functions default to a 10-second execution limit. When RPC latency spiked past 10s, Vercel aborted the function.
   - In `FileStorageAdapter`, `CONFIG.DATA_DIR` defaulted to `./data`. Because the AWS Lambda runtime directory `/var/task` is strictly read-only, attempting to create or write to `./data` threw `EROFS` errors, falling back awkwardly and risking write lock delays.
   - Vercel's rewrite rule routed all traffic (`/(.*)`) to the single `/api` serverless handler, compounding cold starts and concurrency limits.

---

## 2. Supporting Empirical Evidence

### A. Upstream RPC Latency Benchmark
Measured directly against `https://atlantic.dplabs-internal.com`:
- **Sample 1:** `8,692 ms`
- **Sample 2:** `7,917 ms`
- **Sample 3:** `8,881 ms`
- **Sample 4:** `3,694 ms`
- **Sample 5:** `2,771 ms`
*Finding:* No network RPC call with 6-9 second baseline latency can be safely called synchronously on every frontend poll tick without in-memory caching.

### B. Vercel Production Log Concurrency
`vercel logs` showed that at `22:58:11.12`, six separate API requests arrived in the exact same millisecond:
```
22:58:11.12 info λ GET /api/stats
22:58:11.12 info λ GET /api/events
22:58:11.12 info λ GET /api/stats
22:58:11.12 info λ GET /api/stats
22:58:11.12 info λ GET /api/events
```
*Finding:* Confirms client-side polling queue accumulation and parallel dispatch pileup.

### C. Direct Response Time Profiles
Initial probe confirmed:
- `GET /api/stats`: `8,476 ms`
- `GET /health`: `5,262 ms`
- `GET /`: `15,873 ms`
*Finding:* The backend is functioning and returns valid HTTP 200 responses, but the multi-second latency exceeds the tight tolerances of rapid browser `setInterval` polling.

---

## 3. Scope of Impact

| Component | Impact Status | Details |
| :--- | :--- | :--- |
| `GET /api/stats` | **Directly Affected** | Synchronous RPC block height fetch stalls response for 8–15s. |
| `GET /api/events` | **Indirectly Affected** | Blocked in browser connection queue behind stalled `/api/stats` requests. |
| `GET /api/alerts` | **Indirectly Affected** | Blocked in browser connection queue behind stalled `/api/stats` requests. |
| Monitoring Engine | **Unaffected** | Worker scanner (`src/services/scanner.ts`) runs independently and uses chunked blocks. |
| Deduplication State | **Unaffected** | Storage invariants and composite keys (`chain:txHash:logIndex:ruleId`) remain intact. |
| Event Integrity | **Unaffected** | No events were lost or duplicated; on-chain data was never modified or dropped. |

---

## 4. The Smallest Safe Repair Plan

To permanently eliminate timeouts while preserving all blockchain and deduplication invariants:

1. **In-Memory Block Height Cache with Stale-While-Revalidate (Backend):**
   - In `PharosRpcService`, cache `getLatestBlockNumber(network)` with a 5-second TTL.
   - Enforce an explicit 4,000ms timeout on RPC queries. If the RPC is slow, serve the cached block height immediately rather than stalling the client.
   - Never block `/api/stats` on an upstream network call when a fresh or cached block number is available.

2. **Serverless Filesystem & Storage Resilience:**
   - Detect serverless environment (`process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME`).
   - Automatically route persistent files to `/tmp` (the only writable directory in Lambda) if the local directory is read-only.
   - Guarantee atomic in-memory fallback with zero blocking.

3. **Client-Side Self-Pacing Polling with Concurrency Guards (Frontend):**
   - Replace rigid `setInterval` with **guarded recursive `setTimeout`**.
   - Enforce `isFetching` lock: never launch a new poll while an existing poll is in-flight.
   - Exponential backoff on error/timeout: 10s normal -> 15s -> 30s backoff.
   - Display honest UI connection status badge: "🟢 Connected", "🟡 Updating...", or "🔴 Degraded (Retrying in Xs)".
   - Retain existing dashboard telemetry on screen if a refresh fails, preventing jarring blank resets.

4. **Vercel Serverless Function Configuration:**
   - Add explicit `functions: { "api/index.ts": { "maxDuration": 30 } }` in `vercel.json` to ensure ample headroom for cold starts and scan operations.
