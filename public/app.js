document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const statLatestBlock = document.getElementById("stat-latest-block");
  const statCursorBlock = document.getElementById("stat-cursor-block");
  const statActiveAlerts = document.getElementById("stat-active-alerts");
  const statDeliveredEvents = document.getElementById("stat-delivered-events");
  const alertsTableBody = document.getElementById("alerts-table-body");
  const eventsTableBody = document.getElementById("events-table-body");
  const eventCountBadge = document.getElementById("event-count-badge");
  const btnManualScan = document.getElementById("btn-manual-scan");
  const scanReportPanel = document.getElementById("scan-report-panel");
  const scanReportContent = document.getElementById("scan-report-content");
  const headerSyncStatus = document.getElementById("header-sync-status");
  const headerPulseDot = document.getElementById("header-pulse-dot");

  // Modal Elements
  const modalCreateAlert = document.getElementById("modal-create-alert");
  const btnOpenCreateModal = document.getElementById("btn-open-create-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const formCreateAlert = document.getElementById("form-create-alert");

  let currentNetwork = "atlantic";

  // Polling State Controls
  let isPolling = false;
  let pollBackoffMs = 8000;
  const NORMAL_POLL_INTERVAL = 8000;
  const MAX_POLL_INTERVAL = 30000;
  let activePollTimer = null;

  // Resilient Fetch with AbortController Timeout Guard
  async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // Update Connectivity Badge in Header
  function updateSyncStatus(status, retrySec = null) {
    if (!headerSyncStatus) return;
    if (status === "ONLINE") {
      headerSyncStatus.textContent = "Live";
      headerSyncStatus.style.background = "rgba(16, 185, 129, 0.2)";
      headerSyncStatus.style.color = "#10b981";
      headerSyncStatus.style.borderColor = "rgba(16, 185, 129, 0.4)";
      if (headerPulseDot) headerPulseDot.style.background = "#10b981";
    } else if (status === "SYNCING") {
      headerSyncStatus.textContent = "Syncing";
      headerSyncStatus.style.background = "rgba(56, 189, 248, 0.2)";
      headerSyncStatus.style.color = "#38bdf8";
      headerSyncStatus.style.borderColor = "rgba(56, 189, 248, 0.4)";
      if (headerPulseDot) headerPulseDot.style.background = "#38bdf8";
    } else if (status === "DEGRADED") {
      headerSyncStatus.textContent = retrySec ? `Retry in ${retrySec}s` : "Degraded";
      headerSyncStatus.style.background = "rgba(245, 158, 11, 0.2)";
      headerSyncStatus.style.color = "#f59e0b";
      headerSyncStatus.style.borderColor = "rgba(245, 158, 11, 0.4)";
      if (headerPulseDot) headerPulseDot.style.background = "#f59e0b";
    }
  }

  // Self-Paced Polling Cycle with Exponential Backoff and Concurrency Guard
  async function runPollCycle() {
    if (isPolling) return;
    isPolling = true;

    try {
      updateSyncStatus("SYNCING");
      await refreshDashboard();
      await loadEvents();
      pollBackoffMs = NORMAL_POLL_INTERVAL;
      updateSyncStatus("ONLINE");
    } catch (err) {
      console.warn("Poll cycle degraded:", err.message);
      pollBackoffMs = Math.min(pollBackoffMs * 1.5, MAX_POLL_INTERVAL);
      updateSyncStatus("DEGRADED", Math.round(pollBackoffMs / 1000));
    } finally {
      isPolling = false;
      activePollTimer = setTimeout(runPollCycle, pollBackoffMs);
    }
  }

  // Initial Load
  loadAlerts();
  runPollCycle();

  // ==============================================================
  // 1. DASHBOARD TELEMETRY
  // ==============================================================
  async function refreshDashboard() {
    try {
      const res = await fetchWithTimeout(`/api/stats?network=${currentNetwork}`, {}, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.latestBlock) {
        statLatestBlock.textContent = data.latestBlock.toLocaleString();
      }
      if (data.lastMonitoredBlock) {
        statCursorBlock.textContent = data.lastMonitoredBlock.toLocaleString();
      }
      statActiveAlerts.textContent = data.activeAlertsCount || 0;
      statDeliveredEvents.textContent = data.totalDelivered || 0;
      return data;
    } catch (err) {
      console.warn("Telemetry refresh error:", err.message);
      throw err;
    }
  }

  // ==============================================================
  // 2. ALERTS LIST & MANAGEMENT
  // ==============================================================
  async function loadAlerts() {
    try {
      const res = await fetchWithTimeout("/api/alerts", {}, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const alerts = data.alerts || [];

      if (alerts.length === 0) {
        alertsTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center text-muted">
              No alert rules configured. Use a preset above or click '+ Custom Alert'.
            </td>
          </tr>
        `;
        return;
      }

      alertsTableBody.innerHTML = alerts
        .map(
          (a) => `
        <tr>
          <td><strong>${escapeHtml(a.name)}</strong></td>
          <td><span class="badge">${escapeHtml(a.network.toUpperCase())}</span></td>
          <td><code>${escapeHtml(a.type)}</code></td>
          <td>
            ${
              a.contractAddress
                ? `<a href="https://atlantic.pharosscan.xyz/address/${a.contractAddress}" target="_blank" class="font-mono text-cyan">${shortenAddress(
                    a.contractAddress
                  )}</a>`
                : '<span class="text-muted">Any Token</span>'
            }
          </td>
          <td><strong>${escapeHtml(a.threshold || "0")}</strong> ${escapeHtml(a.tokenSymbol || "")}</td>
          <td><span class="badge">${escapeHtml(a.channel)}</span></td>
          <td>
            <button class="btn-toggle-sm" onclick="toggleAlert('${a.id}')">
              ${a.enabled ? "🟢 Enabled" : "⚪ Disabled"}
            </button>
          </td>
          <td>
            <button class="btn-danger-sm" onclick="deleteAlert('${a.id}')">Delete</button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (err) {
      console.error("Failed to load alerts:", err.message);
    }
  }

  // ==============================================================
  // 3. EVENTS HISTORY & EXPLORER LINKS
  // ==============================================================
  async function loadEvents() {
    try {
      const res = await fetchWithTimeout("/api/events?limit=30", {}, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data.events || [];

      eventCountBadge.textContent = `${events.length} Events Tracked`;

      if (events.length === 0) {
        eventsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted">
              Awaiting on-chain events. Click 'Scan Blocks Now' to scan recent Pharos blocks.
            </td>
          </tr>
        `;
        return;
      }

      eventsTableBody.innerHTML = events
        .map((e) => {
          let statusBadge = '<span class="badge badge-warning">Pending</span>';
          if (e.deliveryStatus === "DELIVERED") {
            statusBadge = '<span class="badge badge-success">Delivered</span>';
          } else if (e.deliveryStatus === "FAILED") {
            statusBadge = '<span class="badge badge-danger">Failed</span>';
          }

          return `
          <tr>
            <td class="font-mono" style="font-size:12px;">${new Date(e.timestamp).toLocaleTimeString()}</td>
            <td><strong>${escapeHtml(e.alertName)}</strong></td>
            <td>${escapeHtml(e.description)}</td>
            <td><strong class="text-cyan">${escapeHtml(e.valueFormatted)}</strong> ${escapeHtml(e.tokenSymbol)}</td>
            <td class="font-mono">${e.blockNumber}</td>
            <td>
              <a href="${e.explorerUrl}" target="_blank" class="font-mono text-cyan" title="Open PharosScan Explorer">
                ${shortenHash(e.txHash)} ↗
              </a>
            </td>
            <td>${statusBadge}</td>
          </tr>
        `;
        })
        .join("");
    } catch (err) {
      console.warn("Failed to load events:", err.message);
      throw err;
    }
  }

  // ==============================================================
  // 4. MANUAL SCAN TRIGGER
  // ==============================================================
  btnManualScan.addEventListener("click", async () => {
    btnManualScan.disabled = true;
    btnManualScan.innerHTML = '<span class="icon">⏳</span> Scanning...';
    scanReportPanel.style.display = "none";

    try {
      const res = await fetchWithTimeout("/api/monitor?network=atlantic", { method: "POST" }, 25000);
      const data = await res.json();

      if (data.status === "success" && data.report) {
        const r = data.report;
        scanReportPanel.style.display = "block";
        scanReportContent.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
            <div class="metric-card">
              <div class="metric-label">Scanned Block Range</div>
              <div class="metric-value font-mono" style="font-size:18px;">${r.fromBlock} → ${r.toBlock}</div>
              <div class="metric-sub">${r.toBlock - r.fromBlock + 1} Blocks Processed</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Logs Evaluated</div>
              <div class="metric-value font-mono" style="font-size:18px;">${r.logsScanned}</div>
              <div class="metric-sub">ERC-20 Transfer Events</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Qualifying Alerts</div>
              <div class="metric-value font-mono" style="font-size:18px;">${r.qualifyingEvents}</div>
              <div class="metric-sub">${r.deliveredCount} Delivered, ${r.deduplicatedCount} Deduplicated</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Execution Time</div>
              <div class="metric-value font-mono" style="font-size:18px;">${r.durationMs}ms</div>
              <div class="metric-sub">Serverless Batch Latency</div>
            </div>
          </div>
        `;
      }

      await refreshDashboard();
      await loadEvents();
    } catch (err) {
      alert("Scan failed: " + err.message);
    } finally {
      btnManualScan.disabled = false;
      btnManualScan.innerHTML = '<span class="icon">🔄</span> Scan Blocks Now';
    }
  });

  // ==============================================================
  // 5. ONE-CLICK PRESET ACTIVATION
  // ==============================================================
  document.querySelectorAll(".btn-preset").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const preset = e.target.getAttribute("data-preset");
      let payload = null;

      if (preset === "usdc-whale") {
        payload = {
          name: "Atlantic USDC Whale Sentinel",
          network: "atlantic",
          type: "LARGE_TRANSFER",
          contractAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
          threshold: "50.0",
          channel: "TELEGRAM",
        };
      } else if (preset === "micro-transfer") {
        payload = {
          name: "Atlantic Micro-Activity Watcher",
          network: "atlantic",
          type: "LARGE_TRANSFER",
          contractAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
          threshold: "0.001",
          channel: "TELEGRAM",
        };
      } else if (preset === "contract-calls") {
        payload = {
          name: "Paymaster Activity Monitor",
          network: "atlantic",
          type: "CONTRACT_CALL",
          contractAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
          threshold: "0.0",
          channel: "TELEGRAM",
        };
      }

      if (payload) {
        e.target.disabled = true;
        e.target.textContent = "Activating...";
        try {
          const res = await fetch("/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            await loadAlerts();
            await refreshDashboard();
          }
        } catch (err) {
          alert("Preset error: " + err.message);
        } finally {
          e.target.disabled = false;
          e.target.textContent = "Active ✓";
        }
      }
    });
  });

  // ==============================================================
  // 6. CUSTOM ALERT MODAL & SUBMISSION
  // ==============================================================
  btnOpenCreateModal.addEventListener("click", () => {
    modalCreateAlert.style.display = "flex";
  });

  const closeModal = () => {
    modalCreateAlert.style.display = "none";
  };

  btnCloseModal.addEventListener("click", closeModal);
  btnCancelModal.addEventListener("click", closeModal);

  formCreateAlert.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("rule-name").value,
      network: document.getElementById("rule-network").value,
      type: document.getElementById("rule-type").value,
      contractAddress: document.getElementById("rule-contract").value || undefined,
      threshold: document.getElementById("rule-threshold").value,
      channel: document.getElementById("rule-channel").value,
      targetChatId: document.getElementById("rule-target").value || undefined,
    };

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        closeModal();
        formCreateAlert.reset();
        await loadAlerts();
        await refreshDashboard();
      } else {
        const errData = await res.json();
        alert("Error creating alert: " + (errData.error || "Unknown"));
      }
    } catch (err) {
      alert("Submission error: " + err.message);
    }
  });

  // Global helper functions
  window.toggleAlert = async (id) => {
    try {
      await fetch(`/api/alerts/${id}/toggle`, { method: "POST" });
      await loadAlerts();
      await refreshDashboard();
    } catch (err) {
      alert("Toggle error: " + err.message);
    }
  };

  window.deleteAlert = async (id) => {
    if (!confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      await loadAlerts();
      await refreshDashboard();
    } catch (err) {
      alert("Delete error: " + err.message);
    }
  };

  function shortenAddress(addr) {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function shortenHash(hash) {
    if (!hash || hash.length < 12) return hash;
    return `${hash.slice(0, 10)}...`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
