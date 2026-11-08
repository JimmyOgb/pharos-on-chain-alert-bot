import os
import sys
import time
import socket
import asyncio
import subprocess
from pathlib import Path

# Force IPv4 for reliable connection to edge-tts on Windows
orig_getaddrinfo = socket.getaddrinfo
def patched_getaddrinfo(*args, **kwargs):
    responses = orig_getaddrinfo(*args, **kwargs)
    ipv4 = [r for r in responses if r[0] == socket.AF_INET]
    return ipv4 if ipv4 else responses
socket.getaddrinfo = patched_getaddrinfo

import edge_tts
from playwright.async_api import async_playwright

CURSOR_JS = """
() => {
  if (document.getElementById('demo-cursor')) return;
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  Object.assign(cursor.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '24px', height: '24px',
    background: 'rgba(239, 68, 68, 0.85)',
    border: '2px solid white', borderRadius: '50%',
    boxShadow: '0 0 14px rgba(239, 68, 68, 0.7)',
    pointerEvents: 'none', zIndex: '999999',
    transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
    transform: 'translate(-50%, -50%)'
  });
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mousedown', e => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px',
      width: '12px', height: '12px', borderRadius: '50%',
      border: '2px solid rgba(239, 68, 68, 0.95)',
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: '1', pointerEvents: 'none', zIndex: '999998',
      transition: 'all 0.45s ease-out'
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(4)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 450);
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  });
}
"""

async def smooth_move(page, selector: str, steps: int = 25):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=10000)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await page.mouse.move(target_x, target_y, steps=steps)
        await asyncio.sleep(0.2)

async def smooth_click(page, selector: str, pause_after: float = 1.2):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=10000)
    await loc.scroll_into_view_if_needed()
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await page.mouse.move(target_x, target_y, steps=30)
        await asyncio.sleep(0.3)
        await page.mouse.click(target_x, target_y)
    else:
        await loc.click()
    await asyncio.sleep(pause_after)

async def smooth_type(page, selector: str, text: str, pause_after: float = 1.0):
    await smooth_click(page, selector, pause_after=0.3)
    await page.keyboard.type(text, delay=45)
    await asyncio.sleep(pause_after)

# Narration script segments
NARRATION_TEXT = (
    "Welcome to the official demonstration of the Pharos On-Chain Alert Bot, "
    "built for the Pharos Agent Arena. "
    "This autonomous monitoring agent tracks live blockchain events on the Pharos Atlantic Testnet, "
    "verifies configurable conditions, and delivers real-time notifications with zero repeat spam. "
    "Here on the production dashboard, we see live network telemetry connected to Atlantic Testnet at Chain ID 688689, "
    "with continuous block tracking and active deduplication safeguards. "
    "First, we activate a pre-configured alert condition: the Atlantic USDC Whale Alert, "
    "monitoring Test USDC transfers exceeding fifty dollars. "
    "Next, we create a custom alert condition through the configuration modal. "
    "We specify an Atlantic Micro-Activity Sentinel tracking transfers of zero point zero zero one USDC, "
    "instantly registering the rule in our monitoring engine. "
    "Now, let's trigger a live on-chain block scan. "
    "The scanner evaluates recent Atlantic Testnet blocks directly against the official DP Labs RPC. "
    "The scan audit report appears instantly, confirming the exact block range, evaluated logs, and serverless execution latency. "
    "Crucially, our system enforces a deterministic deduplication invariant. "
    "When a consecutive scan executes over the same blocks, existing events are recognized and deduplicated, "
    "preventing any duplicate spam from reaching notification channels. "
    "Every detected alert includes full event context: transaction activity, formatted values, block numbers, "
    "and verified clickable PharosScan explorer links. "
    "With a zero-cost serverless architecture, comprehensive test coverage, and transparent execution, "
    "the Pharos On-Chain Alert Bot delivers enterprise-grade blockchain monitoring. Thank you."
)

async def generate_narration(output_audio_path: str, output_srt_path: str):
    print(f"Generating narration audio with edge-tts: {output_audio_path}")
    c = edge_tts.Communicate(NARRATION_TEXT, "en-US-ChristopherNeural", rate="+3%")
    sub = edge_tts.SubMaker()
    with open(output_audio_path, "wb") as f:
        async for chunk in c.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                sub.feed(chunk)
    
    with open(output_srt_path, "w", encoding="utf-8") as f:
        f.write(sub.get_srt())
    print("Narration audio and subtitles generated successfully.")

