"""Effets sonores originaux des nouveaux pouvoirs et mécaniques.
Usage : python3 tools/synth/make_sfx.py public/assets/audio
"""
import sys

import numpy as np

from synth import SR, bell, celesta, fast_lowpass, midi, normalize, reverb, rng, t_axis, timpani, write

out = sys.argv[1]


def sweep(f0, f1, dur, kind='sin'):
    t = t_axis(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if kind == 'sin' else 2 * ((ph / (2 * np.pi)) % 1) - 1


def noise(dur, cutoff=4000):
    return fast_lowpass(rng.standard_normal(int(dur * SR)), cutoff)


def env(dur, a=0.01, k=6.0):
    t = t_axis(dur)
    return np.clip(t / a, 0, 1) * np.exp(-t * k)


def mix(*parts):
    n = max(len(p) for p in parts)
    o = np.zeros(n)
    for p in parts:
        o[: len(p)] += p
    return o


def arp(notes, step, inst=celesta, dur=0.6, gain=0.5):
    o = np.zeros(int((step * len(notes) + dur) * SR))
    for i, n in enumerate(notes):
        s = inst(midi(n), dur) * gain
        j = int(i * step * SR)
        o[j : j + len(s)] += s
    return o


# Nova de lumière (Soumaya) : montée scintillante + éclat.
light = mix(sweep(600, 2400, 0.35) * env(0.35, 0.05, 3) * 0.4, arp([84, 88, 91, 96], 0.05, bell, 0.7, 0.35), noise(0.6, 9000) * env(0.6, 0.002, 8) * 0.25)
write('sfx_light', normalize(reverb(light, 1.2, 0.3), -3, -18), out)

# Éclat solaire (Zakaria) : souffle chaud + accord majeur brillant + grave.
sun = mix(noise(1.0, 1800) * env(1.0, 0.02, 4) * 0.6, arp([60, 64, 67, 72, 76], 0.03, bell, 0.9, 0.3), timpani(midi(40), 1.0) * 0.6)
write('sfx_sun', normalize(reverb(sun, 1.6, 0.35), -3, -17), out)

# Fleur géante (Hajar) : petit « pop » organique et arpège pentatonique.
t = t_axis(0.25)
pop = np.sin(2 * np.pi * np.cumsum(180 + 600 * np.exp(-t * 25)) / SR) * env(0.25, 0.003, 14)
flower = mix(pop * 0.8, arp([79, 81, 84, 88], 0.045, celesta, 0.5, 0.35))
write('sfx_flower', normalize(reverb(flower, 0.9, 0.25), -3, -19), out)

# Charge pleine : petit tintement montant.
write('sfx_charge', normalize(reverb(arp([88, 95], 0.06, bell, 0.5, 0.5), 0.8, 0.3), -4, -21), out)

# Interrupteur-cristal : clic + carillon.
click = noise(0.05, 7000) * env(0.05, 0.001, 60)
sw = mix(click, arp([76, 83, 88], 0.08, bell, 0.9, 0.4))
write('sfx_switch', normalize(reverb(sw, 1.4, 0.3), -3, -19), out)

# Porte / barrière : grondement de pierre et souffle magique.
gate = mix(noise(1.2, 300) * env(1.2, 0.05, 2.5) * 0.9, sweep(220, 110, 1.2) * env(1.2, 0.05, 2.5) * 0.3, noise(1.2, 5000) * env(1.2, 0.3, 3) * 0.15)
write('sfx_gate', normalize(reverb(gate, 1.0, 0.25), -3, -18), out)

# Rugissement du boss (grognon, pas effrayant) : voix grave vibrée.
t = t_axis(1.1)
f = 95 + 30 * np.sin(2 * np.pi * 7 * t) * np.exp(-t) + 40 * np.exp(-t * 3)
ph = 2 * np.pi * np.cumsum(f) / SR
growl = sum(np.sin(h * ph) / h for h in range(1, 10)) * env(1.1, 0.06, 2.2)
growl = fast_lowpass(growl, 1400) + noise(1.1, 900) * env(1.1, 0.05, 3) * 0.3
write('sfx_boss_roar', normalize(reverb(growl, 1.2, 0.25), -3, -17), out)

# Coup porté au boss : impact + « boing » descendant.
hit = mix(timpani(midi(43), 0.8) * 0.8, sweep(700, 180, 0.4) * env(0.4, 0.003, 7) * 0.5, noise(0.15, 6000) * env(0.15, 0.001, 30) * 0.4)
write('sfx_boss_hit', normalize(reverb(hit, 0.8, 0.2), -3, -17), out)

# Courant d'air.
wind = noise(2.0, 900) * np.sin(np.linspace(0, np.pi, int(2.0 * SR))) ** 2
write('sfx_wind', normalize(wind, -6, -24), out)

# Crachat de spore.
t = t_axis(0.3)
spit = mix(np.sin(2 * np.pi * np.cumsum(500 - 300 * t / 0.3) / SR) * env(0.3, 0.003, 12) * 0.6, noise(0.2, 2500) * env(0.2, 0.002, 25) * 0.5)
write('sfx_spit', normalize(spit, -4, -20), out)

# Feu follet apaisé : glissando cristallin.
wisp = mix(sweep(900, 1800, 0.25) * env(0.25, 0.005, 9) * 0.5, arp([91, 86, 98], 0.05, bell, 0.6, 0.3))
write('sfx_wisp', normalize(reverb(wisp, 1.0, 0.3), -4, -20), out)

# Passage secret : arpège magique ascendant.
write('sfx_secret', normalize(reverb(arp([72, 76, 79, 83, 86, 91], 0.07, celesta, 0.9, 0.45), 1.8, 0.35), -3, -18), out)

# Texte des dialogues : petit « tic » doux.
t = t_axis(0.05)
tick = np.sin(2 * np.pi * 1200 * t) * env(0.05, 0.001, 70)
write('sfx_text', normalize(tick, -10, -26), out)
