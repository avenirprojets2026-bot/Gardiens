"""Petit synthétiseur hors-ligne (numpy) pour créer des sons et musiques originaux du jeu.

Instruments : cloche/célesta (FM), pad doux (supersaw filtré), basse ronde, cordes pincées
(Karplus-Strong), flûte (sinus + souffle), percussions synthétiques ; réverbération à
convolution (bruit à décroissance exponentielle). Export WAV puis OGG + MP3 via ffmpeg.
"""
import os
import subprocess
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, dur=None):
    dur = dur if dur is not None else n / SR
    t = np.arange(n) / SR
    e = np.ones(n) * s
    a = max(a, 1e-4)
    e[t < a] = t[t < a] / a
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-4)
    rel = t > dur - r
    e[rel] *= np.clip((dur - t[rel]) / max(r, 1e-4), 0, 1)
    return e


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lowpass(x, cutoff):
    """Filtre passe-bas à un pôle (cutoff en Hz, scalaire)."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    b = 1 - a
    for i in range(len(x)):
        acc = b * x[i] + a * acc
        y[i] = acc
    return y


def fast_lowpass(x, cutoff):
    """Passe-bas par FFT (plus rapide pour les longs signaux)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def reverb(x, seconds=2.2, mix=0.3, damp=4000):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
    ir = fast_lowpass(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    L = len(x) + n
    size = 1 << int(np.ceil(np.log2(L)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + n]
    out = np.zeros(len(x) + n)
    out[: len(x)] += x * (1 - mix)
    out += wet * mix
    return out


# ------------------------------------------------------------------ instruments

def bell(freq, dur, bright=1.0):
    t = t_axis(dur)
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * bright * 2.2 * np.exp(-t * 6)
    x = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * 3.2)
    x += 0.3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 5)
    return x * env_adsr(len(t), 0.002, 0.05, 1, 0.05)


def celesta(freq, dur):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 9)
    return x * np.exp(-t * 4.5) * env_adsr(len(t), 0.002, 0.02, 1, 0.04)


def pluck(freq, dur, decay=0.996):
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = decay * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out * env_adsr(n, 0.001, 0.01, 1, 0.05)


def pad(freq, dur, detune=0.006, cutoff=1800, voices=5):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k in range(voices):
        f = freq * (1 + detune * (k - voices // 2))
        ph = rng.uniform(0, 1)
        x += 2 * ((f * t + ph) % 1) - 1
    x /= voices
    x = fast_lowpass(x, cutoff)
    return x * env_adsr(len(t), min(0.6, dur * 0.3), 0.3, 0.8, min(0.8, dur * 0.4))


def flute(freq, dur, vib=5.0):
    t = t_axis(dur)
    v = 1 + 0.004 * np.sin(2 * np.pi * vib * t) * np.clip(t / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(freq * v) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    breath = fast_lowpass(rng.standard_normal(len(t)), 3000) * 0.04
    return (x + breath) * env_adsr(len(t), 0.06, 0.1, 0.85, 0.12)


def bass(freq, dur):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t) + 0.12 * np.tanh(3 * np.sin(2 * np.pi * freq * t))
    return x * env_adsr(len(t), 0.005, 0.12, 0.6, 0.06)


def strings(freq, dur):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for k, d in enumerate([-0.004, 0, 0.005]):
        f = freq * (1 + d) * (1 + 0.003 * np.sin(2 * np.pi * 5.2 * t + k))
        ph = 2 * np.pi * np.cumsum(f) / SR
        x += sum(np.sin(h * ph) / h ** 1.3 for h in range(1, 7))
    x = fast_lowpass(x / 3, 2600)
    return x * env_adsr(len(t), 0.15, 0.2, 0.85, 0.25)


def brass(freq, dur):
    t = t_axis(dur)
    ph = 2 * np.pi * freq * t
    bright = np.clip(t / 0.08, 0, 1)
    x = sum(np.sin(h * ph) * (bright ** (h * 0.3)) / h for h in range(1, 9))
    return fast_lowpass(x, 2200) * env_adsr(len(t), 0.04, 0.15, 0.75, 0.12)


def kick(dur=0.35):
    t = t_axis(dur)
    f = 50 + 120 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(dur=0.25):
    t = t_axis(dur)
    n = fast_lowpass(rng.standard_normal(len(t)), 6000) * np.exp(-t * 18)
    return n * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.5


def hat(dur=0.08):
    t = t_axis(dur)
    n = rng.standard_normal(len(t))
    n = n - fast_lowpass(n, 7000)
    return n * np.exp(-t * 60)


def tom(freq, dur=0.5):
    t = t_axis(dur)
    f = freq * (1 + 0.6 * np.exp(-t * 18))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)


def timpani(freq, dur=1.2):
    t = t_axis(dur)
    f = freq * (1 + 0.04 * np.exp(-t * 10))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.4 * np.sin(1.5 * ph) + 0.2 * np.sin(1.98 * ph)
    hit = fast_lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 40)
    return (x * np.exp(-t * 2.5) + hit * 0.5)


# ------------------------------------------------------------------ mixage

class Track:
    def __init__(self, seconds):
        self.buf = np.zeros(int(seconds * SR) + SR * 4)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        j = min(len(self.buf), i + len(sig))
        self.buf[i:j] += sig[: j - i] * gain
        return self


def normalize(x, peak_db=-2.0, mean_db=None):
    x = x - np.mean(x)
    if mean_db is not None:
        rms = np.sqrt(np.mean(x ** 2)) + 1e-9
        x *= 10 ** (mean_db / 20) / rms
        x = np.tanh(x * 1.2) / 1.2  # légère compression douce
    peak = np.max(np.abs(x)) + 1e-9
    lim = 10 ** (peak_db / 20)
    if peak > lim:
        x *= lim / peak
    return x


def fade(x, fin=0.0, fout=0.0):
    n = len(x)
    if fin:
        k = int(fin * SR)
        x[:k] *= np.linspace(0, 1, k)
    if fout:
        k = int(fout * SR)
        x[n - k:] *= np.linspace(1, 0, k)
    return x


def loopify(x, length_s, tail_s):
    """Rend une boucle sans couture : la queue de réverbération est repliée sur le début."""
    n = int(length_s * SR)
    out = x[:n].copy()
    tail = x[n : n + int(tail_s * SR)]
    out[: len(tail)] += tail
    return out


def write(name, x, outdir):
    os.makedirs(outdir, exist_ok=True)
    wav = os.path.join(outdir, name + '.wav')
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    for ext, args in (('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '128k'])):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, *args, os.path.join(outdir, f'{name}.{ext}')], check=True)
    os.remove(wav)
    print('écrit', name, f'{len(x) / SR:.1f} s')
