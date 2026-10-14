"""Final audio mix: narration + cartoon music bed + sound effects, mastered to -16 LUFS / below -1 dBTP.

Usage: python mix.py [--cues assets/audio/cues.json] [--vo assets/audio/vo/vo.wav] [--out-dir assets/audio]
                     [--sfx-db -14] [--duck-db 5] [--bed-db -26.5]
cues.json (written by export-cues.mjs): {end, pre, music: {t0, bar, final}, chapters, sfx: [{name, t, gain}]}
Inputs : narration vo.wav (placed at `pre` s), music/loop.wav + ending.wav + music.json (music_cartoon.py),
         sfx/<name>.wav (sfx_make.py). Optional js/vo-timing.js (word times) for the breath gate; without it the
         gate follows the signal itself.
Outputs: <out-dir>/mix.wav, mix.m4a, stem_vo.wav, stem_music.wav, stem_sfx.wav, audio-levels.txt
Voice chain: high-pass, presence EQ, split-band de-esser above 5.5 kHz, breath reduction (-10 dB between words),
soft compression, -19 dBFS active RMS. Music: loops on bar lines from music.t0, a filter-up intro over two bars,
ducks about 5 dB under the voice (attack 150 ms, release 2.2 s; gentler after the draft 1 audio review), final chord at music.final, faded out by `end`.
SFX: each at (voice peak level + sfx-db) * gain, not ducked.
"""
import argparse, json, os, re, subprocess, sys
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
SR = 48000
ap = argparse.ArgumentParser()
ap.add_argument('--cues', default=os.path.join(ROOT, 'assets/audio/cues.json'))
ap.add_argument('--vo', default=os.path.join(ROOT, 'assets/audio/vo/vo.wav'))
ap.add_argument('--out-dir', default=os.path.join(ROOT, 'assets/audio'))
ap.add_argument('--sfx-db', type=float, default=-14.0, help='SFX peak relative to the voice peak')
ap.add_argument('--duck-db', type=float, default=5.0)
ap.add_argument('--no-vo', action='store_true', help='music and sfx only (for previews)')
ap.add_argument('--bed-db', type=float, default=-26.5, help='music active RMS with no voice')
args = ap.parse_args()
AUD = os.path.join(ROOT, 'assets/audio')
OUT = args.out_dir; os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)

cues = json.load(open(args.cues))
END, PRE = cues['end'], cues['pre']
BAR, T0, FINAL = cues['music']['bar'], cues['music'].get('t0', 0.0), cues['music']['final']
N = int(round(END * SR))
db = lambda d: 10 ** (d / 20)


def load(p, ch=1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def save(p, x, codec=('-c:a', 'pcm_s24le')):
    x = x if x.ndim == 2 else x[:, None]
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', '-', *codec, p],
                   input=np.ascontiguousarray(x, np.float32).tobytes(), check=True)


def active_rms_db(x, thr=-45):
    mono = x.mean(1) if x.ndim > 1 else x
    hop = int(0.05 * SR); n = len(mono) // hop
    r = np.sqrt(np.mean(mono[:n * hop].reshape(n, hop) ** 2, 1) + 1e-12)
    keep = r[20 * np.log10(r) > thr]
    return 20 * np.log10(np.sqrt(np.mean(keep ** 2)) + 1e-12) if len(keep) else -120.0


def peaking(f0, gain_db, q):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    bb = [1 + al * A, -2 * np.cos(w), 1 - al * A]; aa = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return np.array(bb) / aa[0], np.array(aa) / aa[0]


def smooth_gain(target, att, rel):
    out = np.empty_like(target); g = 0.0
    ka, kr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    for i, x in enumerate(target):
        g = ka * g + (1 - ka) * x if x > g else kr * g + (1 - kr) * x
        out[i] = g
    return out


# ---------------------------------------------------------------- voice
if args.no_vo:
    vo = np.zeros(SR)
elif os.path.exists(args.vo):
    vo = load(args.vo)[:, 0]
else:
    sys.exit(f'narration not found: {args.vo}')
