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


# ------------------------------------------------------------------ Thèmes des mondes 4 à 10
def world_theme(name, bpm, prog, mel, lead, lead_gain, arp_inst, base_chord=50, arp_base=62, pattern=(0, 1, 2, 1),
                drums_on=False, mean=-17.0, rev=(2.6, 0.3), bass_rhythm=((0, 2), (2, 2)), counter=None):
    if not want(name):
        return
    beat = 60 / bpm
    L = len(prog) * 4 * beat
    tr = Track(L + 4)
    end = melody(tr, mel, beat, lead, lead_gain)
    # Reprise de la mélodie une octave plus haut en célesta pour la seconde moitié.
    if end < L * 0.75:
        melody(tr, mel, beat, celesta, lead_gain * 0.45, start=end, octave=12)
    if counter:
        melody(tr, counter, beat, strings, 0.12)
    chords_layer(tr, prog, beat, 4, pad, 0.09, base=base_chord)
    arpeggio(tr, prog, beat, 4, arp_inst, 0.14, base=arp_base, pattern=pattern, sub=2)
    bassline(tr, prog, beat, 4, 0.34, base=base_chord - 12, rhythm=bass_rhythm)
    if drums_on:
        drums(tr, len(prog), beat, intensity=0.7)
    finish(name, tr, L, mean=mean, rev=rev)


bell_soft = lambda f, d: bell(f, max(d, 0.9), 0.6)
harp = lambda f, d: pluck(f, 1.4, 0.997)

# Lac des Cristaux : mi mineur, 84 bpm, célesta et cloches dans une grande réverbération.
world_theme('music_crystal', 84, ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B'] * 2, [
    ('B5', 1.5), ('G5', .5), ('E5', 2),
    ('C6', 1.5), ('B5', .5), ('G5', 2),
    ('D6', 1), ('B5', 1), ('G5', 1), ('A5', 1),
    ('F#5', 4),
    ('B5', 1.5), ('G5', .5), ('E5', 1), ('G5', 1),
    ('E6', 1.5), ('D6', .5), ('C6', 2),
    ('A5', 1), ('C6', 1), ('E6', 1), ('D6', 1),
    ('B5', 4),
], celesta, 0.36, bell_soft, pattern=(0, 2, 1, 2), rev=(3.6, 0.4), mean=-18.0)

# Îles Célestes : ré majeur, 108 bpm, flûte légère et harpe, un peu de percussion.
world_theme('music_sky', 108, ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'] * 2, [
    ('F#5', 1), ('A5', 1), ('D6', 1.5), ('C#6', .5),
    ('B5', 1), ('A5', 1), ('E5', 2),
    ('F#5', 1), ('B5', 1), ('D6', 1), ('F#6', 1),
    ('E6', 3), (None, 1),
    ('A5', 1), ('F#5', .5), ('A5', .5), ('D6', 1), ('E6', 1),
    ('C#6', 1), ('A5', 1), ('E6', 2),
    ('D6', 1), ('B5', 1), ('G5', 1), ('B5', 1),
    ('A5', 4),
], flute, 0.34, harp, pattern=(0, 1, 2, 3), drums_on=True, mean=-17.0, rev=(2.4, 0.3))

# Observatoire : la mineur harmonique, 96 bpm, cordes pincées « mécaniques » et cloches.
world_theme('music_observatory', 96, ['Am', 'E', 'Am', 'G', 'F', 'C', 'Dm', 'E'] * 2, [
    ('A5', .5), ('B5', .5), ('C6', 1), ('E6', 1), ('D6', 1),
    ('B5', 1), ('G#5', 1), ('E5', 2),
    ('A5', .5), ('C6', .5), ('E6', 1), ('A6', 1), ('G6', 1),
    ('F6', 1), ('E6', 1), ('D6', 2),
    ('C6', .5), ('D6', .5), ('E6', 1), ('C6', 1), ('A5', 1),
    ('G5', 1), ('C6', 1), ('E6', 2),
    ('F6', 1), ('E6', 1), ('D6', 1), ('C6', 1),
    ('B5', 2), ('G#5', 2),
], lambda f, d: pluck(f, max(0.6, d), 0.995), 0.36, bell_soft, pattern=(0, 1, 2, 1, 0, 2), mean=-17.5, rev=(2.0, 0.25))

