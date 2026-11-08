import subprocess
import os
from pathlib import Path

demo_dir = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo")
os.chdir(demo_dir)

cmd = [
    "ffmpeg", "-y",
    "-i", "pharos-on-chain-alert-bot-walkthrough.mp4",
    "-vf", "subtitles=pharos-on-chain-alert-bot-walkthrough.srt:force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,MarginV=35'",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-c:a", "copy",
    "pharos-on-chain-alert-bot-walkthrough-subtitled.mp4"
]

print("Executing subtitle burning with relative path...")
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0:
    print("Burned subtitles MP4 created successfully!")
else:
    print("Error:", res.stderr[-400:])