b, a = signal.butter(2, 80 / (SR / 2), 'high'); vo = signal.lfilter(b, a, vo)
b, a = peaking(3500, 1.2, 0.8); vo = signal.lfilter(b, a, vo)
b, a = peaking(250, -1.5, 1.4); vo = signal.lfilter(b, a, vo)
bh, ah = signal.butter(4, 5500 / (SR / 2), 'high'); hi = signal.filtfilt(bh, ah, vo); lo = vo - hi
he = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.003 * SR))], [1, -np.exp(-1 / (0.003 * SR))], hi ** 2) + 1e-12)
hi *= db(-np.clip((20 * np.log10(he) + 34.0) * 0.6, 0, 9))
vo = lo + hi
mask = np.zeros(len(vo))
tj = os.path.join(ROOT, 'js/vo-timing.js')
words = None
if os.path.exists(tj):
    try: words = json.loads(re.search(r'window\.VO_TIMING = (\{.*\});', open(tj).read()).group(1))['words']
    except Exception: words = None
if words:
    for _, t0, t1 in words: mask[max(0, int((t0 - 0.12) * SR)):min(len(vo), int((t1 + 0.12) * SR))] = 1
else:                                                  # no word times: gate from the signal (speech above -45 dBFS)
    e = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.02 * SR))], [1, -np.exp(-1 / (0.02 * SR))], vo ** 2) + 1e-12)
    mask = (20 * np.log10(e) > -45).astype(float)
    k = int(0.12 * SR); mask = np.convolve(mask, np.ones(2 * k + 1), mode='same').clip(0, 1)
win = np.hanning(int(0.06 * SR)); win /= win.sum()
vo *= db(-10) + (1 - db(-10)) * np.clip(np.convolve(mask, win, mode='same'), 0, 1)
env = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.01 * SR))], [1, -np.exp(-1 / (0.01 * SR))], vo ** 2) + 1e-12)
gr = np.clip((20 * np.log10(env) + 26.0) * (1 - 1 / 2.8), 0, None)
vo *= db(-smooth_gain(gr, 0.004, 0.09))
if not args.no_vo: vo *= db(-19.0 - active_rms_db(vo))
VO = np.zeros(N); s0 = int(PRE * SR); VO[s0:s0 + len(vo)] = vo[:max(0, N - s0)][:len(vo)]
if s0 + len(vo) > N: print(f'WARNING: narration ({PRE + len(vo) / SR:.1f} s) is longer than the film ({END:.1f} s)')
VO_PEAK = 0.35 if args.no_vo else np.abs(VO).max()

# ---------------------------------------------------------------- music
M = os.path.join(AUD, 'music')
NO_MUSIC = not os.path.exists(os.path.join(M, 'music.json'))
if NO_MUSIC:                                            # no bed yet (dry run) or a voice-only film: mix voice and effects only
    print('NOTE: no music bed (assets/audio/music/music.json missing); mixing voice and sound effects only')
    meta = {'loop_len': int(round(2 * BAR * SR)), 'pre': 0, 'xf': 480, 'bar': BAR}
    loop = np.zeros((int(round(2 * BAR * SR)), 2)); ending = np.zeros((int(4 * SR), 2))
else:
    meta = json.load(open(os.path.join(M, 'music.json')))
    loop = load(os.path.join(M, 'loop.wav'), 2); ending = load(os.path.join(M, 'ending.wav'), 2)
L, PREF, XF = meta['loop_len'], meta['pre'], meta['xf']
if abs(meta['bar'] - BAR) > 0.002: print(f"WARNING: cues bar {BAR:.4f} s differs from the music bar {meta['bar']:.4f} s")
if abs(((FINAL - T0) / BAR) - round((FINAL - T0) / BAR)) > 0.02: print('WARNING: music.final is not on a bar line from music.t0')
fin = np.sin(np.linspace(0, np.pi / 2, XF))[:, None]; fout = np.cos(np.linspace(0, np.pi / 2, XF))[:, None]
t0i = int(round(T0 * SR)); end_i = int(round(FINAL * SR)) - PREF
# music direction (cues.music.fx): cut / in / low / full
FX = sorted(cues['music'].get('fx', []), key=lambda f: f['t'])
def bar_at_or_after(t): return T0 + max(0, int(np.ceil((t - T0) / BAR - 1e-6))) * BAR
starts = [T0]                                           # loop restarts: the start and every 'in' (first downbeat at or after t)
for f in FX:
    if f['type'] == 'in': starts.append(bar_at_or_after(f['t']))
