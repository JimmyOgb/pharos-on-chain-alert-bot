import subprocess
from pathlib import Path
from datetime import timedelta

sentences = [
    ("01", "Welcome to the official demonstration of the Pharos On-Chain Alert Bot, built for the Pharos Agent Arena."),
    ("02", "This autonomous monitoring agent tracks live blockchain events on the Pharos Atlantic Testnet, verifies configurable conditions, and delivers real-time notifications with zero repeat spam."),
    ("03", "Here on the production dashboard, we see live network telemetry connected to Atlantic Testnet at Chain ID 688689, with continuous block tracking and active deduplication safeguards."),
    ("04", "First, we activate a pre-configured alert condition: the Atlantic USDC Whale Alert, monitoring Test USDC transfers exceeding fifty dollars."),
    ("05", "Next, we create a custom alert condition through the configuration modal, specifying an Atlantic Micro-Activity Sentinel tracking transfers of zero point zero zero one USDC."),
    ("06", "Now, let's trigger a live on-chain block scan. The scanner evaluates recent Atlantic Testnet blocks directly against the official DP Labs RPC."),
    ("07", "The scan audit report appears instantly, confirming the exact block range, evaluated logs, and serverless execution latency."),
    ("08", "Crucially, our system enforces a deterministic deduplication invariant. When a consecutive scan executes over the same blocks, existing events are recognized and deduplicated, preventing any duplicate spam."),
    ("09", "Every detected alert includes full event context: transaction activity, formatted values, block numbers, and verified clickable PharosScan explorer links."),
    ("10", "With a zero-cost serverless architecture, comprehensive test coverage, and transparent execution, the Pharos On-Chain Alert Bot delivers enterprise-grade blockchain monitoring. Thank you.")
]

demo_dir = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/audio")

def format_srt_time(seconds: float) -> str:
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

srt_entries = []
current_time = 0.0

for i, (idx, text) in enumerate(sentences):
    wav_path = demo_dir / f"seg_{idx}.wav"
    probe_cmd = [
        "ffprobe", "-i", str(wav_path),
        "-show_entries", "format=duration",
        "-v", "quiet", "-of", "csv=p=0"
    ]
    dur = float(subprocess.check_output(probe_cmd).decode().strip())
    start_time = current_time
    end_time = current_time + dur
    srt_entries.append(f"{i+1}\n{format_srt_time(start_time)} --> {format_srt_time(end_time)}\n{text}\n")
    current_time = end_time

srt_content = "\n".join(srt_entries)
srt_file = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/pharos-on-chain-alert-bot-walkthrough.srt")
srt_file.write_text(srt_content, encoding="utf-8")
print(f"SRT generated with exact sync ({current_time:.2f}s total)")
