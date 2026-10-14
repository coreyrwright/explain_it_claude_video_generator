"""Turn the chosen Veo cue (assets/audio/music/<music.pick>.wav from gen-music.mjs) into a loop and an ending.

Tempo, key and the picked clip come from project.json (music.bpm, music.key, music.pick).
Stretches the clip to exactly that tempo, picks a 2-bar loop that starts on a tonic (G) downbeat with a clean
seam, and writes to assets/audio/music/:
  loop.wav    2 bars (+25 ms pre-roll, +20 ms crossfade tail) starting on the downbeat
  ending.wav  the held tonic chord with a reverb tail (placed by mix.py at cues.music.final)
  music.json  grid facts (bpm, bar, pre/xf samples, loop start in the stretched clip)
Usage: python music_cartoon.py [source.wav]
"""
import json, os, subprocess, sys
import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402   (reverb_ir)

SR = 48000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CFG = json.load(open(os.path.join(ROOT, 'project.json')))
MUS = CFG.get('music', {})
BPM = float(MUS.get('bpm', 112))
BEAT = 60 / BPM
BAR = 4 * BEAT
M = os.path.join(ROOT, 'assets/audio/music')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(M, MUS.get('pick', 'cartoon_marimba') + '.wav')


def tonic_triad(key):
    """Pitch classes of the tonic triad for a key such as 'G major', 'F# minor' or 'Bb major'."""
    notes = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    parts = key.split()
    root = notes[parts[0][0].upper()] + (1 if '#' in parts[0] else -1 if parts[0].endswith('b') and len(parts[0]) > 1 else 0)
    third = 3 if len(parts) > 1 and parts[1].lower().startswith('min') else 4
    return [root % 12, (root + third) % 12, (root + 7) % 12]


TONIC_PCS = tonic_triad(MUS.get('key', 'G major'))


def load(p, ch=2):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def save(p, x):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', p],
                   input=np.ascontiguousarray(x, np.float32).tobytes(), check=True)


def beat_grid(x, lo=BEAT * 0.85, hi=BEAT * 1.18):
    mono = x.mean(1); hop = 256; n = 1024
    fr = np.lib.stride_tricks.sliding_window_view(mono, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1))
    flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(1); flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    fps = SR / hop; t = np.arange(len(flux)) / fps; best = (-1e9, None, None)
    for p in np.arange(lo, hi, 0.0003):
        for ph in np.arange(0, p, 1 / fps):
            sc = np.interp(np.arange(ph, t[-1], p), t, flux).mean()
            if sc > best[0]: best = (sc, p, ph)
    return best[1], best[2]


raw = load(SRC)
p0, _ = beat_grid(raw)
st = os.path.join(M, 'cartoon_112.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', SRC, '-af', f'atempo={p0 / BEAT:.5f}', '-ar', str(SR), st], check=True)
A = load(st)
p1, ph1 = beat_grid(A, BEAT * 0.97, BEAT * 1.03)
print(f'source {60 / p0:.2f} BPM -> {60 / p1:.2f} BPM (target {BPM}), first beat {ph1:.3f}s, clip {len(A) / SR:.2f}s')
beats = np.arange(ph1, len(A) / SR - 0.05, p1)
L = int(round(2 * BAR * SR)); PRE = int(0.025 * SR); XF = int(0.020 * SR)


def chroma(x):
    f = np.fft.rfftfreq(len(x), 1 / SR); S = np.abs(np.fft.rfft(x.mean(1) * np.hanning(len(x))))
    keep = (f > 80) & (f < 2000); pc = np.round(12 * np.log2(f[keep] / 440.0) + 9).astype(int) % 12
    return np.bincount(pc, weights=S[keep] ** 2, minlength=12)


TONIC = np.zeros(12); TONIC[TONIC_PCS] = 1
def seam(s0):
    s = int(s0 * SR); w = int(0.12 * SR)
    x1, x2 = A[s + L - w:s + L].mean(1), A[max(0, s - w):s].mean(1)
    if len(x2) < w: return 0.0
    f1, f2 = np.abs(np.fft.rfft(x1 * np.hanning(w))), np.abs(np.fft.rfft(x2 * np.hanning(w)))
    return float(np.dot(f1, f2) / (np.linalg.norm(f1) * np.linalg.norm(f2) + 1e-9))
def tonic(s0):
    c = chroma(A[int(s0 * SR):int((s0 + BEAT) * SR)]); return float(np.dot(c / (c.sum() + 1e-9), TONIC))
cands = [b for b in beats if b * SR + L + XF + 0.02 * SR < len(A) and b > 0.05]
scored = sorted(((tonic(b) + 0.5 * seam(b), tonic(b), seam(b), b) for b in cands), reverse=True)
for s in scored[:4]: print('  cand start %.3f score %.2f tonic %.2f seam %.2f' % (s[3], s[0], s[1], s[2]))
start = scored[0][3]; s0 = int(start * SR)
seg = A[s0 - PRE:s0 - PRE + L + XF].copy()
save(os.path.join(M, 'loop.wav'), seg)
# ending: the loop's opening chord (tonic downbeat) held 0.6 s, then decaying with a reverb tail
hit = A[s0 - PRE:s0 - PRE + int(2.4 * SR)].copy()
hit[:XF] *= np.sin(np.linspace(0, np.pi / 2, XF))[:, None]
hit *= np.concatenate([np.ones(int(0.6 * SR)), np.cos(np.linspace(0, np.pi / 2, len(hit) - int(0.6 * SR)))])[:, None]
ir = dsp.reverb_ir(3.6)
wet = np.stack([signal.fftconvolve(hit[:, c], ir[:, c]) for c in range(2)], 1) * 0.6
tail = np.zeros((len(wet), 2)); tail[:len(hit)] += hit; tail += wet
f0 = len(tail) - int(1.2 * SR); tail[f0:] *= np.cos(np.linspace(0, np.pi / 2, len(tail) - f0))[:, None] ** 2
save(os.path.join(M, 'ending.wav'), tail)
json.dump({'bpm': BPM, 'bar': BAR, 'pre': PRE, 'xf': XF, 'loop_len': L, 'loop_start_in_clip': start, 'source_bpm': 60 / p0,
           'stretched_bpm': 60 / p1, 'score': scored[0][0]}, open(os.path.join(M, 'music.json'), 'w'), indent=1)
print('wrote loop.wav (%.3f s), ending.wav (%.2f s)' % (len(seg) / SR, len(tail) / SR))
