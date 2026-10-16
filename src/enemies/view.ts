import Phaser from 'phaser';
import { themed } from '../core/assets';
import type { LevelDef } from '../data/types';
import { themeOf } from '../data/themes';
import { fitScale } from '../ui/widgets';
import { createEnemy, enemyRect, stepEnemy, stepSpore, type EnemyState, type Spore, type TargetInfo } from './logic';

// Ennemis d'un niveau : état logique + illustration animée (rebond de marche, alerte « ! »,
// poussière de charge, aura des feux follets, gonflement du champignon avant de cracher).

export interface EnemyEntity {
  st: EnemyState;
  img: Phaser.GameObjects.Image;
  aura?: Phaser.GameObjects.Image;
  mark?: Phaser.GameObjects.Text;
  baseScale: number;
}

export interface SporeEntity {
  sp: Spore;
  img: Phaser.GameObjects.Image;
}


export class Enemies {
  list: EnemyEntity[] = [];
  spores: SporeEntity[] = [];
  /** Appelé quand un champignon crache (son, poussière). */
  onSpit?: (x: number, y: number) => void;
  onAlert?: (x: number) => void;

  constructor(private scene: Phaser.Scene, private L: LevelDef) {}

  private groundAt(x: number): number {
    return this.L.grounds.find((g) => x >= g.x && x <= g.x + g.w)?.y ?? 560;
  }