# Royaume des Ombres : do mineur, 72 bpm, mystérieux mais rassurant (pas effrayant).
world_theme('music_shadow', 72, ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'G'] * 2, [
    ('G5', 2), ('Eb5', 1), ('C5', 1),
    ('Ab5', 2), ('G5', 1), ('Eb5', 1),
    ('Bb5', 1.5), ('G5', .5), ('Eb5', 2),
    ('D5', 4),
    ('G5', 1), ('C6', 1), ('Bb5', 1), ('G5', 1),
    ('Ab5', 2), ('C6', 2),
    ('Bb5', 1), ('Ab5', 1), ('F5', 2),
    ('G5', 4),
], strings, 0.26, bell_soft, base_chord=48, arp_base=60, pattern=(0, 2, 1, 2), mean=-19.0, rev=(3.8, 0.4))

# Sanctuaire des Étoiles : mi majeur, 76 bpm, nappes et cloches cristallines, très aérien.
world_theme('music_stars', 76, ['E', 'C#m', 'A', 'B', 'E', 'G#m', 'A', 'B'] * 2, [
    ('G#5', 2), ('B5', 1), ('E6', 1),
    ('C#6', 2), ('B5', 2),
    ('A5', 1), ('C#6', 1), ('E6', 1), ('F#6', 1),
    ('D#6', 4),
    ('E6', 1.5), ('B5', .5), ('G#5', 2),
    ('B5', 1), ('D#6', 1), ('F#6', 2),
    ('E6', 1), ('C#6', 1), ('A5', 2),
    ('B5', 4),
], bell_soft, 0.3, celesta, pattern=(0, 1, 2, 3, 2, 1), mean=-18.5, rev=(4.0, 0.42))

# Citadelle : si bémol majeur, 112 bpm, cuivres héroïques et tambours.
world_theme('music_citadel', 112, ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F'] * 2, [
    ('D5', 1), ('F5', 1), ('Bb5', 1.5), ('A5', .5),
    ('G5', 1), ('F5', 1), ('C5', 2),
    ('D5', 1), ('G5', 1), ('Bb5', 1), ('D6', 1),
    ('C6', 3), (None, 1),
    ('F5', 1), ('Bb5', 1), ('D6', 1.5), ('C6', .5),
    ('Bb5', 1), ('A5', 1), ('F5', 2),
    ('G5', 1), ('Bb5', 1), ('Eb6', 1), ('D6', 1),
    ('C6', 4),
], brass, 0.3, harp, base_chord=46, arp_base=58, drums_on=True, mean=-16.0, rev=(2.2, 0.26),
    bass_rhythm=((0, 1.5), (1.5, 0.5), (2, 2)))

# Cœur des Mondes : do majeur, 92 bpm, le thème principal réorchestré avec tout l'orchestre.
world_theme('music_final', 92, ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'] * 2, [
    ('E5', 1), ('G5', 1), ('C6', 1.5), ('B5', .5),
    ('A5', 1), ('G5', 1), ('E5', 2),
    ('F5', 1), ('A5', 1), ('C6', 1), ('E6', 1),
    ('D6', 3), (None, 1),
    ('E6', 1), ('D6', .5), ('C6', .5), ('G5', 1), ('C6', 1),
    ('B5', 1), ('G5', 1), ('E6', 2),
    ('F6', 1), ('E6', 1), ('D6', 1), ('B5', 1),
    ('C6', 4),
], brass, 0.26, harp, drums_on=True, mean=-16.0, rev=(2.8, 0.3),
    counter=[('C5', 4), ('A4', 4), ('F4', 4), ('G4', 4), ('C5', 4), ('B4', 4), ('A4', 4), ('B4', 4)])
