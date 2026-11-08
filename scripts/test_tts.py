import subprocess
from pathlib import Path

script_content = """
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0
$synth.Volume = 100
$outPath = 'C:\\Users\\NO GO NO\\pharosbuild\\skills\\pharos-on-chain-alert-bot\\demo\\test_sapi.wav'
$synth.SetOutputToWaveFile($outPath)
$synth.Speak('Welcome to the Pharos On-Chain Alert Bot live demonstration.')
$synth.Dispose()
Write-Output "SAPI SUCCESS"
"""

ps_file = Path("C:/Users/NO GO NO/pharosbuild/skills/pharos-on-chain-alert-bot/demo/sapi_gen.ps1")
ps_file.write_text(script_content, encoding="utf-8")

res = subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", str(ps_file)], capture_output=True, text=True)
print("Return code:", res.returncode)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