starts = sorted(set(round(x, 6) for x in starts))
MUS = np.zeros((N, 2)); nloop = 0
for ri, rs in enumerate(starts):
    rend = starts[ri + 1] if ri + 1 < len(starts) else None
    rsi = int(round(rs * SR)); lim = end_i + XF if rend is None else min(end_i + XF, int(round(rend * SR)) + PREF)
    k = 0
    while True:
        st = rsi + k * L - PREF if k else rsi
        if st >= end_i: break
        piece = loop.copy() if k else loop[PREF:].copy()
        if k: piece[:XF] *= fin
        piece[-XF:] *= fout
        a0 = max(0, -st); n = min(len(piece), lim - st)
        if n > a0: MUS[st + a0:st + n] += piece[a0:n]
        k += 1; nloop += 1
MUS[end_i:end_i + XF] *= fout; MUS[end_i + XF:] = 0
hit_i = end_i + PREF


def sweep_up(x, t0, t1, f_lo):
    blk = 512; zi = [None, None]; out = x.copy()
    for i in range(max(0, int(t0 * SR)), min(len(x), int(t1 * SR)), blk):
        c = 1 - (i / SR - t0) / (t1 - t0)
        fc = 16000 * (f_lo / 16000) ** c
        b, a = signal.butter(2, fc / (SR / 2))
        for ch in range(2):
            if zi[ch] is None: zi[ch] = signal.lfilter_zi(b, a) * x[i, ch]
            out[i:i + blk, ch], zi[ch] = signal.lfilter(b, a, x[i:i + blk, ch], zi=zi[ch])
    return out


MUS = sweep_up(MUS, T0, T0 + 2 * BAR, 500)
bed_gain = 1.0 if NO_MUSIC else db(args.bed_db - active_rms_db(MUS[:hit_i] if hit_i > 0 else MUS))   # level reference: the plain looped bed
MUS *= bed_gain
# gain envelope for cut / in (30 ms out, 150 ms in) and muffle amount c for low / full
G = np.ones(N); C = np.zeros(N)
cut_at = None
for f in FX:
    t = f['t']; i = int(round(t * SR))
    if f['type'] == 'cut':
        n = int(0.03 * SR); G[i:i + n] = np.minimum(G[i:i + n], np.linspace(1, 0, n)); G[i + n:] = 0; cut_at = i
    elif f['type'] == 'in':
        i = int(round(bar_at_or_after(t) * SR)); n = int(0.15 * SR)
        G[i:] = 1; G[:i] = np.where(np.arange(i) >= (cut_at if cut_at is not None else i), G[:i], G[:i])
        G[i:i + n] = np.linspace(0, 1, n)
        if cut_at is not None: G[cut_at + int(0.03 * SR):i] = 0
        cut_at = None
    elif f['type'] in ('low', 'full'):
        n = int((0.6 if f['type'] == 'low' else 0.8) * SR); tgt = 1.0 if f['type'] == 'low' else 0.0
        c0 = C[i]; C[i:i + n] = c0 + (tgt - c0) * np.linspace(0, 1, n); C[i + n:] = tgt
if FX:
    blk = 512; zi = [None, None]; prev = 0.0
    for i in range(0, N, blk):
        c = float(C[i]); seg = MUS[i:i + blk]
        if c > 0 or prev > 0:
            fc = 16000 * (800 / 16000) ** c
            b, a = signal.butter(2, fc / (SR / 2))
            for ch in range(2):
                if zi[ch] is None or prev == 0: zi[ch] = signal.lfilter_zi(b, a) * MUS[i, ch]
                MUS[i:i + blk, ch], zi[ch] = signal.lfilter(b, a, seg[:, ch], zi=zi[ch])
            MUS[i:i + blk] *= db(-4.0 * c)
        prev = c
    MUS *= G[:, None]
