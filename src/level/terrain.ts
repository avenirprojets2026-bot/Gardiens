import Phaser from 'phaser';
import { themed, type ArtManifest } from '../core/assets';
import type { Difficulty } from '../core/save';
import type { LevelDef } from '../data/types';
import { isAnimated } from '../physics/movers';
import { themeOf } from '../data/themes';
export { buildSolids } from './solids';
import type { PlatformDef, Solid } from '../physics/geom';

// Collisions et habillage du terrain : sols peints en tuiles, bords arrondis, plateformes,
// glace scintillante, eau avec reflet ondulant.

export interface PlatformVisual {
  s: Solid;
  img: Phaser.GameObjects.Image;
  ox: number;
  oy: number;
}

export interface WaterVisual {
  x: number;
  w: number;
  y: number;
  refl?: Phaser.GameObjects.TileSprite;
  disp?: { x: number; y: number };
}

export class Terrain {
  platVis: PlatformVisual[] = [];
  water: WaterVisual[] = [];

  constructor(private scene: Phaser.Scene, private L: LevelDef, private m: ArtManifest, private solids: Solid[], private difficulty: Difficulty) {}

  /** Teinte des tuiles empruntées à un autre monde (aucune pour les mondes illustrés d'origine). */
  private get tint(): number | undefined {
    return themeOf(this.L.theme).tileTint;
  }

  private k(key: string) {
    return themed(this.scene, key, this.L.theme);
  }

  build(): void {
    const s = this.scene;
    const mid = this.k('ground_mid');
    const meta = this.m.images[mid];
    const vis = new Map<object, { sc: number; topPx: number }>();
    if (s.textures.exists(mid)) {
      const src = s.textures.get(mid).getSourceImage() as HTMLImageElement;
      const sc = 300 / src.height;
      const topPx = (meta?.top ?? src.height * 0.12) * sc;
      const edgeW = s.textures.exists(this.k('ground_l')) ? (s.textures.get(this.k('ground_l')).getSourceImage() as HTMLImageElement).width * sc : 0;
      for (const g of this.L.grounds) {
        const left = g.x <= 0 ? 0 : edgeW * 0.55;
        const right = g.x + g.w >= this.L.width ? 0 : edgeW * 0.55;
        const ts = s.add.tileSprite(g.x + left, g.y - topPx, g.w - left - right, 300, mid).setOrigin(0, 0).setDepth(-40);
        if (this.tint != null) ts.setTint(this.tint);
        ts.setTileScale(sc, sc);
        ts.tilePositionX = (g.x + left) / sc;
        // Remplissage sombre sous la tuile (le sol continue vers le bas).
        s.add.rectangle(g.x + 24, g.y - topPx + 300 - 6, g.w - 48, 900, 0x24170f).setOrigin(0, 0).setDepth(-41);
        vis.set(g, { sc, topPx });
      }
      if (s.textures.exists(this.k('ground_l'))) {
        for (const g of this.L.grounds) {
          const v = vis.get(g)!;
          if (g.x > 0) s.add.image(g.x, g.y - v.topPx, this.k('ground_l')).setOrigin(0, 0).setScale(v.sc).setDepth(-39).setTint(this.tint ?? 0xffffff);
          if (g.x + g.w < this.L.width) s.add.image(g.x + g.w, g.y - v.topPx, this.k('ground_r')).setOrigin(1, 0).setScale(v.sc).setDepth(-39).setTint(this.tint ?? 0xffffff);
        }
      }
    }
    for (const g of this.L.grounds) {
      if (g.material !== 'ice') continue;
      const gr = s.add.graphics().setDepth(-38);
      gr.fillStyle(0xd8f4ff, 0.55).fillRoundedRect(g.x + 10, g.y - 6, g.w - 20, 16, 8);
      gr.fillStyle(0xffffff, 0.75).fillRoundedRect(g.x + 30, g.y - 4, g.w - 60, 4, 2);
      s.add
        .particles(0, 0, 'spark', {
          x: { min: g.x + 20, max: g.x + g.w - 20 },
          y: { min: g.y - 8, max: g.y + 4 },
          lifespan: 900,
          frequency: 160,
          scale: { start: 0.25, end: 0 },
          alpha: { start: 0.9, end: 0 },
          blendMode: 'ADD',
          tint: 0xcff0ff,
        })
        .setDepth(-37);
    }
    for (const p of this.L.platforms) {
      if (p.kind === 'bridge' && this.difficulty === 'expert' && !p.requires) continue;
      this.drawPlatform(p);
    }
    for (const w of this.L.water) this.buildWater(w.x, w.w, w.y);
  }

