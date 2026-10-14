"""Objective glitch scan for narration takes: finds abrupt level drops inside
speech (dropouts), sample discontinuities (clicks) and clipping."""
import subprocess, sys, numpy as np

def load(path, sr=48000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32), sr

for path in sys.argv[1:]:
    x, sr = load(path)
    hop = int(sr * 0.01)
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    speech = db > -35
    # dropout: a frame < -60 dB with speech >-30 dB within 30 ms on BOTH sides (a hole inside a word)
    drops = []
    for i in range(3, n - 3):
        if db[i] < -60 and db[i - 3:i].max() > -30 and db[i + 1:i + 4].max() > -30:
            drops.append(i * 0.01)
    # clicks: sample-to-sample jumps far above local derivative statistics
    d = np.abs(np.diff(x))
    thr = max(0.25, np.percentile(d, 99.99) * 1.5)
    clicks = np.where(d > thr)[0] / sr
    clip = np.mean(np.abs(x) > 0.999)
    print(f'{path.split("/")[-1]}: dur {len(x)/sr:.2f}s peak {np.abs(x).max():.3f} clipped {clip*100:.3f}% '
          f'speech {speech.mean()*100:.0f}% dropouts {len(drops)} {[round(t,2) for t in drops[:12]]} '
          f'clicks {len(clicks)} {[round(t,3) for t in clicks[:8]]}')
