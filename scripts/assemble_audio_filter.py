import subprocess
from pathlib import Path

demo_dir = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/audio")
output_audio = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/master_narration.wav")

cmd = ["ffmpeg", "-y"]
filter_inputs = []

# 10 audio segments
for i in range(1, 11):
    seg_file = demo_dir / f"seg_{i:02d}.wav"
    cmd.extend(["-i", str(seg_file)])
    filter_inputs.append(f"[{i-1}:a]")

filter_complex = f"{''.join(filter_inputs)}concat=n=10:v=0:a=1[outa]"
cmd.extend([
    "-filter_complex", filter_complex,
    "-map", "[outa]",
    "-c:a", "pcm_s16le",
    str(output_audio)
])

subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

probe_cmd = [
    "ffprobe", "-i", str(output_audio),
    "-show_entries", "format=duration",
    "-v", "quiet", "-of", "csv=p=0"
]
final_dur = float(subprocess.check_output(probe_cmd).decode().strip())
print(f"Master narration WAV created via filter_complex: {output_audio}")
print(f"Exact total duration: {final_dur:.2f} seconds")