  private drawPlatform(p: PlatformDef): void {
    const s = this.scene;
    const key = this.k(p.kind === 'log' ? 'log' : p.kind === 'cloud' ? 'plat_small' : `plat_${p.kind}`);
    if (!s.textures.exists(key)) return;
    const meta = this.m.images[key] ?? ({} as never);
    const src = s.textures.get(key).getSourceImage() as HTMLImageElement;
    const usable = meta.usableW ?? src.width * 0.86;
    const sc = p.w / usable;
    const top = meta.top ?? src.height * (p.kind === 'log' ? 0.22 : 0.12);
    const img = s.add.image(p.x + p.w / 2, p.y - top * sc + (src.height * sc) / 2, key).setScale(sc).setDepth(-35);
    if (this.tint != null) img.setTint(this.tint);
    const solid = this.solids.find((x) => x.ref === p);
    if (solid && (isAnimated(solid) || p.requires)) this.platVis.push({ s: solid, img, ox: img.x - p.x, oy: img.y - p.y });
    if (p.requires) {
      img.setAlpha(0.18).setTint(0x9fe8ff);
      img.setData('ghost', true);
    }
  }

  private buildWater(x: number, w: number, y: number): void {
    const s = this.scene;
    const g = s.add.graphics().setDepth(-36);
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(108, 196, 196), new Phaser.Display.Color(22, 70, 96), 100, t * 100);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 0.92);
      g.fillRect(x, y + (520 / 24) * i, w, 520 / 24 + 1);
    }
    const wv: WaterVisual = { x, w, y };
    const forest = this.k('bg_forest');
    if (s.textures.exists(forest)) {
      const src = s.textures.get(forest).getSourceImage() as HTMLImageElement;
      const refl = s.add.tileSprite(x, y + 4, w, 260, forest).setOrigin(0, 0).setDepth(-35).setFlipY(true).setAlpha(0.3).setTint(0x9fe3e0);
      refl.setTileScale(640 / src.height, 640 / src.height);
      if (s.renderer.type === Phaser.WEBGL) {
        refl.enableFilters();
        wv.disp = refl.filters!.internal.addDisplacement('ripples', 0.006, 0.012) as unknown as { x: number; y: number };
      }
      wv.refl = refl;
    }
    g.fillStyle(0xe8fff8, 0.55).fillRect(x, y - 1, w, 3);
    this.water.push(wv);
    s.add
      .particles(0, 0, 'glint', {
        x: { min: x, max: x + w },
        y: { min: y + 6, max: y + 140 },
        lifespan: 1500,
        frequency: 70,
        alpha: { values: [0, 0.9, 0] },
        scaleX: { min: 0.6, max: 1.6 },
        scaleY: 1,
        blendMode: 'ADD',
      })
      .setDepth(-34);
  }

  /** Fait apparaître les plateformes liées à un interrupteur. */
  reveal(tag: string): void {
    for (const v of this.platVis) {
      if (v.s.tag !== tag) continue;
      v.s.off = false;
      if (this.tint != null) v.img.setTint(this.tint);
      else v.img.clearTint();
      this.scene.tweens.add({ targets: v.img, alpha: 1, duration: 500 });
      v.img.setData('ghost', false);
    }
  }
}
