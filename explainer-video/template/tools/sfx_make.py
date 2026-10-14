"""Build the 11 sound effects into assets/audio/sfx/<name>.wav (48 kHz mono, peak -6 dBFS, no leading silence).
All synthesized (numpy), including a cartoon record-scratch. Deterministic. Usage: python sfx_make.py"""
import os, subprocess
import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'assets/audio/sfx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
T = lambda d: np.arange(int(d * SR)) / SR


def bp(x, lo, hi, o=2):
    b, a = signal.butter(o, [lo / (SR / 2), hi / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def lp(x, f, o=2):
    b, a = signal.butter(o, f / (SR / 2)); return signal.lfilter(b, a, x)
def hp(x, f, o=2):
    b, a = signal.butter(o, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def noise(d): return rng.standard_normal(int(d * SR))
def fade(x, a=0.002, r=0.02):
    x = x.copy(); n = min(len(x), int(a * SR)); x[:n] *= np.linspace(0, 1, n)
    n = min(len(x), int(r * SR)); x[-n:] *= np.linspace(1, 0, n); return x
def put(dst, src, t):
    i = int(t * SR); n = min(len(src), len(dst) - i)
    if n > 0: dst[i:i + n] += src[:n]
def finish(name, x, peak_db=-6.0):
    x = x[:int(np.flatnonzero(np.abs(x) > 1e-4 * np.abs(x).max())[-1]) + 1]
    x = x / np.abs(x).max() * 10 ** (peak_db / 20)
    x = np.concatenate([x, np.zeros(0)])
    p = os.path.join(OUT, name + '.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'pcm_s16le', p], input=x.astype(np.float32).tobytes(), check=True)
    print(f'{name}.wav {len(x) / SR:.2f} s')


def tone(f, d, parts=((1, 1, 0.3),), glide=None):
    t = T(d); ph = 2 * np.pi * np.cumsum(f if glide is None else glide) / SR if glide is not None else None
    out = np.zeros_like(t)
    for r, a, dec in parts:
        arg = 2 * np.pi * f * r * t if glide is None else r * ph
        out += a * np.sin(arg) * np.exp(-t / dec)
    return out


# pop: soft bubble, rising pitch blip with fast decay
t = T(0.14); f = 330 + 700 * (1 - np.exp(-t / 0.018))
pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) + 0.15 * lp(noise(0.14), 2500) * np.exp(-t / 0.004)
finish('pop', fade(pop, 0.001, 0.03))

# click: UI tick
t = T(0.05)
click = bp(noise(0.05), 1500, 6000) * np.exp(-t / 0.004) + 0.5 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.006)
finish('click', fade(click, 0.0005, 0.01))

# ding: bell, two stacked inharmonic partials with a long-ish decay
t = T(1.1)
ding = sum(a * np.sin(2 * np.pi * 1318.5 * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, 0.45), (2.76, 0.28, 0.16), (5.4, 0.1, 0.06), (0.5, 0.3, 0.3)))
finish('ding', fade(ding, 0.001, 0.15))

# sparkle: random fast high bell notes on a pentatonic scale, brightness falling
out = np.zeros(int(1.1 * SR)); penta = [1568, 1760, 2093, 2349, 2637, 3136, 3520]
for k in range(16):
    tt = k * 0.052 + rng.random() * 0.015; f0 = penta[min(len(penta) - 1, int(k / 16 * 6) + rng.integers(0, 2))]
    t = T(0.35); n = (np.sin(2 * np.pi * f0 * t) + 0.3 * np.sin(2 * np.pi * f0 * 2.76 * t)) * np.exp(-t / 0.07) * (1 - k / 22)
    put(out, n, tt)
finish('sparkle', fade(out, 0.001, 0.15))

# type: ~1.5 s of key clicks with a rhythm (about 11 keys, one louder space bar thunk)
out = np.zeros(int(1.5 * SR)); tt = 0.0
for k in range(11):
    t = T(0.06); amp = 0.7 + 0.3 * rng.random()
    key = (bp(noise(0.06), 1800 + 700 * rng.random(), 7000) * np.exp(-t / 0.006) + 0.6 * np.sin(2 * np.pi * (700 + 250 * rng.random()) * t) * np.exp(-t / 0.008)) * amp
    put(out, key, tt); tt += 0.075 + 0.1 * rng.random() * (1.8 if k in (4, 8) else 1)
finish('type', fade(out, 0.0005, 0.04))

# whoosh: noise swept low -> high -> low, 0.7 s
n = 0.7; t = T(n); N = noise(n); out = np.zeros_like(N); blk = 256
zi = None
for i in range(0, len(N), blk):
    p = i / len(N); fc = 300 * (9000 / 300) ** np.sin(np.pi * p) ** 1.0
    b, a = signal.butter(2, [max(150, fc * 0.6) / (SR / 2), min(fc * 1.3, 20000) / (SR / 2)], 'band')
    seg, = [signal.lfilter(b, a, N[i:i + blk])]; out[i:i + blk] = seg   # per-block (continuity handled by the envelope)
env = np.sin(np.pi * t / n) ** 1.6
finish('whoosh', fade(out * env, 0.01, 0.1))

# swoosh: shorter, airier paper-slide, rising
n = 0.38; t = T(n); N = noise(n); out = np.zeros_like(N)
for i in range(0, len(N), blk):
    p = i / len(N); fc = 1500 + 5000 * p
    b, a = signal.butter(2, [fc * 0.6 / (SR / 2), min(fc * 1.5, 21000) / (SR / 2)], 'band'); out[i:i + blk] = signal.lfilter(b, a, N[i:i + blk])
env = np.sin(np.pi * np.clip(t / n, 0, 1) ** 0.7) ** 1.3
finish('swoosh', fade(out * env, 0.01, 0.06))

# boing: spring, a wobbling falling-rising pitch with decaying vibrato
t = T(0.8); f = 220 * (1 + 0.9 * np.exp(-t / 0.12)) * (1 + 0.06 * np.sin(2 * np.pi * 22 * t) * np.exp(-t / 0.35))
ph = 2 * np.pi * np.cumsum(f) / SR
boing = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * np.exp(-t / 0.28)
finish('boing', fade(lp(boing, 5000), 0.003, 0.1))


# vowel helper: glottal-ish saw through formant resonators
def vowel(f0, forms, d, amp_env):
    t = T(d); ph = 2 * np.pi * np.cumsum(f0 if np.ndim(f0) else np.full(len(t), f0)) / SR
    src = signal.sawtooth(ph) + 0.03 * rng.standard_normal(len(t)); out = np.zeros_like(src)
    for fc, bw, g in forms:
        b, a = signal.iirpeak(fc / (SR / 2), fc / bw); out += g * signal.lfilter(b, a, src)
    return out * amp_env(t)

# sneeze: inhale "ah-ah" (rising pitch, twice), a silent beat, burst "tsh" and falling "oo"
AH = [(750, 90, 1.0), (1150, 110, 0.6), (2600, 200, 0.2)]; OO = [(330, 70, 1.0), (800, 100, 0.35), (2400, 200, 0.05)]
out = np.zeros(int(1.5 * SR))
d = 0.26; t = T(d)
a1 = vowel(260 + 150 * t / d, AH, d, lambda t: np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.8 * 0.8)
put(out, a1 * 0.5, 0.0)
d2 = 0.3; a2 = vowel(300 + 260 * T(d2) / d2, AH, d2, lambda t: np.sin(np.pi * np.clip(t / d2, 0, 1)) ** 0.8)
put(out, a2 * 0.8, 0.34)
burst = bp(noise(0.14), 1500, 9000) * np.exp(-T(0.14) / 0.04) * 1.6
put(out, burst, 0.78)
d3 = 0.42; t3 = T(d3); f3 = 520 * np.exp(-t3 / 0.35) + 150
oo = vowel(f3, OO, d3, lambda t: np.exp(-t / 0.2) * np.minimum(t / 0.01, 1))
put(out, oo * 1.1, 0.80)
finish('sneeze', fade(out, 0.004, 0.08))

# scratch: cartoon record scratch. Two quick "wicka-wicka" back-and-forth strokes (a noisy, vinyl-like buzz whose
# pitch and speed swing up and down), then a short falling "needle drag" ending in a soft thud. About 0.7 s.
def scratch_stroke(d, f_lo, f_hi, up):
    t = T(d); u = t / d; u = u if up else 1 - u
    f = f_lo * (f_hi / f_lo) ** u                                   # pitch glides up or down
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone_ = signal.sawtooth(ph) + 0.6 * signal.square(ph * 1.51)    # buzzy, slightly inharmonic
    grit = hp(noise(d), 1500) * 0.8
    x = bp(tone_ * 0.6 + grit, 400, 7500, 2)
    x *= (0.75 + 0.25 * signal.square(2 * np.pi * (38 + 40 * u) * t))   # groove chatter
    return x * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.6
sc = np.zeros(int(0.8 * SR)); tt = 0.0
for d, lo, hi, up in ((0.11, 180, 1500, True), (0.10, 220, 1700, False), (0.12, 200, 1900, True), (0.10, 250, 1800, False)):
    put(sc, scratch_stroke(d, lo, hi, up), tt); tt += d + 0.012
dd = 0.2; td = T(dd); fd = 1300 * np.exp(-td / 0.06) + 120
drag = bp(signal.sawtooth(2 * np.pi * np.cumsum(fd) / SR) * 0.7 + hp(noise(dd), 1200) * 0.5, 120, 6000) * np.exp(-td / 0.09)
put(sc, drag, tt)
finish('scratch', fade(sc, 0.002, 0.05))

# tada: bright brass-like fanfare (G major: short pickup notes then a big held chord) + shimmer + cymbal, under 2 s
def brass(f, d, vel=1.0):
    t = T(d); x = signal.sawtooth(2 * np.pi * f * t * (1 + 0.003 * np.sin(2 * np.pi * 5.5 * t))) + 0.5 * signal.sawtooth(2 * np.pi * f * 1.004 * t)
    env = np.minimum(t / 0.025, 1) * np.exp(-t / (d * 0.9)) * np.clip((d - t) / 0.12, 0, 1)
    out = np.zeros_like(x); blk = 512
    for i in range(0, len(x), blk):                      # brass brightens in the attack: LP opens quickly
        fc = min(900 + 5000 * np.exp(-(i / SR) / 0.07), 9000)
        b, a = signal.butter(2, fc / (SR / 2)); out[i:i + blk] = signal.lfilter(b, a, x[i:i + blk])
    return out * env * vel
out = np.zeros(int(2.0 * SR))
for tt, m, d in ((0.0, 67, 0.16), (0.17, 71, 0.16), (0.34, 74, 0.16)):               # G4 B4 D5 pickup
    put(out, brass(440 * 2 ** ((m - 69) / 12), d, 0.7), tt)
for m in (55, 62, 67, 71, 74, 79):                                                     # big G major chord
    put(out, brass(440 * 2 ** ((m - 69) / 12), 1.2, 0.6), 0.55)
cym = hp(noise(1.2), 5000) * np.exp(-T(1.2) / 0.35) * 0.35; put(out, cym, 0.55)
sp = np.zeros(int(1.4 * SR))
for k, f0 in enumerate((1568, 2093, 2637, 3136, 3951, 3136, 2637, 4186)):
    t = T(0.4); put(sp, np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.1) * 0.35, k * 0.05)
put(out, sp, 0.58)
out = lp(out, 12000)
finish('tada', fade(out, 0.002, 0.25))
