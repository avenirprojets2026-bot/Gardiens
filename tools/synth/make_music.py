"""Musiques originales composées pour le jeu (partitions écrites à la main ci-dessous).
Usage : python3 tools/synth/make_music.py public/assets/audio [nom...]
"""
import sys

import numpy as np

from synth import (SR, Track, bass, bell, brass, celesta, fade, flute, hat, kick, loopify, midi, normalize, pad, pluck,
                   reverb, snare, strings, timpani, tom)

out = sys.argv[1]
only = set(sys.argv[2:])

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def n(name):
    """'F#5' → numéro MIDI."""
    p, o = name[:-1], int(name[-1])
    return 12 * (o + 1) + NOTE[p]


CHORDS = {
    'C': [0, 4, 7], 'Cm': [0, 3, 7], 'D': [2, 6, 9], 'Dm': [2, 5, 9], 'E': [4, 8, 11], 'Em': [4, 7, 11], 'F': [5, 9, 12],
    'Fm': [5, 8, 12], 'G': [7, 11, 14], 'Gm': [7, 10, 14], 'A': [9, 13, 16], 'Am': [9, 12, 16], 'Bb': [10, 14, 17],
    'B': [11, 15, 18], 'Bm': [11, 14, 18], 'F#m': [6, 9, 13], 'C#m': [1, 4, 8], 'Eb': [3, 7, 10], 'Ab': [8, 12, 15],
    'G#m': [8, 11, 15], 'Fmaj7': [5, 9, 12, 16], 'Cmaj7': [0, 4, 7, 11], 'Am7': [9, 12, 16, 19], 'Dm7': [2, 5, 9, 12],
    'Gsus': [7, 12, 14], 'Asus': [9, 14, 16], 'Esus': [4, 9, 11],
}


def melody(tr, notes, beat, inst, gain, start=0.0, octave=0):
    """notes : liste de (nom|None, durée en temps)."""
    t = start
    for name, d in notes:
        if name:
            tr.add(inst(midi(n(name) + octave), d * beat * 1.05 + 0.08), t, gain)
        t += d * beat
    return t


def chords_layer(tr, prog, beat, beats_per_bar, inst, gain, base=48, start=0.0):
    t = start
    for c in prog:
        for k in CHORDS[c]:
            tr.add(inst(midi(base + k), beats_per_bar * beat + 0.3), t, gain)
        t += beats_per_bar * beat


def arpeggio(tr, prog, beat, beats_per_bar, inst, gain, base=60, pattern=(0, 1, 2, 1), sub=2, start=0.0, dur=0.6):
    t = start
    for c in prog:
        tones = CHORDS[c]
        for i in range(beats_per_bar * sub):
            k = tones[pattern[i % len(pattern)] % len(tones)] + (12 if pattern[i % len(pattern)] >= len(tones) else 0)
            tr.add(inst(midi(base + k), dur), t + i * beat / sub, gain)
        t += beats_per_bar * beat


def bassline(tr, prog, beat, beats_per_bar, gain, base=36, rhythm=((0, 2), (2, 2)), start=0.0):
    t = start
    for c in prog:
        root = CHORDS[c][0]
        for off, d in rhythm:
            tr.add(bass(midi(base + root), d * beat * 0.95), t + off * beat, gain)
        t += beats_per_bar * beat


def drums(tr, bars, beat, start=0.0, fill_every=8, intensity=1.0):
    for b in range(bars):
        t0 = start + b * 4 * beat
        for q in range(4):
            if q in (0, 2):
                tr.add(kick(), t0 + q * beat, 0.9 * intensity)
            if q in (1, 3):
                tr.add(snare(), t0 + q * beat, 0.3 * intensity)
            for h in range(2):
                tr.add(hat(), t0 + (q + h * 0.5) * beat, 0.08 * intensity)
        if (b + 1) % fill_every == 0:
            for i, f in enumerate([180, 150, 120, 95]):
                tr.add(tom(f), t0 + (3 + i * 0.25) * beat, 0.5 * intensity)


def finish(name, tr, length, tail=3.0, mean=-16.0, rev=(2.4, 0.28)):
    x = reverb(tr.buf, rev[0], rev[1])
    x = loopify(x, length, tail)
    write(name, normalize(x, -2.0, mean))


def write(name, x):
    from synth import write as w
    w(name, x, out)


def want(name):
    return not only or name in only


