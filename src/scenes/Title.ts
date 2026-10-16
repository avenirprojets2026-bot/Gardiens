import Phaser from 'phaser';
import { audio } from '../core/audio';
import { saves } from '../core/save';
import { FONT_BODY, FONT_TITLE, IS_TOUCH_DEVICE, VIEW_H, VIEW_W } from '../config';
import { makeButton } from '../ui/widgets';
import { fadeTo, resetLeaving, setupCamera } from './common';

// Écran d'accueil cinématographique : forêt en parallaxe, lucioles, rayons de lumière,
// logo qui s'assemble lettre par lettre, les trois héros qui respirent.

interface Layer {
  ts: Phaser.GameObjects.TileSprite;
  speed: number;
}

export class TitleScene extends Phaser.Scene {
  private layers: Layer[] = [];
  private flies: { s: Phaser.GameObjects.Image; t: number; f: number; x: number; y: number }[] = [];
  private rays: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    resetLeaving(this);
    setupCamera(this);
    this.layers = [];
    this.flies = [];
    this.rays = [];
    const W = VIEW_W;
    const layer = (key: string, speed: number, y: number, h: number, tint?: number) => {
      if (!this.textures.exists(key)) return;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const ts = this.add.tileSprite(0, y, W, h, key).setOrigin(0, 0);
      const sc = h / src.height;
      ts.setTileScale(sc, sc);
      if (tint) ts.setTint(tint);
      this.layers.push({ ts, speed });
    };
    layer('bg_sky', 4, -60, 840);
    layer('bg_hills', 10, 130, 480);
    layer('fog', 16, 380, 180);
    layer('bg_forest', 24, 260, 520);
    for (let i = 0; i < 5; i++) {
      const r = this.add
        .image(200 + i * 260, -40, 'ray')
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.12)
        .setScale(1.3, 1)
        .setRotation(-0.3);
      this.rays.push(r);
    }
    layer('bg_forest', 40, 380, 620, 0x6f9080);
    for (let i = 0; i < 46; i++) {
      const s = this.add
        .image(0, 0, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(i % 2 ? 0xd9ff8a : 0xfff1a0)
        .setScale(0.18 + Math.random() * 0.3);
      this.flies.push({ s, t: Math.random() * 10, f: 0.5 + Math.random(), x: Math.random() * W, y: 160 + Math.random() * 520 });
    }
    this.add.image(W / 2, VIEW_H / 2, 'vignette').setDisplaySize(W, VIEW_H).setAlpha(0.45);
    this.add.image(W * 0.74, 460, 'glow').setScale(11).setTint(0xffe1a0).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);

    // Les héros, chacun avec son halo de couleur.
    const heroes: [string, number, number, number, number][] = [
      ['hajar', 0.63, 470, 300, 0x8fe36b],
      ['soumaya', 0.79, 560, 0, 0xffd36b],
      ['zakaria', 0.93, 400, 600, 0xff9a5c],
    ];
    heroes.forEach(([key, rx, h, delay, color], i) => {
      if (!this.textures.exists(key)) return;
      this.add.image(W * rx, 740 - h * 0.5, 'glow').setTint(color).setAlpha(0.22).setScale(h / 70).setBlendMode(Phaser.BlendModes.ADD);
      const img = this.add.image(W * rx + 300, 740, key).setOrigin(0.5, 1).setAlpha(0);
      img.setScale(h / img.height);
      this.tweens.add({ targets: img, x: W * rx, alpha: 1, duration: 900, delay: 300 + i * 220, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: img, y: img.y - 10, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1200 + delay });
    });

    this.buildLogo();

    const hasProgress = Object.keys(saves.profile.levels).length > 0;
    const play = makeButton(this, 300, 470, hasProgress ? '▶  Continuer' : '▶  Jouer', () => this.start(), {
      w: 380,
      h: 88,
      size: 40,
      primary: true,
    });
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    makeButton(this, 200, 572, 'Trésors', () => fadeTo(this, 'Gallery', {}, 350), { w: 180, h: 58, size: 24 });
    makeButton(this, 400, 572, 'Réglages', () => this.scene.launch('Settings', { from: 'Title' }), { w: 180, h: 58, size: 24 });

    this.add
      .text(300, 640, 'Soumaya, Hajar et Zakaria t’attendent !', { fontFamily: FONT_BODY, fontSize: '22px', fontStyle: '600', color: '#fff8e6' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000', 6);
    this.add
      .text(
        W - 20,
        704,
        IS_TOUCH_DEVICE ? 'Astuce : joue en plein écran, téléphone à l’horizontale' : 'Flèches/ZQSD : bouger · Espace : sauter · X : pouvoir · Échap : pause',
        { fontFamily: FONT_BODY, fontSize: '16px', color: '#ffffffaa' },
      )
      .setOrigin(1, 1);

    this.input.keyboard?.on('keydown-ENTER', () => this.start());
    this.input.keyboard?.on('keydown-SPACE', () => this.start());
    const music = () => audio.play('music', 'music_title', 1500);
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, music);
    else music();
    this.cameras.main.fadeIn(800, 10, 20, 30);
  }

  private buildLogo(): void {
    const line1 = 'Les Gardiens';
    const style = (size: number, color: string) => ({ fontFamily: FONT_TITLE, fontSize: `${size}px`, fontStyle: '800', color });
    // Lettre par lettre : chaque lettre tombe et rebondit.
    let x = 90;
    [...line1].forEach((ch, i) => {
      const t = this.add.text(x, 120, ch, style(96, '#fff3c8')).setStroke('#5a2d0c', 10).setShadow(0, 6, '#1b0d03', 14, true, true);
      // La largeur mesurée inclut le contour : on la retire pour un crénage naturel.
      x += t.width - 10;
      t.setAlpha(0).y -= 60;
      this.tweens.add({ targets: t, alpha: 1, y: 120, duration: 650, ease: 'Bounce.easeOut', delay: 200 + i * 45 });
    });
    const sub = this.add.text(96, 215, 'des Mondes Magiques', style(56, '#ffd77a')).setStroke('#5a2d0c', 10).setShadow(0, 6, '#1b0d03', 14, true, true);
    sub.setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: sub, alpha: 1, scale: 1, duration: 900, ease: 'Back.easeOut', delay: 900 });
    // Étincelle qui parcourt le logo.
    const sparkle = this.add.image(90, 170, 'spark').setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setAlpha(0);
    this.tweens.add({
      targets: sparkle,
      x: { from: 90, to: 620 },
      alpha: { from: 1, to: 0 },
      duration: 1400,
      delay: 1800,
      repeat: -1,
      repeatDelay: 3800,
      ease: 'Sine.easeInOut',
    });
    const tag = this.add
      .text(100, 300, 'Dix mondes à rallumer', { fontFamily: FONT_BODY, fontSize: '28px', color: '#e8f6ff' })
      .setShadow(0, 2, '#000', 6)
      .setAlpha(0);
    this.tweens.add({ targets: tag, alpha: 1, duration: 900, delay: 1300 });
  }

  private start(): void {
    if (this.scene.isActive('Settings')) return;
    audio.sfx('sfx_whoosh');
    fadeTo(this, 'HeroSelect', {}, 600);
  }

  override update(_t: number, dms: number): void {
    const dt = dms / 1000;
    for (const l of this.layers) l.ts.tilePositionX += (l.speed * dt) / l.ts.tileScaleX;
    for (const f of this.flies) {
      f.t += dt;
      f.x += Math.sin(f.t * 0.8 + f.f * 5) * 16 * dt;
      f.y += Math.cos(f.t * 0.6 + f.f * 2) * 10 * dt;
      f.s.setPosition(f.x, f.y).setAlpha(Math.max(0, Math.sin(f.t * f.f * 2)) * 0.9);
    }
    this.rays.forEach((r, i) => r.setAlpha(0.08 + 0.06 * Math.sin(_t * 0.0006 + i * 1.7)));
  }
}
