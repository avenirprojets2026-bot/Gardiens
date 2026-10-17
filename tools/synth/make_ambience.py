"""Ambiances sonores en boucle des mondes 4 à 10 (gouttes, vent, nuit, ombres).
Usage : python3 tools/synth/make_ambience.py public/assets/audio
"""
import sys

import numpy as np

from synth import SR, bell, fast_lowpass, midi, normalize, reverb, rng, t_axis, write

out = sys.argv[1]
DUR = 30.0
n = int(DUR * SR)


def loop_noise(cut):
    x = fast_lowpass(rng.standard_normal(n), cut)
    return x


def swell(period, depth=0.5):
    t = t_axis(DUR)
    return 1 - depth + depth * (0.5 + 0.5 * np.sin(2 * np.pi * t / period))


def crossfade_loop(x, k=2.0):
    """Boucle sans couture : on fond la fin dans le début."""
    m = int(k * SR)
    out = x[: n].copy()
    fade = np.linspace(0, 1, m)
    out[:m] = out[:m] * fade + x[n: n + m] * (1 - fade) if len(x) >= n + m else out[:m]
    return out


# Grotte de cristal : bourdon d'eau + gouttes cristallines.
x = loop_noise(400) * 0.4 * swell(11)
for _ in range(40):
    at = rng.uniform(0, DUR - 1)
    d = bell(midi(rng.choice([84, 88, 91, 93, 96])), 1.0, 0.4) * rng.uniform(0.05, 0.12)
    i = int(at * SR)
    x[i: i + len(d)] += d[: n - i]
x = reverb(x, 3.0, 0.45)
write('amb_crystal', normalize(crossfade_loop(x), -6, -27), out)

# Vent en altitude : souffle filtré qui monte et descend.
x = loop_noise(700) * swell(7, 0.7) + loop_noise(2400) * 0.15 * swell(4.3, 0.8)
write('amb_wind', normalize(crossfade_loop(np.concatenate([x, x[: 2 * SR]])), -6, -26), out)

# Nuit étoilée : grillons doux et souffle léger.
x = loop_noise(500) * 0.25
t = t_axis(DUR)
chirp = np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 28 * t) > 0.6) * (np.sin(2 * np.pi * 0.9 * t) > 0.2) * 0.05
x += chirp + np.roll(chirp, int(0.37 * SR)) * 0.6
write('amb_night', normalize(crossfade_loop(np.concatenate([x, x[: 2 * SR]])), -6, -27), out)

# Ombres : bourdon grave, battements lents, souffle (mystérieux, pas effrayant).
x = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(55, 0.3), (55.4, 0.3), (82.5, 0.12)]) * swell(9, 0.4)
x += loop_noise(300) * 0.2 * swell(13, 0.6)
x = reverb(x, 2.5, 0.35)
write('amb_shadow', normalize(crossfade_loop(x), -6, -27), out)