room = N - hit_i
if room > 0:
    MUS[hit_i:hit_i + min(room, len(ending))] += ending[:room] * bed_gain
e = signal.lfilter([1 - np.exp(-1 / (0.03 * SR))], [1, -np.exp(-1 / (0.03 * SR))], np.abs(VO))
act = np.clip((20 * np.log10(e + 1e-9) + 42) / 10, 0, 1)
duck = smooth_gain(act, 0.15, 2.2)
MUS *= db(-args.duck_db * duck)[:, None]
fade = min(int(1.5 * SR), N); MUS[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade))[:, None] ** 2

# ---------------------------------------------------------------- sfx
SFX = np.zeros(N); used = {}
base = VO_PEAK * db(args.sfx_db)
for ev in cues.get('sfx', []):
    name, t, g = ev['name'], ev['t'], ev.get('gain', 1.0)
    p = os.path.join(AUD, 'sfx', name + '.wav')
    if not os.path.exists(p): print('WARNING: missing sfx', name); continue
    if name not in used: used[name] = load(p)[:, 0]
    x = used[name]; x = x / (np.abs(x).max() + 1e-9) * base * g
    i = int(round(t * SR)); n = min(len(x), N - i)
    if i >= 0 and n > 0: SFX[i:i + n] += x[:n]

# ---------------------------------------------------------------- mixdown + master
mix = MUS + (VO + SFX)[:, None]
pre = os.path.join(OUT, 'mix_premaster.wav'); save(pre, mix)
def measure(p, tp=-1.5):
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', f'loudnorm=I=-16:TP={tp}:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return json.loads(m[m.rindex('{'):m.rindex('}') + 1])


# gain to -16 LUFS, then a look-ahead limiter at -2.5 dBFS (sample peak) keeps true peak below -1 dBTP even after AAC encoding; one correction pass
wav = os.path.join(OUT, 'mix.wav'); gain = -16.0 - float(measure(pre)['input_i'])
for _ in range(3):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', pre, '-af', f'volume={gain:.3f}dB,alimiter=limit={db(-2.5):.4f}:attack=5:release=60:level=disabled,aresample={SR}', '-c:a', 'pcm_s24le', wav], check=True)
    got = float(measure(wav)['input_i'])
    if abs(got + 16) < 0.1: break
    gain += -16 - got
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '192k', os.path.join(OUT, 'mix.m4a')], check=True)
save(os.path.join(OUT, 'stem_music.wav'), MUS); save(os.path.join(OUT, 'stem_vo.wav'), VO); save(os.path.join(OUT, 'stem_sfx.wav'), SFX)


os.remove(pre)
v = measure(os.path.join(OUT, 'mix.wav')); v2 = measure(os.path.join(OUT, 'mix.m4a'))
report = (f"mix {N / SR:.2f} s; master {v['input_i']} LUFS integrated, true peak {v['input_tp']} dBTP, LRA {v['input_lra']}; "
          f"m4a {v2['input_i']} LUFS, {v2['input_tp']} dBTP\n"
          f"active RMS before master: voice {active_rms_db(VO):.1f} dBFS, music {active_rms_db(MUS):.1f} dBFS (bed {args.bed_db:.0f}, ducked {args.duck_db:.0f} dB under voice); "
          f"sfx peak {20 * np.log10(np.abs(SFX).max() + 1e-9):.1f} dBFS ({len(cues.get('sfx', []))} events); "
          f"{nloop} music loops from {T0:.2f} s, final chord at {FINAL:.2f} s, fade out by {END:.2f} s")
open(os.path.join(OUT, 'audio-levels.txt'), 'w').write(report + '\n')
print(report)
