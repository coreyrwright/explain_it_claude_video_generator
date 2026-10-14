"""Snap words that follow a pause to their real sound onset in the narration.
Speech-to-text models tend to place a word's start up to ~100 ms after the audible onset when the
word follows a silence; many scene changes are keyed to exactly those sentence-opening words.
For each such word, search a window before and just after its current start for the point where
the voice rises out of the pause, and move the start there. Run after align.mjs.
Usage: python snap_onsets.py"""
import json, os, re, subprocess
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SR, HOP = 48000, 96                                    # 2 ms frames
path = os.path.join(ROOT, 'js/vo-timing.js')
src = open(path).read()
timing = json.loads(re.search(r'window\.VO_TIMING = (\{.*\});', src).group(1))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ROOT, 'assets/audio/vo/vo.wav'), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
n = len(x) // HOP
env = 20 * np.log10(np.sqrt((x[:n * HOP].reshape(n, HOP) ** 2).mean(1) + 1e-12))
fr = lambda t: int(round(t * SR / HOP))


def onset(prev_end, start):
    """First frame where the voice rises out of the pause before `start`, or None."""
    a, b = fr(max(prev_end + 0.02, start - 0.22)), fr(start + 0.08)
    seg = env[a:b]
    quiet = np.where(seg < -55)[0]                     # must pass through real silence first
    if not len(quiet): return None
    for i in range(quiet[0], len(seg) - 10):
        if seg[i] > -42 and env[a + i:a + i + 10].mean() > -36:
            return (a + i) * HOP / SR
    return None


W = timing['words']
moved = []
for i in range(1, len(W)):
    w, s, e = W[i]
    if s - W[i - 1][2] < 0.15: continue                # connected speech: keep the aligned start
    t = onset(W[i - 1][2], s)
    if t is not None and abs(t - s) > 0.01:
        moved.append((w, round((t - s) * 1000)))
        W[i][1] = round(t, 3)
timing['snapped'] = len(moved)
open(path, 'w').write(re.sub(r'window\.VO_TIMING = \{.*\};', lambda m: 'window.VO_TIMING = ' + json.dumps(timing) + ';', src, count=1))
d = [m for _, m in moved]
print(f'snapped {len(moved)} sentence-opening words; shift median {np.median(d) if d else 0:.0f} ms, range {min(d) if d else 0}..{max(d) if d else 0} ms')
print('  ' + ', '.join(f'{w} {m:+d}' for w, m in moved))
