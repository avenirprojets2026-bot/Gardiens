import Phaser from 'phaser';
import { detailed, themed } from '../core/assets';
import { VIEW_W } from '../config';
import type { LevelDef } from '../data/types';
import { themeOf, type Palette } from '../data/themes';

// Décor 2,5D d'un niveau : ciel, collines, brume, forêt lointaine et proche en parallaxe,
// rayons de lumière, halo du soleil/de la lune, premier plan flou devant le héros.

export interface ParallaxLayer {
  ts: Phaser.GameObjects.TileSprite;
  /** Facteur de défilement horizontal (0 = fixe, 1 = monde). */
  f: number;
  /** Facteur vertical. */
  fy: number;
  y0: number;
  drift?: number;
}

export type { Palette } from '../data/themes';

export function paletteFor(L: LevelDef): Palette {
  return themeOf(L.theme).palette(L.mood);
}

export class Backdrop {
  layers: ParallaxLayer[] = [];
  rays: (Phaser.GameObjects.Image & { wx?: number })[] = [];
  sunGlow!: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, private L: LevelDef, private pal: Palette) {}

  private add(key: string, f: number, fy: number, y0: number, h: number, depth: number, o: { scale?: number; alpha?: number; tint?: number; drift?: number } = {}) {
    const s = this.scene;
    if (!s.textures.exists(key)) return;
    const src = s.textures.get(key).getSourceImage() as HTMLImageElement;
    const ts = s.add.tileSprite(0, 0, VIEW_W + 4, h, key).setOrigin(0, 0).setDepth(depth);
    const sc = o.scale ?? h / src.height;
    ts.setTileScale(sc, sc);
    if (o.alpha != null) ts.setAlpha(o.alpha);
    if (o.tint != null) ts.setTint(o.tint);
    this.layers.push({ ts, f, fy, y0, drift: o.drift });
  }

  build(): void {
    const s = this.scene;
    const th = this.L.theme;
    const pal = this.pal;
    const T = themeOf(th);
    const painted = this.L.sky ?? T.sky;
    if (painted && s.textures.exists(painted)) {
      // Monde illustré par une grande scène peinte : la scène au fond, sa propre bande de
      // silhouettes au milieu, de la brume entre les deux pour la profondeur.
      this.add(painted, 0.05, 0.04, -150, 940, -100);
      this.sunGlow = s.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(pal.sun).setAlpha(pal.sunAlpha * 0.6).setDepth(-95);
      this.add('fog', 0.2, 0.1, 360, 180, -88, { alpha: 0.35, drift: 6, tint: pal.haze });
      const near = painted.replace('sky_', 'near_');
      this.add(s.textures.exists(near) ? near : (T.near ?? ''), 0.45, 0.3, 300, 560, -80);
      this.add('fog', 0.55, 0.32, 480, 160, -75, { alpha: 0.3, drift: 10, tint: pal.haze });
    } else {
      const sky = detailed(s, 'bg_sky', th);
      const hills = detailed(s, 'bg_hills', th);
      const farForest = s.textures.exists(themed(s, 'bgd_forest', th)) ? themed(s, 'bgd_forest', th) : themed(s, 'bg_forest', th);
      this.add(sky, 0.03, 0.03, -80, 860, -100);
      this.sunGlow = s.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(pal.sun).setAlpha(pal.sunAlpha).setDepth(-95);
      this.add(hills, 0.12, 0.08, 110, 480, -90);
      this.add('fog', 0.2, 0.1, 350, 180, -88, { alpha: 0.5, drift: 6, tint: pal.haze });
      this.add(farForest, 0.36, 0.22, 190, 560, -80);
      this.add('fog', 0.5, 0.3, 470, 170, -75, { alpha: 0.4, drift: 10, tint: pal.haze });
      this.add(themed(s, 'bg_forest', th), 0.62, 0.42, 300, 680, -70, { tint: T.nearTint });
    }
    for (let i = 0; i < 6; i++) {
      const r = s.add
        .image(0, 0, 'ray')
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-60)
        .setAlpha(0.18)
        .setScale(1.2 + (i % 3) * 0.4, 1.1)
        .setRotation(-0.32)
        .setTint(pal.rays[i % pal.rays.length]) as Phaser.GameObjects.Image & { wx?: number };
      r.wx = 600 + i * 1500 + (i % 2) * 400;
      this.rays.push(r);
    }
    // Premier plan : feuillages flous qui défilent plus vite que le monde (profondeur).
    this.add(detailed(s, 'fg_top', th), 1.25, 0, -12, 150, 60, { tint: pal.front });
    this.add(detailed(s, 'fg_bottom', th), 1.45, 0, 570, 165, 60, { tint: pal.front });
    this.applyMood();
  }

  private applyMood(): void {
    if (this.L.mood !== 'dusk' || themeOf(this.L.theme).base) return;
    const tints: Record<string, number> = {
      bg_sky: 0xffb4c6, bgd_sky: 0xffb4c6, bg_hills: 0xa99ac8, bgd_hills: 0xa99ac8, bg_forest: 0x8f8fb8, bgd_forest: 0x9a98c0,
      fog: 0xd9c6ff, fg_top: 0x8a8aa8, fg_bottom: 0x8a8aa8, fgd_top: 0x7a7aa0, fgd_bottom: 0x7a7aa0,
    };
    for (const l of this.layers) {
      const base = l.ts.texture.key.split('.')[0];
      const t = tints[base];
      if (t != null) l.ts.setTint(base === 'bg_forest' && l.f > 0.5 ? 0x6a6a92 : t);
    }
    for (const r of this.rays) r.setTint(0xffc0a8);
  }

  setQuality(fog: boolean, foreground: boolean): void {
    for (const l of this.layers) {
      if (l.ts.texture.key === 'fog') l.ts.setVisible(fog);
      if (l.ts.texture.key.startsWith('fg')) l.ts.setVisible(foreground);
    }
  }

  update(view: Phaser.Geom.Rectangle, time: number): void {
    for (const l of this.layers) {
      l.ts.setPosition(view.x - 2, view.y + l.y0 - (view.y - 85) * l.fy);
      l.ts.tilePositionX = (view.x * l.f + (l.drift ? time * 0.001 * l.drift : 0)) / l.ts.tileScaleX;
    }
    for (const r of this.rays) {
      const wx = r.wx ?? 0;
      r.setPosition(view.x + ((wx - view.x * 0.55) % (VIEW_W + 800)) - 200, view.y - 80);
      r.setAlpha(0.12 + 0.08 * Math.sin(time * 0.0007 + wx));
    }
    this.sunGlow
      .setPosition(view.x + view.width * 0.68 - ((view.x * 0.02) % 60), view.y + view.height * 0.2)
      .setScale((view.width / 64) * 0.55 * (1 + 0.03 * Math.sin(time * 0.0008)));
  }
}
