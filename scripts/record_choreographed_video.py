import asyncio
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

CURSOR_JS = """
() => {
  if (document.getElementById('demo-cursor')) return;
  const cursor = document.createElement('div');
  cursor.id = 'demo-cursor';
  Object.assign(cursor.style, {
    position: 'fixed', top: '0px', left: '0px',
    width: '26px', height: '26px',
    background: 'rgba(239, 68, 68, 0.88)',
    border: '2.5px solid white', borderRadius: '50%',
    boxShadow: '0 0 16px rgba(239, 68, 68, 0.8)',
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
    cursor.style.transform = 'translate(-50%, -50%) scale(0.65)';
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px',
      width: '12px', height: '12px', borderRadius: '50%',
      border: '2.5px solid rgba(239, 68, 68, 0.95)',
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: '1', pointerEvents: 'none', zIndex: '999998',
      transition: 'all 0.5s ease-out'
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(4.5)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 500);
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  });
}
"""

async def smooth_move(page, selector: str, steps: int = 35):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=12000)
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await page.mouse.move(target_x, target_y, steps=steps)

async def smooth_click(page, selector: str, pause_after: float = 1.0):
    loc = page.locator(selector).first
    await loc.wait_for(state="visible", timeout=12000)
    box = await loc.bounding_box()
    if box:
        target_x = box["x"] + box["width"] / 2
        target_y = box["y"] + box["height"] / 2
        await page.mouse.move(target_x, target_y, steps=30)
        await asyncio.sleep(0.25)
        await page.mouse.click(target_x, target_y)
    else:
        await loc.click()
    await asyncio.sleep(pause_after)

async def smooth_type(page, selector: str, text: str, pause_after: float = 0.8):
    await smooth_click(page, selector, pause_after=0.2)
    await page.keyboard.type(text, delay=50)
    await asyncio.sleep(pause_after)

async def run_choreography():
    app_url = "http://localhost:3000"
    raw_dir = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/raw_video")
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("Launching Chromium for 1080p live session recording...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(raw_dir),
            record_video_size={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        # SEGMENT 01 (0.0s -> 6.87s, duration 6.87s): Welcome & Intro
        print("[01] Opening production dashboard...")
        await page.goto(app_url, wait_until="domcontentloaded")
        await page.wait_for_selector("#network-pill", state="visible", timeout=15000)
        await page.evaluate(CURSOR_JS)
        await asyncio.sleep(1.0)
        await smooth_move(page, ".brand", steps=30)
        await asyncio.sleep(4.5)

        # SEGMENT 02 (6.87s -> 19.33s, duration 12.46s): Atlantic Testnet & Network Badge
        print("[02] Highlighting Atlantic Testnet badge and chain parameters...")
        await smooth_move(page, "#network-pill", steps=35)
        await asyncio.sleep(3.0)
        await smooth_move(page, "#header-chain-id", steps=25)
        await asyncio.sleep(6.5)

        # SEGMENT 03 (19.33s -> 34.29s, duration 14.96s): Telemetry & Deduplication Status
        print("[03] Inspecting telemetry cards...")
        await smooth_move(page, "#stat-latest-block", steps=25)
        await asyncio.sleep(2.5)
        await smooth_move(page, "#stat-cursor-block", steps=25)
        await asyncio.sleep(2.5)
        await smooth_move(page, "#stat-active-alerts", steps=25)
        await asyncio.sleep(2.0)
        await smooth_move(page, "#stat-dedup-status", steps=25)
        await asyncio.sleep(5.5)

        # SEGMENT 04 (34.29s -> 45.32s, duration 11.03s): Preset Activation
        print("[04] Activating Atlantic USDC Whale Alert preset...")
        await smooth_move(page, '.btn-preset[data-preset="usdc-whale"]', steps=30)
        await asyncio.sleep(1.0)
        await smooth_click(page, '.btn-preset[data-preset="usdc-whale"]', pause_after=2.0)
        await smooth_move(page, "#alerts-table-body", steps=25)
        await asyncio.sleep(5.5)

        # SEGMENT 05 (45.32s -> 57.48s, duration 12.16s): Custom Alert Condition Modal
        print("[05] Opening Custom Alert modal and filling parameters...")
        await smooth_click(page, "#btn-open-create-modal", pause_after=1.2)
        await smooth_type(page, "#rule-name", "Atlantic Micro-Activity Sentinel", pause_after=0.5)
        
        # Threshold
        await smooth_click(page, "#rule-threshold", pause_after=0.2)
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await page.keyboard.type("0.001", delay=45)
        await asyncio.sleep(0.4)

        # Contract
        await smooth_type(page, "#rule-contract", "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b", pause_after=0.5)
        await smooth_click(page, 'button[type="submit"]', pause_after=1.5)
        await asyncio.sleep(3.5)

        # SEGMENT 06 (57.48s -> 68.11s, duration 10.63s): Trigger Live Block Scan
        print("[06] Triggering live on-chain block scan...")
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        await asyncio.sleep(1.0)
        await smooth_click(page, "#btn-manual-scan", pause_after=4.0)
        await asyncio.sleep(4.5)

        # SEGMENT 07 (68.11s -> 77.50s, duration 9.39s): Scan Report Inspection
        print("[07] Inspecting Scan Execution Audit report...")
        await smooth_move(page, "#scan-report-panel", steps=25)
        await asyncio.sleep(2.0)
        await smooth_move(page, "#scan-status-badge", steps=20)
        await asyncio.sleep(5.5)

        # SEGMENT 08 (77.50s -> 92.04s, duration 14.54s): Deduplication Invariant
        print("[08] Triggering consecutive scan for deduplication invariant...")
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' })")
        await asyncio.sleep(1.0)
        await smooth_click(page, "#btn-manual-scan", pause_after=3.5)
        await smooth_move(page, "#stat-dedup-status", steps=25)
        await asyncio.sleep(8.0)

        # SEGMENT 09 (92.04s -> 102.84s, duration 10.80s): Events Feed & Explorer
        print("[09] Viewing Events Feed & Explorer links...")
        await page.evaluate("window.scrollTo({ top: 520, behavior: 'smooth' })")
        await asyncio.sleep(1.5)
        await smooth_move(page, "#events-table-body", steps=25)
        await asyncio.sleep(7.5)

        # SEGMENT 10 (102.84s -> 116.21s, duration 13.37s): Wrap up & Footer
        print("[10] Viewing Footer and conclusion...")
        await page.evaluate("window.scrollTo({ top: 1200, behavior: 'smooth' })")
        await asyncio.sleep(1.5)
        await smooth_move(page, ".app-footer a", steps=25)
        await asyncio.sleep(9.5)

        # Save and close
        print("Finishing video recording...")
        video_path = await page.video.path()
        await context.close()
        await browser.close()
        print(f"Playwright video recorded to: {video_path}")

    # Merge audio & video
    master_audio = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/master_narration.wav")
    final_output = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/pharos-on-chain-alert-bot-walkthrough.mp4")
    
    print(f"Merging video and audio into: {final_output}")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-i", str(master_audio),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-r", "30",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(final_output)
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print("SUCCESS: 1080p Walkthrough video with narration successfully produced!")
    return str(final_output)

if __name__ == "__main__":
    asyncio.run(run_choreography())