async def record_screen_workflow(app_url: str, raw_video_dir: str) -> str:
    print(f"Launching Playwright to record live workflow from: {app_url}")
    raw_dir_path = Path(raw_video_dir)
    raw_dir_path.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(raw_dir_path),
            record_video_size={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        # Step 1: Open Application
        print("Navigating to production application...")
        await page.goto(app_url, wait_until="networkidle")
        await page.evaluate(CURSOR_JS)
        await asyncio.sleep(2.0)

        # Step 2: Highlight Header & Telemetry
        print("Highlighting header & live network badge...")
        await smooth_move(page, "#network-pill", steps=30)
        await asyncio.sleep(1.5)

        print("Highlighting telemetry cards...")
        await smooth_move(page, "#stat-latest-block", steps=25)
        await asyncio.sleep(1.2)
        await smooth_move(page, "#stat-cursor-block", steps=25)
        await asyncio.sleep(1.2)
        await smooth_move(page, "#stat-dedup-status", steps=25)
        await asyncio.sleep(2.0)

        # Step 3: Activate Whale Alert Preset
        print("Activating Whale Alert preset...")
        await smooth_move(page, '.btn-preset[data-preset="usdc-whale"]', steps=30)
        await asyncio.sleep(0.5)
        await smooth_click(page, '.btn-preset[data-preset="usdc-whale"]', pause_after=2.0)

        # Scroll to view active rules table
        await smooth_move(page, "#alerts-table-body", steps=20)
        await asyncio.sleep(2.0)

        # Step 4: Open Modal and Create Custom Alert
        print("Opening Custom Alert modal...")
        await smooth_click(page, "#btn-open-create-modal", pause_after=1.5)

        print("Filling custom alert form...")
        await smooth_type(page, "#rule-name", "Atlantic Micro-Activity Sentinel", pause_after=0.8)
        
        # Clear default threshold and enter 0.001
        await smooth_click(page, "#rule-threshold", pause_after=0.3)
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await page.keyboard.type("0.001", delay=40)
        await asyncio.sleep(0.8)

        # Monitored Contract
        await smooth_type(page, "#rule-contract", "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b", pause_after=0.8)

        # Save Alert
        print("Submitting custom alert...")
        await smooth_click(page, 'button[type="submit"]', pause_after=2.0)

        # Step 5: Trigger Manual Scan
        print("Triggering live block scan...")
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        await asyncio.sleep(1.0)
        await smooth_click(page, "#btn-manual-scan", pause_after=3.5)

        # Wait for scan report panel to appear
        await page.wait_for_selector("#scan-report-panel", state="visible", timeout=15000)
        await smooth_move(page, "#scan-report-panel", steps=25)
        await asyncio.sleep(3.0)

        # Step 6: Trigger Consecutive Scan to Demonstrate Deduplication
        print("Triggering consecutive scan to demonstrate deduplication...")
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        await asyncio.sleep(0.8)
        await smooth_click(page, "#btn-manual-scan", pause_after=3.5)
        await asyncio.sleep(2.0)

        # Step 7: Scroll to Real Event Detection Feed & Explorer Links
        print("Inspecting Real Detection Feed & Explorer Links...")
        await page.evaluate("window.scrollTo({ top: 550, behavior: 'smooth' })")
        await asyncio.sleep(1.5)
        await smooth_move(page, "#events-table-body", steps=25)
        await asyncio.sleep(3.0)

        # Step 8: Scroll to Footer
        print("Viewing Footer & Architecture notice...")
        await page.evaluate("window.scrollTo({ top: 1200, behavior: 'smooth' })")
        await asyncio.sleep(2.5)

        # Hold final frame
        await asyncio.sleep(3.0)

        video_path = await page.video.path()
        await context.close()
        await browser.close()
        print(f"Playwright video recorded to: {video_path}")
        return video_path

def merge_video_audio(video_file: str, audio_file: str, srt_file: str, output_file: str):
    print(f"Merging video and audio with FFmpeg into: {output_file}")
    
    # Get audio duration
    probe_cmd = [
        "ffprobe", "-i", audio_file,
        "-show_entries", "format=duration",
        "-v", "quiet", "-of", "csv=p=0"
    ]
    audio_dur = float(subprocess.check_output(probe_cmd).decode().strip())
    print(f"Audio duration: {audio_dur:.2f}s")

    # Get video duration
    probe_v_cmd = [
        "ffprobe", "-i", video_file,
        "-show_entries", "format=duration",
        "-v", "quiet", "-of", "csv=p=0"
    ]
    video_dur = float(subprocess.check_output(probe_v_cmd).decode().strip())
    print(f"Video duration: {video_dur:.2f}s")

    # Run FFmpeg to encode 1080p MP4 with AAC audio
    # If video is slightly longer or shorter, tpad or trim
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", video_file,
        "-i", audio_file,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-r", "30",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_file
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print(f"Final MP4 successfully produced: {output_file}")

async def main():
    base_dir = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot")
    demo_dir = base_dir / "demo"
    demo_dir.mkdir(parents=True, exist_ok=True)

    app_url = "https://pharos-on-chain-alert-bot.vercel.app"
    audio_file = str(demo_dir / "narration.mp3")
    srt_file = str(demo_dir / "narration.srt")
    final_video = str(demo_dir / "pharos-on-chain-alert-bot-walkthrough.mp4")

    # 1. Generate Voiceover & Subtitles
    await generate_narration(audio_file, srt_file)

    # 2. Record Live Workflow
    raw_video_file = await record_screen_workflow(app_url, str(demo_dir / "raw"))

    # 3. Merge Audio and Video
    merge_video_audio(raw_video_file, audio_file, srt_file, final_video)

if __name__ == "__main__":
    asyncio.run(main())
