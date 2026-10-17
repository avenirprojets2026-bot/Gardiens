import Phaser from 'phaser';
import type { ArtManifest } from '../core/assets';
import type { HeroDef } from '../data/heroes';
import type { PlatformerBody } from '../physics/body';
import type { Solid } from '../physics/geom';
import type { Palette } from './backdrop';

// Rendu du héros : planches d'animation peintes (repos, marche, course, saut en 5 phases,
// pouvoir, surprise, victoire), étirement/écrasement, inclinaison selon la vitesse,
// ombre portée au sol, halo coloré, lueur de contour, bouclier et charge magique.

export class HeroView {
  sprite!: Phaser.GameObjects.Sprite;
  shadow!: Phaser.GameObjects.Image;
  halo!: Phaser.GameObjects.Image;
  shield!: Phaser.GameObjects.Image;
  charge!: Phaser.GameObjects.Image;
  glow?: { active: boolean };
  squash = { x: 1, y: 1 };
  private holdT = 0;
  private holdKey = '';
  private baseScale = 1;
  readonly key: string;

  constructor(private scene: Phaser.Scene, private hero: HeroDef, private m: ArtManifest, private pal: Palette) {
    this.key = scene.textures.exists(`${hero.id}_idle`) ? hero.id : 'soumaya';
  }

  build(): void {
    const s = this.scene;
    this.shadow = s.add.image(0, 0, 'glow').setTint(0x10200a).setAlpha(0.35).setScale(1.6, 0.35).setDepth(-19);
    const idle = s.textures.exists(`${this.key}_idle`) ? `${this.key}_idle` : this.key;
    this.halo = s.add
      .image(0, 0, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-11)
      .setTint(this.hero.color)
      .setScale(3.2, 3.8)
      .setAlpha(this.pal.halo);
    this.sprite = s.add.sprite(0, 0, idle).setOrigin(0.5, 1).setDepth(-10);
    const contentH = this.m.sheets[`${this.key}_idle`]?.contentH ?? (s.textures.get(this.key).getSourceImage() as HTMLImageElement).height;
    this.baseScale = this.hero.displayH / contentH;
    this.shield = s.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(-9).setVisible(false);
    this.charge = s.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(-8).setVisible(false).setTint(this.hero.color);
    this.setTex(idle);
    this.sprite.setTint(this.pal.heroTint);
    if (s.renderer.type === Phaser.WEBGL) {
      this.sprite.enableFilters();
      this.glow = this.sprite.filters!.internal.addGlow(this.pal.heroGlow, 3, 0, 1, false, 0.1, 8) as unknown as { active: boolean };
    }
  }

  hold(key: string, seconds: number): void {
    if (!this.scene.textures.exists(key)) return;
    this.holdT = seconds;
    this.holdKey = key;
  }

  private setTex(key: string, frame?: number): void {
    const meta = this.m.sheets[key];
    if (this.sprite.texture.key === key) {
      if (frame != null && this.sprite.frame.name !== String(frame)) this.sprite.setFrame(frame);
      return;
    }
    this.sprite.anims.stop();
    this.sprite.setTexture(key, frame ?? 0);
    this.sprite.setOrigin(meta?.originX ?? 0.5, meta?.originY ?? 1);
  }

