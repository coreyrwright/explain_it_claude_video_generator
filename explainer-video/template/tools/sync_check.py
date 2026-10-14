"""Audio-to-animation sync check, two ways, per chapter:
 1. Whole-chapter offset: cross-correlates where the voice stem is speaking with where
    js/vo-timing.js (which drives the animation and the captions) says words are. Catches a
    chapter that is shifted as a block (limit 120 ms; voice activity includes breaths, so a small
    negative bias is normal).
 2. Beat accuracy: for every word that follows a pause (the words scene changes are keyed to),
    the real sound onset in the stem against the timing. Median limit 40 ms, none beyond 120 ms.
Negative = the voice comes before the animation expects it.
Usage: python sync_check.py   (exit code 1 on failure)"""
import json, os, re, subprocess, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SR = 48000
cues = json.load(open(os.path.join(ROOT, 'assets/audio/cues.json')))
timing = json.loads(re.search(r'window\.VO_TIMING = (\{.*\});', open(os.path.join(ROOT, 'js/vo-timing.js')).read()).group(1))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ROOT, 'assets/audio/stem_vo.wav'), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
PRE, W = cues['pre'], timing['words']


def envelope(hop):
    n = len(x) // hop
    return 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12))


# 1. whole-chapter offset (10 ms frames)
e10 = envelope(480)
speech = (e10 > -45).astype(float)
expect = np.zeros(len(e10))
for _, a, b in W:
    expect[int((PRE + a) * 100):int((PRE + b) * 100)] = 1
# 2. onsets (2 ms frames)
e2 = envelope(96)
fr = lambda t: int(round(t * SR / 96))


def onset(prev_end, start):
    a, b = fr(max(prev_end + 0.02, start - 0.22)), fr(start + 0.12)
    seg = e2[a:b]
    quiet = np.where(seg < -55)[0]
    if not len(quiet): return None
    for i in range(quiet[0], len(seg) - 10):
        if seg[i] > -42 and e2[a + i:a + i + 10].mean() > -36:
            return (a + i) * 96 / SR
    return None


ok, lines = True, []
for ci, ch in enumerate(timing['chapters']):
    if 't1' not in ch:                                  # estimated timing has no chapter ends: use the last word of the chapter
        nxt = timing['chapters'][ci + 1]['t0'] if ci + 1 < len(timing['chapters']) else W[-1][2] + 1
        ch['t1'] = max((w[2] for w in W if ch['t0'] <= w[1] < nxt), default=nxt)
    s, e = int((PRE + ch['t0']) * 100), int((PRE + ch['t1']) * 100)
    best = (-1, 0)
    for lag in range(-150, 151):
        a = speech[max(0, s + lag):e + lag]
        score = float((a * expect[s:s + len(a)]).sum())
        if score > best[0]: best = (score, lag)
    block = best[1] * 10
    errs = []
    for i in range(1, len(W)):
        w, a, b = W[i]
        if not (ch['t0'] - 0.01 <= a <= ch['t1']) or a - W[i - 1][2] < 0.15: continue
        t = onset(PRE + W[i - 1][2], PRE + a)
        if t is not None: errs.append((t - PRE - a) * 1000)
    med = float(np.median(errs)) if errs else 0.0
    worst = max((abs(v) for v in errs), default=0.0)
    good = abs(block) <= 120 and abs(med) <= 40 and worst <= 120
    ok &= good
    lines.append(f"chapter {ch['num']}: block offset {block:+d} ms; sentence onsets median {med:+.0f} ms, worst {worst:.0f} ms ({len(errs)} words) {'ok' if good else 'OFF'}")
print('\n'.join(lines))
print(f"{'PASS' if ok else 'FAIL'} sync: all chapters within limits" if ok else 'FAIL sync: see chapters marked OFF')
sys.exit(0 if ok else 1)