# ------------------------------------------------------------------ Thème des cinématiques (ré majeur, 80 bpm)
if want('music_story'):
    beat = 60 / 80
    prog = ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'D', 'D']
    L = len(prog) * 4 * beat
    tr = Track(L + 4)
    mel = [
        ('A5', 1), ('F#5', .5), ('A5', .5), ('D6', 1.5), ('C#6', .5),
        ('B5', 1), ('A5', .5), ('F#5', .5), ('D5', 2),
        ('G5', 1), ('B5', .5), ('D6', .5), ('C#6', 1), ('B5', 1),
        ('A5', 3), (None, 1),
        ('A5', 1), ('F#5', .5), ('A5', .5), ('D6', 1.5), ('E6', .5),
        ('C#6', 1), ('A5', .5), ('F#5', .5), ('A5', 2),
        ('B5', 1), ('G5', .5), ('B5', .5), ('E6', 1), ('D6', .5), ('C#6', .5),
        ('D6', 3), (None, 1),
        ('B5', 1.5), ('C#6', .5), ('D6', 1), ('F#6', 1),
        ('E6', 1), ('D6', .5), ('B5', .5), ('G5', 2),
        ('F#5', 1), ('A5', .5), ('D6', .5), ('F#6', 1.5), ('E6', .5),
        ('E6', 3), (None, 1),
        ('D6', 1), ('B5', 1), ('G5', 1), ('B5', 1),
        ('C#6', 1), ('E6', 1), ('A5', 2),
        ('D6', 4), (None, 4),
    ]
    melody(tr, mel, beat, flute, 0.32)
    melody(tr, mel, beat, celesta, 0.12, octave=12)
    chords_layer(tr, prog, beat, 4, pad, 0.10, base=50)
    arpeggio(tr, prog, beat, 4, lambda f, d: pluck(f, 1.2), 0.16, base=62, pattern=(0, 1, 2, 3, 2, 1), sub=2)
    bassline(tr, prog, beat, 4, 0.35, base=38)
    finish('music_story', tr, L, mean=-18.0, rev=(3.0, 0.35))

# ------------------------------------------------------------------ Thème de boss (ré mineur, 150 bpm) : héroïque, pas effrayant
if want('music_boss'):
    beat = 60 / 150
    prog = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'] * 2
    L = len(prog) * 4 * beat
    tr = Track(L + 4)
    phrase1 = [
        ('D5', 1), ('A4', 1), ('D5', .5), ('E5', .5), ('F5', 1),
        ('E5', 1.5), ('D5', .5), ('C#5', 2),
        ('D5', 1), ('F5', 1), ('Bb5', 1.5), ('A5', .5),
        ('G5', 2), ('E5', 2),
        ('D5', 1), ('A4', 1), ('D5', .5), ('E5', .5), ('F5', 1),
        ('G5', 1.5), ('F5', .5), ('E5', 1), ('D5', 1),
        ('Bb4', 1), ('D5', 1), ('G5', 1), ('F5', 1),
        ('E5', 2), ('A5', 2),
    ]
    phrase2 = [
        ('A5', 1.5), ('G5', .5), ('F5', 1), ('A5', 1),
        ('D6', 2), ('C#6', 2),
        ('D6', 1), ('C6', 1), ('Bb5', 1), ('A5', 1),
        ('G5', 1), ('A5', 1), ('C6', 2),
        ('A5', 1.5), ('G5', .5), ('F5', 1), ('A5', 1),
        ('Bb5', 1), ('A5', 1), ('G5', 1), ('F5', 1),
        ('G5', 1), ('Bb5', 1), ('D6', 1), ('C6', .5), ('Bb5', .5),
        ('A5', 4),
    ]
    end1 = melody(tr, phrase1, beat, brass, 0.30)
    melody(tr, phrase2, beat, brass, 0.30, start=end1)
    melody(tr, phrase2, beat, strings, 0.14, start=end1, octave=-12)
    # Ostinato de cordes en croches.
    t = 0.0
    for c in prog:
        r = CHORDS[c][0]
        for i, k in enumerate([0, 0, 12, 0, 7, 0, 12, 10 if 'm' in c else 11]):
            tr.add(strings(midi(50 + r + k - 12), beat * 0.48), t + i * beat / 2, 0.11)
        t += 4 * beat
    chords_layer(tr, prog, beat, 4, pad, 0.07, base=50)
    bassline(tr, prog, beat, 4, 0.42, base=38, rhythm=((0, 1.5), (1.5, 0.5), (2, 1.5), (3.5, 0.5)))
    drums(tr, len(prog), beat)
    for b in range(0, len(prog), 2):
        tr.add(timpani(midi(38)), b * 4 * beat, 0.45)
    finish('music_boss', tr, L, mean=-15.5, rev=(1.8, 0.22))
