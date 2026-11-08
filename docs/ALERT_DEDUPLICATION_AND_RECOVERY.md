# Alert Deduplication and Recovery Architecture

**Project:** Pharos On-Chain Alert Bot  
**Document:** `docs/ALERT_DEDUPLICATION_AND_RECOVERY.md`  
**Purpose:** Formal specification for zero-duplicate event delivery and recovery from interruptions, worker overlaps, and service restarts.

---

## 1. The Core Invariant

The Pharos Agent Arena reviewer scoring criteria for Requirement 04 states:
> **"No repeat spam for the same event."**

In an asynchronous blockchain monitoring system running on serverless infrastructure, duplicate delivery risks arise from:
1. **Cron Overlap:** Consecutive scheduled executions overlapping due to long-running RPC queries.
2. **Network Retries:** Transient Telegram/Discord network timeouts causing the caller to resend an alert that was already accepted by the destination.
3. **Cursor Reset / Cold Restart:** Function restarts or worker redeployments querying overlapping block ranges.
4. **Multiple Matching Alerts:** Multiple alerts configured on the same contract requiring isolated deduplication state per alert.

---

## 2. Event Identity Specification

Every on-chain event is assigned a deterministic, immutable composite identifier:

### For Event Logs (e.g., ERC-20 Transfers):
$$\text{EventID} = \text{network} + \text{":"} + \text{txHash} + \text{":"} + \text{logIndex} + \text{":"} + \text{alertId}$$

- `network`: Canonical network identifier (e.g. `atlantic` or `pacific`).
- `txHash`: The 32-byte hexadecimal transaction hash (lowercase, 0x-prefixed).
- `logIndex`: The integer index of the log within the transaction receipt.
- `alertId`: The UUID of the alert rule that triggered this notification.

### For Transaction-Level Contract Calls:
$$\text{EventID} = \text{network} + \text{":"} + \text{txHash} + \text{":tx:"} + \text{alertId}$$

---

## 3. Database Schema & Uniqueness Constraints

Deduplication is guaranteed at the persistence layer using a relational database table with a strict Primary Key constraint:

```sql
CREATE TABLE IF NOT EXISTS processed_events (
    id VARCHAR(255) PRIMARY KEY,              -- Composite EventID
    alert_id VARCHAR(64) NOT NULL,
    network VARCHAR(32) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INT NOT NULL,
    delivery_status VARCHAR(32) NOT NULL,     -- 'PENDING', 'DELIVERED', 'FAILED'
    delivery_channel VARCHAR(32) NOT NULL,    -- 'TELEGRAM', 'DISCORD', 'MOCK'
    delivered_at TIMESTAMP,
    event_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alert FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processed_events_tx ON processed_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_processed_events_block ON processed_events(block_number);
```

---

## 4. Two-Phase Safe Delivery Protocol

To prevent phantom deliveries (marking delivered when network call failed) and duplicate notifications (sending twice when confirmation dropped):

```
       [ Detect On-Chain Event ]
                   │
                   ▼
       [ Generate Deterministic EventID ]
                   │
                   ▼
    ┌─────────────────────────────────┐
    │  Atomic Reservation Attempt     │
    │  INSERT INTO processed_events   │
    │  (id, status = 'PENDING')       │
    └──────────────┬──────────────────┘
                   │
         Does Key Already Exist?
        ┌──────────┴──────────┐
       YES                    NO
        │                     │
        ▼                     ▼
 [ Skip Processing ]   [ Dispatch to Telegram / Discord ]
 (Zero Duplicate)             │
                              ▼
                      Did Channel Confirm?
                     ┌────────┴────────┐
                    YES                NO
                     │                 │
                     ▼                 ▼
          [ UPDATE status =      [ UPDATE status =
             'DELIVERED',           'FAILED',
             delivered_at ]         retry_count++ ]
```

1. **Phase 1: Atomic Reservation:**
   - Before firing an HTTP request to Telegram or Discord, the worker attempts an `INSERT` with `status = 'PENDING'`.
   - If a duplicate attempt occurs concurrently (e.g. from an overlapping cron invocation), the database throws a Unique Constraint Violation. The worker gracefully ignores the duplicate event.

2. **Phase 2: Verified Delivery & Finalization:**
   - The notification is transmitted to the external API.
   - The worker inspects the HTTP response:
     - Telegram: `status === 200` and `body.ok === true`.
     - Discord: `status === 204` or `status === 200`.
   - On verified success, `status` is updated to `'DELIVERED'`.
   - On transient network failure (e.g. HTTP 500, 429), `status` is updated to `'FAILED'` with the error message recorded, allowing an exponential backoff retry worker to retry only failed items without duplicate delivery.

---

## 5. Block Cursor Persistence & Interruption Recovery

1. **Cursor Table:**
   ```sql
   CREATE TABLE IF NOT EXISTS monitoring_cursors (
       network VARCHAR(32) PRIMARY KEY,
       last_block BIGINT NOT NULL,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Advancement Rule:**
   - The cursor is updated in the database **only after** all events in the queried block range `[fromBlock, toBlock]` have completed Phase 1 reservation.
   - If a worker crashes mid-batch, the next scheduled worker resumes from `last_block + 1`.
   - Any event that was already reserved in `processed_events` during the partial run is recognized and safely skipped, guaranteeing **at-least-once scanning with exactly-once notification delivery**.

3. **Maximum Batch Window:**
   - To prevent RPC timeouts or serverless function execution limits (10s–15s), the scanner bounds the block range:
     $$\text{toBlock} = \min(\text{latestBlock}, \text{fromBlock} + 50)$$
   - If the cursor falls behind (e.g. after maintenance), subsequent runs catch up in bounded 50-block chunks without stalling the worker.
