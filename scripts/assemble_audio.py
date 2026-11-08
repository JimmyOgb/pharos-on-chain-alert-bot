import subprocess
from pathlib import Path

demo_dir = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/audio")
output_audio = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/master_narration.wav")

# Generate 0.4s silence
silence_file = demo_dir / "silence_04.wav"
subprocess.run([
    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
    "-t", "0.4", str(silence_file)
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Generate 0.5s initial silence
lead_silence = demo_dir / "silence_05.wav"
subprocess.run([
    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
    "-t", "0.5", str(lead_silence)
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Build concat list
concat_list = [f"file '{lead_silence.resolve().as_posix()}'"]
for i in range(1, 11):
    seg_file = demo_dir / f"seg_{i:02d}.wav"
    concat_list.append(f"file '{seg_file.resolve().as_posix()}'")
    if i < 10:
        concat_list.append(f"file '{silence_file.resolve().as_posix()}'")

concat_txt = demo_dir / "concat.txt"
concat_txt.write_text("\n".join(concat_list), encoding="utf-8")

subprocess.run([
    "ffmpeg", "-y", "-f", "concat", "-safe", "0",
    "-i", str(concat_txt),
    "-c:a", "pcm_s16le",
    str(output_audio)
], check=True)

# Probe final duration
probe_cmd = [
    "ffprobe", "-i", str(output_audio),
    "-show_entries", "format=duration",
    "-v", "quiet", "-of", "csv=p=0"
]
final_dur = float(subprocess.check_output(probe_cmd).decode().strip())
print(f"Master narration WAV created: {output_audio}")
print(f"Duration: {final_dur:.2f} seconds")
