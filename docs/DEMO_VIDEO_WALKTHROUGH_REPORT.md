# Pharos On-Chain Alert Bot — Demo Video Walkthrough Report

**Project:** Pharos On-Chain Alert Bot  
**Arena Task:** [On-Chain Alert Bot (50 Base Points + 50 Video Bonus = 100 Points)](https://pharos-agent-arena.vercel.app/tasks/on-chain-alert-bot)  
**Production URL:** [https://pharos-on-chain-alert-bot.vercel.app](https://pharos-on-chain-alert-bot.vercel.app)  
**GitHub Repository:** [https://github.com/JimmyOgb/pharos-on-chain-alert-bot](https://github.com/JimmyOgb/pharos-on-chain-alert-bot)  
**Network:** Pharos Atlantic Testnet (Chain ID `688689`, CAIP-2 `eip155:688689`)  
**Video Output 1 (Clean):** `demo/pharos-on-chain-alert-bot-walkthrough.mp4`  
**Video Output 2 (Subtitled):** `demo/pharos-on-chain-alert-bot-walkthrough-subtitled.mp4`  
**Subtitle Sidecar (SRT):** `demo/pharos-on-chain-alert-bot-walkthrough.srt`  

---

## 1. Executive Summary & Arena Criteria Coverage

The demo video was produced strictly adhering to the **Live Demo Video Generator** standard:
- **100% Real-Time Continuous Capture:** Recorded using Playwright at 1080p (1920x1080 @ 30fps) with an animated cursor, click ripples, human-speed typing, and smooth viewport transitions. Zero static slideshow loops.
- **Genuine On-Chain Execution:** Interacts directly with the live Pharos Atlantic Testnet via the official DP Labs RPC (`https://atlantic.dplabs-internal.com`).
- **Arena Rubric Verification:**
  - **Criterion 01 (Configurable Conditions):** Demonstrated both preset activation (USDC Whale Alert) and custom rule creation via modal (Atlantic Micro-Activity Sentinel, threshold 0.001 USDC).
  - **Criterion 02 (Real Channel Delivery):** Telegram Bot API and Discord Webhook notification channels configured with payload formatting and HTML escaping.
  - **Criterion 03 (Rich Event Context & Clickable Explorer):** Every detected alert includes event description, formatted amount, token symbol, block height, and direct clickable PharosScan explorer link.
  - **Criterion 04 (Strict Deduplication Invariant):** Demonstrated live consecutive scans proving 0 repeat spam via atomic composite hash reservation (`chain:txHash:logIndex:ruleId`).

---

## 2. Technical Video Specifications

| Parameter | Specification | Verified Output |
| :--- | :--- | :--- |
| **Container Format** | MP4 (`.mp4`) | MPEG-4 Part 14 |
| **Video Codec** | H.264 / AVC (`libx264`) | `High@L4.0`, YUV420p |
| **Resolution** | 1920 x 1080 (1080p Widescreen 16:9) | 1920 x 1080 |
| **Frame Rate** | 30.0 fps progressive | 30 fps |
| **Audio Codec** | AAC-LC | 192 kbps, stereo |
| **Duration** | ~1 minute 58 seconds (117.86s) | 117.86 seconds |
| **File Size (Clean)** | Lightweight / Fast CDN Streaming | 4,421,186 bytes (~4.22 MB) |
| **File Size (Subtitled)** | Embedded styling with subtitle burn | 5,277,297 bytes (~5.03 MB) |
| **Visual Indicators** | High-visibility animated cursor | 26px Red dot `#demo-cursor` with 500ms ripple expansion |

---

## 3. Choreographed Scene Breakdown & Narration Sync

```
 00:00 - 00:07 ── [01] Intro & Live Dashboard Overview
 00:07 - 00:19 ── [02] Atlantic Testnet Verification (Chain ID 688689)
 00:19 - 00:34 ── [03] System Telemetry, Canonical Head & Dedup Invariant
 00:34 - 00:45 ── [04] Activating Quick Preset (USDC Whale Alert)
 00:45 - 00:57 ── [05] Custom Alert Creation Modal (Micro-Activity Sentinel)
 00:57 - 01:08 ── [06] Live Block Scan Execution against Pharos RPC
 01:08 - 01:17 ── [07] Scan Audit Report Inspection (Latency & Scanned Range)
 01:17 - 01:32 ── [08] Deduplication Invariant Proof (Consecutive Scan, Zero Spam)
 01:32 - 01:42 ── [09] Real-Time Detection Feed & Verified Explorer Links
 01:42 - 01:58 ── [10] Architecture, Zero-Cost Verification & Conclusion
```

### Scene 1: Welcome & Overview (00:00 - 00:07)
- **Narration:** *"Welcome to the official demonstration of the Pharos On-Chain Alert Bot, built for the Pharos Agent Arena."*
- **Action:** Loads dashboard, centers cursor smoothly on brand badge.

### Scene 2: Network Verification (00:07 - 00:19)
- **Narration:** *"This autonomous monitoring agent tracks live blockchain events on the Pharos Atlantic Testnet, verifies configurable conditions, and delivers real-time notifications with zero repeat spam."*
- **Action:** Moves to network status pill, highlighting Chain ID 688689 and live pulse indicator.

### Scene 3: Telemetry & Deduplication Status (00:19 - 00:34)
- **Narration:** *"Here on the production dashboard, we see live network telemetry connected to Atlantic Testnet at Chain ID 688689, with continuous block tracking and active deduplication safeguards."*
- **Action:** Smooth mouse trajectory across Head Block Height, Last Monitored Cursor, Active Rules, and Deduplication Invariant card.

### Scene 4: Quick Preset Activation (00:34 - 00:45)
- **Narration:** *"First, we activate a pre-configured alert condition: the Atlantic USDC Whale Alert, monitoring Test USDC transfers exceeding fifty dollars."*
- **Action:** Clicks "Activate Whale Alert" preset. Active monitored table updates with rule entry in real time.

### Scene 5: Custom Alert Creation (00:45 - 00:57)
- **Narration:** *"Next, we create a custom alert condition through the configuration modal, specifying an Atlantic Micro-Activity Sentinel tracking transfers of zero point zero zero one USDC."*
- **Action:** Opens modal, types rule name, custom threshold `0.001`, inputs Test USDC address `0xcfc8330f4bcab529c625d12781b1c19466a9fc8b`, and submits.

### Scene 6: Live Block Scan (00:57 - 01:08)
- **Narration:** *"Now, let's trigger a live on-chain block scan. The scanner evaluates recent Atlantic Testnet blocks directly against the official DP Labs RPC."*
- **Action:** Clicks "Scan Blocks Now", shows live scanning animation.

### Scene 7: Scan Audit Report (01:08 - 01:17)
- **Narration:** *"The scan audit report appears instantly, confirming the exact block range, evaluated logs, and serverless execution latency."*
- **Action:** Highlights the newly revealed audit panel showing processed block count and duration in milliseconds.

### Scene 8: Deduplication Invariant Proof (01:17 - 01:32)
- **Narration:** *"Crucially, our system enforces a deterministic deduplication invariant. When a consecutive scan executes over the same blocks, existing events are recognized and deduplicated, preventing any duplicate spam."*
- **Action:** Executes immediate follow-up scan, showing 0 duplicate alerts sent and cursor advancement.

### Scene 9: Event Feed & Explorer Receipts (01:32 - 01:42)
- **Narration:** *"Every detected alert includes full event context: transaction activity, formatted values, block numbers, and verified clickable PharosScan explorer links."*
- **Action:** Scrolls down to Section 3 table, hovering over detected events and PharosScan tx link.

### Scene 10: Architecture & Wrap-Up (01:42 - 01:58)
- **Narration:** *"With a zero-cost serverless architecture, comprehensive test coverage, and transparent execution, the Pharos On-Chain Alert Bot delivers enterprise-grade blockchain monitoring. Thank you."*
- **Action:** Scrolls down to footer showing open-source repository link and architecture invariants.

---

## 4. Subtitle File (`.srt`)

The subtitles are stored at:
[`demo/pharos-on-chain-alert-bot-walkthrough.srt`](file:///C:/Users/NO%20GO%20NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/pharos-on-chain-alert-bot-walkthrough.srt)

Additionally, a version with subtitles burned directly into the video stream has been produced at:
[`demo/pharos-on-chain-alert-bot-walkthrough-subtitled.mp4`](file:///C:/Users/NO%20GO%20NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/pharos-on-chain-alert-bot-walkthrough-subtitled.mp4)

---

## 5. Next Steps for Submission

1. **User Review:** Inspect the local video file.
2. **Video Hosting (User-Authorized):** Upload the chosen MP4 (`pharos-on-chain-alert-bot-walkthrough-subtitled.mp4` or clean version) to YouTube, Loom, or X/Twitter.
3. **Pharos Agent Arena Submission:** Submit the final URL, GitHub repo, and video link to the Arena dashboard for evaluation.
