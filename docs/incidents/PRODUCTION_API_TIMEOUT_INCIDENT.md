# Production Incident Report — API Connection Timeouts

**Incident ID:** INC-2026-1108-01  
**Incident Status:** INVESTIGATING / ROOT CAUSE IDENTIFIED  
**Production Application:** [https://pharos-on-chain-alert-bot.vercel.app](https://pharos-on-chain-alert-bot.vercel.app)  
**GitHub Repository:** [https://github.com/JimmyOgb/pharos-on-chain-alert-bot](https://github.com/JimmyOgb/pharos-on-chain-alert-bot)  
**Current Production Deployment ID:** `dpl_6D6WqD8ZvqLacr4LaKHpMQTk9ULJ`  
**Current Production URL:** `https://pharos-on-chain-alert-p5kywhwln-jamism123.vercel.app`  
**Latest Remote Commit:** `15b4b4e` (`docs: add video walkthrough script, srt subtitles, and demo report`)  
**Network:** Pharos Atlantic Testnet (Chain ID `688689`, CAIP-2 `eip155:688689`)  
**Observation Time:** 2026-11-08T22:27:00Z / 2026-11-08T23:00:00+01:00  

---

## 1. Reported Symptoms

The browser console repeatedly logged:
- `GET /api/events?limit=30` -> `net::ERR_CONNECTION_TIMED_OUT`
- `GET /api/stats?network=atlantic` -> `net::ERR_CONNECTION_TIMED_OUT`
- `GET /api/alerts` -> `net::ERR_CONNECTION_TIMED_OUT`
- `Failed to load events: TypeError: Failed to fetch`
- `Telemetry refresh error: TypeError: Failed to fetch`

Additionally, external extension noise was reported (`ObjectMultiplex - orphaned data for stream "app-init-liveness"`, `Disconnected from portaldot-extension...`), confirmed as client-side browser extension noise unrelated to the Pharos backend.

---

## 2. Working Tree Baseline

- **Repository Path:** `C:\Users\NO GO NO\pharosbuild\skills\pharos-on-chain-alert-bot`
- **Branch:** `main`
- **HEAD:** `15b4b4e`
- **Remote Origin:** `https://github.com/JimmyOgb/pharos-on-chain-alert-bot.git`
- **Working Tree State:** Clean, up-to-date with remote origin.

---

## 3. Initial Endpoint Measurement Baseline

Direct HTTP probe execution on production deployment (`https://pharos-on-chain-alert-bot.vercel.app`):

| Endpoint | HTTP Status | Response Time | Content-Type | Body Preview / Schema |
| :--- | :--- | :--- | :--- | :--- |
| `GET /` | `200 OK` | **15,873 ms** | `text/html; charset=utf-8` | HTML dashboard markup (10,240 bytes) |
| `GET /health` | `200 OK` | **5,262 ms** | `application/json; charset=utf-8` | `{"status":"ok","timestamp":"...","uptimeSeconds":511}` |
| `GET /api/stats?network=atlantic` | `200 OK` | **8,476 ms** | `application/json; charset=utf-8` | `{"network":"atlantic","latestBlock":32492783,...}` |
| `GET /api/events?limit=30` | `200 OK` | **4,434 ms** | `application/json; charset=utf-8` | `{"count":0,"events":[]}` |
| `GET /api/alerts` | `200 OK` | **4,448 ms** | `application/json; charset=utf-8` | `{"alerts":[]}` |

---

## 4. Initial Log Observations

Vercel runtime logs (`vercel logs`) captured between 22:56:47 UTC and 23:05:07 UTC revealed:
1. Massive request stacking: Multiple requests (`/api/stats`, `/api/events`, `/api/alerts`) arriving within the **exact same millisecond** (e.g., `22:58:11.12`).
2. Heavy concurrent Lambda invocation load caused by client-side unbounded timers.
3. Upstream DP Labs RPC measurement (`https://atlantic.dplabs-internal.com`) confirmed high round-trip latency:
   - Call 1: `8,692 ms`
   - Call 2: `7,917 ms`
   - Call 3: `8,881 ms`
   - Call 4: `3,694 ms`
   - Call 5: `2,771 ms`
   - Average `eth_blockNumber` latency: **6.39 seconds** per request.
