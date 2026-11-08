import subprocess
from pathlib import Path

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
demo_dir.mkdir(parents=True, exist_ok=True)

ps_lines = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$synth.Rate = 0",
    "$synth.Volume = 100"
]

for idx, text in sentences:
    wav_path = str(demo_dir / f"seg_{idx}.wav").replace("/", "\\")
    clean_text = text.replace("'", "''")
    ps_lines.append(f"$synth.SetOutputToWaveFile('{wav_path}')")
    ps_lines.append(f"$synth.Speak('{clean_text}')")

ps_lines.append("$synth.Dispose()")
ps_lines.append("Write-Output 'AUDIO GENERATION COMPLETE'")

ps_file = demo_dir / "gen_all_audio.ps1"
ps_file.write_text("\n".join(ps_lines), encoding="utf-8")

res = subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", str(ps_file)], capture_output=True, text=True)
print("Return code:", res.returncode)
print("STDOUT:", res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
