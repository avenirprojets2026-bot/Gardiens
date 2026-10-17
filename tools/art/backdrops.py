"""Transforme les illustrations d'ambiance fournies par l'utilisatrice en décors de jeu.

  python3 -I tools/art/backdrops.py <dossier_des_recadrages>

Pour chaque scène (1080 px de large, recadrée sans bandes noires) :
- sky_<nom>.webp : grand décor de fond agrandi (hauteur 1024), rendu raccordable à l'infini
  par miroir horizontal (image + image retournée) ; largeur < 4096 px (limite des téléphones).
- near_<nom>.webp : bande de silhouettes de premier plan tirée du bas de la même scène
  (assombrie, adoucie, fondue vers le haut), pour la profondeur 2,5D propre à chaque monde.
Les entrées sont ajoutées à public/assets/art/manifest.json.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ART = os.path.join(ROOT, 'public', 'assets', 'art')
MANIFEST = os.path.join(ART, 'manifest.json')

# nom du décor → (fichier source, rognage bas en fraction pour retirer une interface éventuelle)
SCENES = {
    'lake': ('549742cf', 0.0),
    'moon': ('4c0ee0df', 0.0),
    'realm': ('82607998', 0.0),
    'ember': ('a35597f9', 0.0),
    'ruins': ('5089a871', 0.0),
    'candles': ('55a3a06f', 0.0),
    'bridge': ('70051d1d', 0.0),
    'cave': ('74cfb1d5', 0.0),
    'runes': ('33d21cfd', 0.0),
    'castle': ('2d60dea3', 0.0),
    'path': ('8326c0b2', 0.0),
    'grove': ('0fc37dfc', 0.13),
    'jungle': ('3358d590', 0.0),
}


def mirror_tile(im: Image.Image) -> Image.Image:
    out = Image.new(im.mode, (im.width * 2, im.height))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (im.width, 0))
    return out


def sky(src: Image.Image) -> Image.Image:
    h = 1024
    w = int(src.width * h / src.height)
    big = src.resize((w, h), Image.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return mirror_tile(big)


def near_band(src: Image.Image) -> Image.Image:
    """Silhouettes du bas de la scène : assombries, légèrement floues, fondues vers le haut."""
    part = src.crop((0, int(src.height * 0.58), src.width, src.height))
    part = part.resize((1800, 764), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
    part = ImageEnhance.Brightness(part).enhance(0.42)
    part = ImageEnhance.Color(part).enhance(0.8)
    rgba = part.convert('RGBA')
    a = np.asarray(rgba).astype(np.float32)
    lum = a[..., :3].mean(-1) / 255
    y = np.linspace(0, 1, a.shape[0])[:, None]
    # Opaque en bas, transparent en haut ; les zones claires (ciel, lumières) s'effacent plus vite.
    alpha = np.clip((y - 0.18) / 0.45, 0, 1) * np.clip(1.25 - lum * 1.6, 0, 1)
    a[..., 3] = alpha * 255
    band = Image.fromarray(a.astype(np.uint8), 'RGBA')
    return mirror_tile(band)


def main(crops: str) -> None:
    m = json.load(open(MANIFEST))
    for name, (src_id, cut) in SCENES.items():
        src = Image.open(os.path.join(crops, f'{src_id}.png')).convert('RGB')
        if cut:
            src = src.crop((0, 0, src.width, int(src.height * (1 - cut))))
        s = sky(src)
        s.save(os.path.join(ART, f'sky_{name}.webp'), 'WEBP', quality=86, method=6)
        m['images'][f'sky_{name}'] = {'file': f'sky_{name}.webp', 'w': s.width, 'h': s.height}
        n = near_band(src)
        n.save(os.path.join(ART, f'near_{name}.webp'), 'WEBP', quality=84, method=6)
        m['images'][f'near_{name}'] = {'file': f'near_{name}.webp', 'w': n.width, 'h': n.height}
        print(name, s.size, n.size)
    with open(MANIFEST, 'w') as f:
        json.dump(m, f, indent=1, ensure_ascii=False)
        f.write('\n')


if __name__ == '__main__':
    main(sys.argv[1])
