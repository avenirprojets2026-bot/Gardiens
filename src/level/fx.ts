import Phaser from 'phaser';
import { VIEW_W } from '../config';
import { QUALITY, type QualityLevel } from '../core/quality';
import type { LevelDef } from '../data/types';
import type { Palette } from './backdrop';
import { themeOf, type ThemeDef } from '../data/themes';

// Effets visuels d'un niveau : étincelles, poussière, traînées magiques, confettis,
// particules d'ambiance (feuilles, pétales, poussière de lumière), lucioles, étalonnage caméra.

interface Firefly {
  s: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  f: number;
  front: boolean;
}

export class LevelFx {
  bursts!: Phaser.GameObjects.Particles.ParticleEmitter;
  dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  ambient!: Phaser.GameObjects.Particles.ParticleEmitter;
  motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  fireflies: Firefly[] = [];
  particleScale = 1;
  filtersOn = false;

  private theme: ThemeDef;

  constructor(private scene: Phaser.Scene, private L: LevelDef, private pal: Palette) {
    this.theme = themeOf(L.theme);
  }

  build(quality: QualityLevel): void {
    const s = this.scene;
    const q = QUALITY[quality];
    this.particleScale = q.particles;
    this.bursts = s.add
      .particles(0, 0, 'spark', {
        emitting: false,
        lifespan: { min: 400, max: 900 },
        speed: { min: 120, max: 380 },
        scale: { start: 0.55, end: 0 },
        rotate: { min: 0, max: 360 },
        blendMode: 'ADD',
        gravityY: 300,
      })
      .setDepth(20);
    this.dust = s.add
      .particles(0, 0, 'puff', {
        emitting: false,
        lifespan: { min: 350, max: 600 },
        speedX: { min: -140, max: 140 },
        speedY: { min: -60, max: -10 },
        scale: { start: 0.35, end: 0.9 },
        alpha: { start: 0.55, end: 0 },
        gravityY: -30,
      })
      .setDepth(-11);
    this.trail = s.add
      .particles(0, 0, 'glow', {
        emitting: false,
        lifespan: 450,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xfff0b0, 0xffd36b, 0xbfe8ff],
        blendMode: 'ADD',
        speed: { min: 10, max: 60 },
      })
      .setDepth(-12);
    const amb = this.theme.ambient;
    this.ambient = s.add
      .particles(0, 0, amb.key, {
        x: { min: 0, max: VIEW_W + 200 },
        y: -40,
        lifespan: 9000,
        speedY: { min: amb.speedY[0], max: amb.speedY[1] },
        speedX: { min: -40, max: 10 },
        rotate: { start: 0, end: 540 },
        scale: { min: amb.scale[0], max: amb.scale[1] },
        frequency: amb.frequency,
        alpha: 0.9,
        ...(amb.tints ? { tint: amb.tints } : {}),
        ...(amb.additive ? { blendMode: 'ADD' } : {}),
      })
      .setDepth(45);
    const n = Math.round(70 * q.particles);
    for (let i = 0; i < n; i++) {
      const front = i % 5 === 0;
      const img = s.add
        .image(0, 0, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(this.pal.fireflies[i % this.pal.fireflies.length])
        .setScale(front ? 0.45 : 0.22)
        .setDepth(front ? 50 : -33);
      if (this.L.mood === 'dusk' || this.L.mood === 'night') img.setScale(img.scale * 1.25);
      this.fireflies.push({ s: img, x: Math.random() * this.L.width, y: 140 + Math.random() * 380, vx: 0, vy: 0, t: Math.random() * 10, f: 0.6 + Math.random() * 1.4, front });
    }
    if (s.renderer.type === Phaser.WEBGL && q.filters) {
      const cam = s.cameras.main;
      const cm = cam.filters.internal.addColorMatrix();
      const gr = this.theme.grading;
      cm.colorMatrix.saturate(gr.saturate, true);
      cm.colorMatrix.contrast(gr.contrast, true);
      if (gr.brighten && this.L.mood !== 'dusk') cm.colorMatrix.brightness(gr.brighten, true);
      cam.filters.external.addVignette(0.5, 0.5, 0.95, gr.vignette);
      this.filtersOn = true;
    }
    this.confetti = s.add
      .particles(0, 0, 'confetti', {
        emitting: false,
        lifespan: { min: 2200, max: 3600 },
        speed: { min: 380, max: 900 },
        angle: { min: 240, max: 300 },
        gravityY: 520,
        maxVelocityY: 260,
        rotate: {
          onEmit: () => 0,
          onUpdate: (p: Phaser.GameObjects.Particles.Particle & { r0?: number; spin?: number }, _k: string, t: number) =>
            (p.r0 ??= Math.random() * 360) + t * (p.spin ??= (Math.random() - 0.5) * 1400),
        },
        scaleX: { min: 0.9, max: 1.5 },
        scaleY: {
          onEmit: () => 1,
          onUpdate: (p: Phaser.GameObjects.Particles.Particle & { seed?: number }, _k: string, t: number) =>
            0.15 + Math.abs(Math.cos(t * 26 + (p.seed ??= Math.random() * 6))) * 1.05,
        },
        alpha: { values: [1, 1, 1, 0] },
        tint: this.pal.confetti,
      })
      .setDepth(48);
    this.motes = s.add
      .particles(0, 0, 'spark', {
        x: { min: 0, max: VIEW_W + 200 },
        y: { min: 0, max: 540 },
        lifespan: { min: 4000, max: 7000 },
        speedX: { min: -8, max: 8 },
        speedY: { min: -10, max: 4 },
        scale: { min: 0.05, max: 0.13 },
        alpha: { values: [0, 0.75, 0.6, 0] },
        tint: this.pal.motes,
        blendMode: 'ADD',
        frequency: 120,
        quantity: 1,
      })
      .setDepth(-58);
  }

  setQuality(q: QualityLevel): void {
    const p = QUALITY[q];
    this.particleScale = p.particles;
    this.fireflies.forEach((f, i) => f.s.setVisible(i < this.fireflies.length * p.particles));
    this.ambient.setFrequency(p.particles > 0.5 ? this.theme.ambient.frequency : 2400);
    this.motes.setFrequency(q === 'bas' ? -1 : q === 'moyen' ? 260 : 120);
  }

  confettiBurst(x: number, y: number, n: number, angle?: [number, number]): void {
    const ops = (this.confetti as unknown as { ops: { angle: { loadConfig(c: object): void } } }).ops;
    if (angle) ops.angle.loadConfig({ angle: { min: angle[0], max: angle[1] } });
    this.confetti.explode(Math.max(6, Math.round(n * this.particleScale)), x, y);
    if (angle) ops.angle.loadConfig({ angle: { min: 240, max: 300 } });
  }

  update(view: Phaser.Geom.Rectangle, dt: number): void {
    for (const f of this.fireflies) {
      if (!f.s.visible) continue;
      f.t += dt;
      f.vx += (Math.sin(f.t * 0.9 + f.f * 7) * 30 - f.vx) * dt;
      f.vy += (Math.cos(f.t * 0.7 + f.f * 3) * 20 - f.vy) * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < view.x - 200) f.x += VIEW_W + 400;
      else if (f.x > view.right + 200) f.x -= VIEW_W + 400;
      const par = f.front ? 1.25 : 0.9;
      f.s.setPosition(view.x + (f.x - view.x) * par, f.y).setAlpha(Math.max(0, Math.sin(f.t * f.f * 2.2)) * 0.9);
    }
    this.ambient.setPosition(view.x - 100, view.y);
    this.motes.setPosition(view.x - 100, view.y);
  }
}
