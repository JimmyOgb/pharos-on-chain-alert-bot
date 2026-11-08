# Production Incident Repair Report — API Connection Timeouts & Poll Resilience

**Incident Reference:** INC-2026-1108-01  
**Project:** Pharos On-Chain Alert Bot  
**Repository:** [https://github.com/JimmyOgb/pharos-on-chain-alert-bot](https://github.com/JimmyOgb/pharos-on-chain-alert-bot)  
**Production URL:** [https://pharos-on-chain-alert-bot.vercel.app](https://pharos-on-chain-alert-bot.vercel.app)  
**Date:** 2026-11-08  

---

## 1. Summary of Changes Applied

To resolve the connection timeout incident (`net::ERR_CONNECTION_TIMED_OUT` and `TypeError: Failed to fetch`), four targeted fixes were implemented:

### A. In-Memory Stale-While-Revalidate Block Height Cache (`src/services/rpc.ts`)
- **Problem:** Every `/api/stats` request made a synchronous round-trip call to `https://atlantic.dplabs-internal.com`, which fluctuates between 2.7s and 8.9s (and occasionally spikes higher), holding serverless Lambda slots and exhausting browser HTTP connections.
- **Fix:**
  - Added in-memory block number caching with a 5,000ms TTL.
  - Added request deduplication via `inFlightBlockFetch` promise map to avoid redundant concurrent network calls.
  - Implemented bounded timeout of 4,500ms on upstream RPC queries.
  - Implemented graceful fallback: if an upstream call is slow or fails, stale cache is served immediately rather than stalling the API response.
  - Lowered client HTTP transport timeout from 15s to 6s with single retry.

### B. Self-Paced Polling with Backoff and AbortController (`public/app.js` & `src/views.ts`)
- **Problem:** Fixed `setInterval(8000)` and `setInterval(10000)` caused requests to pile up in the browser queue when latency exceeded 8s, resulting in browser-level connection timeouts.
- **Fix:**
  - Replaced rigid `setInterval` with **guarded recursive `setTimeout`** (`runPollCycle()`).
  - Added `isPolling` lock: never starts a new poll cycle if the previous one is still in-flight.
  - Wrapped all client fetch calls with `fetchWithTimeout()` using an `AbortController` (6–7s timeout).
  - Added automatic exponential backoff: if an error occurs, poll interval increases (8s -> 12s -> 18s -> up to 30s) to give the server and connection pool time to recover.
  - Added live header sync status badge: displays `🟢 Live`, `🟡 Syncing`, or `🟠 Retry in Xs (Degraded)`.

### C. Serverless Read-Only Filesystem Resilience (`src/db/storage.ts`)
- **Problem:** On AWS Lambda / Vercel, `/var/task` is strictly read-only. Attempting to create or write `./data` threw `EROFS` errors.
- **Fix:**
  - Added automatic environment detection (`process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME`).
  - Automatically routes persistent storage file to `os.tmpdir()` (`/tmp/pharos_alert_bot/alert_bot_store.json`), which is guaranteed writable in Lambda.
  - Ensured directory creation before writing temporary atomic files.
  - Retained in-memory store fallback with zero blocking.

### D. Serverless Execution Window & Cache Headers (`vercel.json` & `src/server.ts`)
- **Problem:** Default 10s serverless function timeout left zero headroom during cold starts; missing cache-control allowed ambiguous proxy caching.
- **Fix:**
  - Set `functions: { "api/index.ts": { "maxDuration": 30 } }` in `vercel.json`.
  - Added explicit `Cache-Control: no-store, no-cache, must-revalidate` on all dynamic API routes.

---

## 2. Invariants Preserved

1. **Persistent Deduplication Invariant (Requirement 04):**
   - The deterministic composite key format `chain:txHash:logIndex:ruleId` remains completely unchanged.
   - Atomic pending-reservation check (`recordEventPending`) is preserved.
2. **Monitoring Cursor Safety:**
   - The block cursor only advances after all logs in the chunk are evaluated.
   - Failed scans or RPC hiccups NEVER advance the cursor.
3. **No Fabricated Data:**
   - Zero mock data or synthetic events introduced.
   - Genuine Atlantic Testnet RPC observations are strictly verified.
4. **Zero Fund Spending / No Wallet Keys:**
   - Pure monitoring application; zero private key collection or transaction broadcasting.

---

## 3. Test Suite Verification

Both test suites passed 100%:
- `tests/alert_bot.test.ts`: **5 / 5 passed (25.5ms)**
- `tests/incident_recovery.test.ts`: **7 / 7 passed (41.4ms)**
  - RPC blockNumber cache instant return (<10ms)
  - Upstream RPC timeout fallback to stale cache
  - Storage adapter serverless directory compatibility
  - Cursor preservation on failure
  - Persistent deduplication after cold restart
  - Concurrent race-condition safety (1 accepted, 4 rejected)
  - Explorer URL parameter safety