  private play(key: string): boolean {
    if (!this.scene.anims.exists(key)) return false;
    const meta = this.m.sheets[key];
    if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) {
      this.sprite.setOrigin(meta?.originX ?? 0.5, meta?.originY ?? 1);
      this.sprite.play(key, true);
    }
    return true;
  }

  update(o: {
    body: PlatformerBody;
    x: number;
    y: number;
    time: number;
    dt: number;
    invuln: boolean;
    victory: boolean;
    shieldT: number;
    charge: number;
    solids: Solid[];
  }): void {
    const { body: b, x, y, time, dt } = o;
    const k = Math.min(1, dt * 12);
    this.squash.x += (1 - this.squash.x) * k;
    this.squash.y += (1 - this.squash.y) * k;
    const stretch = b.grounded ? 1 : 1 + Math.min(0.08, Math.abs(b.vy) / 12000);
    this.sprite.setPosition(x, y + 2);
    this.sprite.setScale(((this.baseScale * this.squash.x) / Math.sqrt(stretch)) * b.facing, this.baseScale * this.squash.y * stretch);
    this.sprite.setRotation(b.grounded ? (b.vx / b.p.maxRun) * 0.05 : b.gliding ? b.facing * 0.12 : (b.vx / b.p.maxRun) * 0.08);
    this.animate(b, time, dt, o.victory);
    this.sprite.setAlpha(o.invuln && Math.floor(time / 80) % 2 ? 0.35 : 1);

    // Ombre : projetée sur le premier solide sous le héros.
    let ground: Solid | undefined;
    for (const s of o.solids) {
      if (s.off || s.x > x || s.x + s.w < x || s.y < y - 2) continue;
      if (!ground || s.y < ground.y) ground = s;
    }
    if (ground) {
      const h = ground.y - y;
      this.shadow
        .setVisible(h < 400)
        .setPosition(x, ground.y + 2)
        .setScale(1.6 * (1 - h / 600), 0.35 * (1 - h / 600))
        .setAlpha(0.35 * (1 - h / 450));
    } else this.shadow.setVisible(false);

    this.halo.setPosition(x, y - b.p.height * 0.55);
    const on = o.shieldT > 0;
    this.shield.setVisible(on).setPosition(x, y - b.p.height / 2 - 6);
    if (on) {
      const sun = this.hero.power === 'sun';
      this.shield
        .setTint(sun ? Phaser.Display.Color.HSVToRGB(0.1 + 0.04 * Math.sin(time * 0.006), 0.6, 1).color : Phaser.Display.Color.HSVToRGB((time * 0.0004) % 1, 0.55, 1).color)
        .setAlpha(o.shieldT < 0.8 ? 0.3 + 0.3 * Math.sin(time * 0.05) : 0.6)
        .setScale(3.3 + 0.15 * Math.sin(time * 0.01));
    }
    this.charge.setVisible(o.charge > 0);
    if (o.charge > 0) {
      const full = o.charge >= 1;
      this.charge
        .setPosition(x + b.facing * 34, y - b.p.height * 0.6)
        .setScale((0.4 + o.charge * 0.9) * (full ? 1 + 0.15 * Math.sin(time * 0.03) : 1))
        .setRotation(time * 0.01)
        .setAlpha(full ? 1 : 0.7);
    }
  }

  private animate(b: PlatformerBody, time: number, dt: number, victory: boolean): void {
    const id = this.key;
    if (this.holdT > 0) {
      this.holdT -= dt;
      this.setTex(this.holdKey, 0);
    } else if (victory && b.grounded && Math.abs(b.vx) < 40 && this.scene.textures.exists(`${id}_victory`)) {
      this.setTex(`${id}_victory`, 0);
    } else if (!b.grounded && this.scene.textures.exists(`${id}_jump`)) {
      let f = 4;
      if (b.gliding) f = 3;
      else if (b.vy < -b.jumpV * 0.55) f = 1;
      else if (b.vy < -110) f = 2;
      else if (b.vy < 160) f = 3;
      this.setTex(`${id}_jump`, f);
    } else if (b.grounded && Math.abs(b.vx) > 40) {
      const fast = Math.abs(b.vx) > b.p.maxRun * 0.6;
      if (this.play(fast ? `${id}_run` : `${id}_walk`) || this.play(`${id}_run`))
        this.sprite.anims.timeScale = fast ? 0.7 + (0.5 * Math.abs(b.vx)) / b.p.maxRun : 0.8 + Math.abs(b.vx) / b.p.maxRun;
    } else if (this.scene.textures.exists(`${id}_idle`)) {
      this.setTex(`${id}_idle`, 0);
      this.sprite.scaleY *= 1 + Math.sin(time * 0.004) * 0.012;
    }
  }
}