  build(): void {
    const s = this.scene;
    const theme = themeOf(this.L.theme);
    const beetle = themed(s, 'beetle', this.L.theme);
    const mush = theme.spitterKey;
    for (const d of this.L.enemies) {
      const st = createEnemy(d, this.groundAt(d.x));
      let img: Phaser.GameObjects.Image;
      let aura: Phaser.GameObjects.Image | undefined;
      let baseScale = 1;
      if (st.kind === 'flyer') {
        aura = s.add.image(st.x, st.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(theme.wispTint).setScale(2.4).setAlpha(0.7).setDepth(-16);
        img = s.add.image(st.x, st.y, 'wisp_face').setTint(theme.wispTint).setDepth(-15);
        baseScale = 0.8;
      } else if (st.kind === 'spitter') {
        if (!s.textures.exists(mush)) continue;
        img = s.add.image(st.x, st.y + 6, mush).setOrigin(0.5, 1).setDepth(-15);
        baseScale = fitScale(s, mush, 110);
        img.setTint(theme.id === 'forest' ? 0xffd0d8 : 0xffffff);
      } else {
        if (!s.textures.exists(beetle)) continue;
        img = s.add.image(st.x, st.y, beetle).setOrigin(0.5, 1).setDepth(-15);
        baseScale = fitScale(s, beetle, st.kind === 'charger' ? 104 : 92);
        if (st.kind === 'charger') {
          img.setTint(0xffc0a0);
          aura = s.add.image(st.x, st.y - 30, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7040).setScale(2).setAlpha(0).setDepth(-16);
        }
      }
      img.setScale(baseScale);
      const mark =
        st.kind === 'charger' || st.kind === 'spitter'
          ? s.add
              .text(st.x, st.y - 120, '!', { fontFamily: '"Baloo 2", sans-serif', fontSize: '48px', fontStyle: '800', color: '#ffdf5a' })
              .setOrigin(0.5)
              .setStroke('#7a2a08', 8)
              .setDepth(25)
              .setVisible(false)
          : undefined;
      this.list.push({ st, img, aura, mark, baseScale });
    }
  }

  step(dt: number, target: TargetInfo): void {
    for (const e of this.list) {
      const prevMode = e.st.mode;
      const spore = stepEnemy(e.st, dt, target);
      if (e.st.mode === 'alert' && prevMode !== 'alert') this.onAlert?.(e.st.x);
      if (spore) {
        const img = this.scene.add.image(spore.x, spore.y, 'spore').setDepth(-9).setScale(0.9);
        img.setTint(themeOf(this.L.theme).sporeTint);
        this.spores.push({ sp: spore, img });
        this.onSpit?.(spore.x, spore.y);
      }
    }
    for (const s of this.spores) {
      stepSpore(s.sp, dt);
      const gy = this.groundAt(s.sp.x);
      if (s.sp.y > gy - 10 || s.sp.y > this.L.killY) s.sp.alive = false;
    }
  }

  /** Supprime les spores mortes (avec petite gerbe). */
  cleanSpores(burst: (x: number, y: number) => void): void {
    this.spores = this.spores.filter((s) => {
      if (s.sp.alive) return true;
      burst(s.sp.x, s.sp.y);
      s.img.destroy();
      return false;
    });
  }

  defeatVisual(e: EnemyEntity): void {
    e.st.alive = false;
    const s = this.scene;
    e.mark?.setVisible(false);
    if (e.aura) s.tweens.add({ targets: e.aura, alpha: 0, scale: 4, duration: 300, onComplete: () => e.aura?.destroy() });
    if (e.st.kind === 'flyer') {
      s.tweens.add({ targets: e.img, scale: e.baseScale * 1.8, alpha: 0, duration: 260, onComplete: () => e.img.destroy() });
      return;
    }
    s.tweens.add({ targets: e.img, scaleY: e.img.scaleY * 0.25, scaleX: e.img.scaleX * 1.35, duration: 110, ease: 'Quad.easeOut' });
    s.tweens.add({ targets: e.img, alpha: 0, delay: 350, duration: 300, onComplete: () => e.img.destroy() });
  }

  rect(e: EnemyEntity) {
    return enemyRect(e.st);
  }

  render(time: number, dt: number): void {
    for (const e of this.list) {
      const st = e.st;
      if (!st.alive) continue;
      const flip = st.dir > 0 ? -1 : 1;
      if (st.kind === 'flyer') {
        const wob = Math.sin(time * 0.012 + st.x) * 0.06;
        e.img.setPosition(st.x, st.y).setScale(e.baseScale * (1 + wob), e.baseScale * (1 - wob)).setFlipX(st.dir > 0);
        e.aura?.setPosition(st.x, st.y).setScale(2.2 + 0.3 * Math.sin(time * 0.008 + st.x)).setAlpha(st.mode === 'swoop' ? 0.95 : 0.65);
      } else if (st.kind === 'spitter') {
        const k = st.mode === 'alert' ? Math.min(1, st.modeT / 0.55) : 0;
        const breathe = Math.sin(time * 0.003 + st.x) * 0.02;
        e.img.setScale(e.baseScale * (1 + 0.12 * k + breathe), e.baseScale * (1 - 0.1 * k + 0.25 * k * k - breathe));
        e.mark?.setVisible(st.mode === 'alert').setPosition(st.x, st.y - 130 - k * 10);
      } else {
        const speed = st.kind === 'charger' && st.mode === 'charge' ? 2 : 1;
        st.t += dt * (speed - 1);
        const bob = Math.abs(Math.sin(st.t * 9 * speed));
        const shake = st.mode === 'alert' ? Math.sin(time * 0.08) * 4 : 0;
        e.img.setPosition(st.x + shake, st.y - bob * 3);
        const tired = st.mode === 'tired' ? 0.9 : 1;
        e.img.setScale(e.baseScale * (1 + 0.04 * bob) * flip, e.baseScale * (1 - 0.04 * bob) * tired);
        e.img.setRotation(st.mode === 'charge' ? -flip * 0.12 : Math.sin(st.t * 9) * 0.04);
        if (e.aura) e.aura.setPosition(st.x, st.y - 30).setAlpha(st.mode === 'charge' ? 0.6 : st.mode === 'alert' ? 0.35 : 0);
        e.mark?.setVisible(st.mode === 'alert').setPosition(st.x, st.y - 110 - Math.abs(Math.sin(time * 0.02)) * 8);
      }
    }
    for (const s of this.spores) s.img.setPosition(s.sp.x, s.sp.y).setRotation(time * 0.01);
  }
}
