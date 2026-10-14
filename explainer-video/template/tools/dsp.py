"""Small shared DSP helpers (used by music_cartoon.py)."""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(1)


def reverb_ir(seconds=3.2, pre=0.018):
    """Synthetic stereo room impulse response: low-passed noise with an exponential decay."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = rng.standard_normal(n)
        b, a = signal.butter(1, 5200 / (SR / 2))
        noise = signal.lfilter(b, a, noise)
        ir[:, c] = noise * np.exp(-t / (seconds / 6.9))
    ir[: int(pre * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0))
