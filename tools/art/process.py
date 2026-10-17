"""Intègre des illustrations générées dans le jeu.

  python3 tools/art/process.py layer <source.png> <clé> <thème>      # couche de décor, sol, plateforme, boss, décor
  python3 tools/art/process.py sheet <planche.png> <héros> <n_poses>  # planche de poses d'un héros → animations

- Détourage : si l'image n'a pas de transparence, le fond uni (couleur des coins) est retiré
  avec un fondu doux sur les bords.
- Couches « tileable » : raccord horizontal par fondu enchaîné des deux bords.
- Sols / plateformes : la ligne de surface praticable (`top`) et la largeur utile (`usableW`) sont
  mesurées sur l'image, puis écrites dans assets/art/manifest.json.
- Export WebP (qualité 88) aux dimensions du cahier des charges (tools/art/brief.json).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ART = os.path.join(ROOT, 'public', 'assets', 'art')
MANIFEST = os.path.join(ART, 'manifest.json')
BRIEF = json.load(open(os.path.join(os.path.dirname(__file__), 'brief.json')))


def load_manifest():
    return json.load(open(MANIFEST))


def save_manifest(m):
    with open(MANIFEST, 'w') as f:
        json.dump(m, f, indent=1, ensure_ascii=False)
        f.write('\n')


def remove_flat_background(im: Image.Image, tol=38) -> Image.Image:
    """Retire un fond uni (estimé sur les coins) : alpha progressif selon la distance de couleur."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    if a[..., 3].min() < 250:
        return im  # déjà transparente
    h, w = a.shape[:2]
    k = max(4, min(h, w) // 40)
    corners = np.concatenate([a[:k, :k, :3].reshape(-1, 3), a[:k, -k:, :3].reshape(-1, 3), a[-k:, :k, :3].reshape(-1, 3), a[-k:, -k:, :3].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    d = np.sqrt(((a[..., :3] - bg) ** 2).sum(-1))
    alpha = np.clip((d - tol) / tol, 0, 1)
    # Ne garder que les zones reliées au contenu : on adoucit le masque pour éviter les halos.
    m = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    alpha = np.asarray(m).astype(np.float32) / 255
    # Décontamination de la couleur du fond sur les bords semi-transparents.
    rgb = a[..., :3]
    safe = np.clip(alpha, 0.05, 1)[..., None]
    rgb = np.clip((rgb - bg * (1 - safe)) / safe, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def crop_to_content(im: Image.Image, pad=2) -> Image.Image:
    bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def make_tileable(im: Image.Image, overlap=0.08) -> Image.Image:
    """Fondu des bords gauche/droit pour un raccord sans couture."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    h, w = a.shape[:2]
    o = int(w * overlap)
    left = a[:, :o]
    right = a[:, w - o:]
    t = np.linspace(0, 1, o)[None, :, None]
    blend = right * (1 - t) + left * t
    out = np.concatenate([blend, a[:, o:w - o]], axis=1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def surface_top(im: Image.Image) -> int:
    """Première ligne opaque au centre de l'image (surface où l'on marche)."""
    a = np.asarray(im.getchannel('A'))
    w = a.shape[1]
    centre = a[:, w // 4: 3 * w // 4]
    rows = np.where((centre > 128).mean(axis=1) > 0.5)[0]
    return int(rows[0]) if len(rows) else 0


def usable_width(im: Image.Image, top: int) -> int:
    a = np.asarray(im.getchannel('A'))
    band = a[min(a.shape[0] - 1, top + 6)]
    cols = np.where(band > 128)[0]
    return int(cols[-1] - cols[0]) if len(cols) else im.width


def layer(src, key, theme):
    spec = BRIEF['layers'][key] if key in BRIEF['layers'] else {'alpha': True}
    im = Image.open(src)
    if spec.get('alpha', True):
        im = remove_flat_background(im)
        if not spec.get('tileable'):
            im = crop_to_content(im)
    else:
        im = im.convert('RGB')
    if 'size' in spec:
        W, H = spec['size']
        if spec.get('tileable') or not spec.get('alpha', True):
            im = im.resize((W, H), Image.LANCZOS)
        else:
            im.thumbnail((W, H), Image.LANCZOS)
    if spec.get('tileable'):
        im = make_tileable(im)
        im = im.resize(tuple(spec['size']), Image.LANCZOS)
    name = f'{key}.{theme}' if theme else key
    fname = f'{name}.webp'
    im.save(os.path.join(ART, fname), 'WEBP', quality=88, method=6)
    m = load_manifest()
    meta = {'file': fname, 'w': im.width, 'h': im.height}
    if key.startswith('ground') or key.startswith('plat'):
        top = surface_top(im)
        meta['top'] = top
        if key.startswith('plat'):
            meta['usableW'] = usable_width(im, top)
    m['images'][name] = meta
    save_manifest(m)
    print('intégré', name, meta)


def sheet(src, hero, n_poses):
    """Découpe une planche de poses alignées sur une ligne en sprites et animations du héros."""
    names = BRIEF['heroes']['poses'][: int(n_poses)]
    im = remove_flat_background(Image.open(src))
    a = np.asarray(im.getchannel('A'))
    cols = (a > 40).any(axis=0)
    # Segments de colonnes non vides = une pose chacun.
    segs, start = [], None
    for x, on in enumerate(cols):
        if on and start is None:
            start = x
        if not on and start is not None:
            if x - start > im.width * 0.03:
                segs.append((start, x))
            start = None
    if start is not None:
        segs.append((start, im.width))
    if len(segs) != len(names):
        raise SystemExit(f'{len(segs)} poses détectées, {len(names)} attendues : vérifier la planche')
    frames = [crop_to_content(im.crop((x0, 0, x1, im.height))) for x0, x1 in segs]
    H = 300
    scale = H / max(f.height for f in frames)
    frames = [f.resize((max(1, int(f.width * scale)), max(1, int(f.height * scale))), Image.LANCZOS) for f in frames]
    m = load_manifest()

    def write_sheet(key, fr, fps, loop):
        fw = max(f.width for f in fr)
        fh = max(f.height for f in fr)
        out = Image.new('RGBA', (fw * len(fr), fh), (0, 0, 0, 0))
        for i, f in enumerate(fr):
            out.alpha_composite(f, (i * fw + (fw - f.width) // 2, fh - f.height))
        out.save(os.path.join(ART, f'{key}.webp'), 'WEBP', quality=90, method=6)
        m['sheets'][key] = {'file': f'{key}.webp', 'frameW': fw, 'frameH': fh, 'frames': len(fr), 'fps': fps, 'loop': loop,
                            'contentH': H, 'originY': 0.975, 'originX': 0.5}

    by = dict(zip(names, frames))
    write_sheet(f'{hero}_idle', [by['standing idle']], 1, False)
    write_sheet(f'{hero}_walk', [by['walking stride'], by['standing idle'], by['walking stride'], by['standing idle']], 8, True)
    write_sheet(f'{hero}_run', [by['running stride A'], by['running stride B']] * 3, 12, True)
    write_sheet(f'{hero}_jump', [by['standing idle'], by['jump rising'], by['jump rising'], by['jump falling'], by['jump falling']], 10, False)
    write_sheet(f'{hero}_cast', [by['casting magic']], 1, False)
    write_sheet(f'{hero}_surprised', [by['surprised hurt']], 1, False)
    write_sheet(f'{hero}_victory', [by['victory cheer']], 1, False)
    save_manifest(m)
    print('héros intégré', hero, [k for k in m['sheets'] if k.startswith(hero)])


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'layer':
        layer(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None)
    elif cmd == 'sheet':
        sheet(sys.argv[2], sys.argv[3], sys.argv[4])
