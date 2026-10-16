import Phaser from 'phaser';
import { perf } from '../core/perf';
import { saves } from '../core/save';
import { FONT_BODY, FONT_TITLE, IS_TOUCH_DEVICE, VIEW_W } from '../config';
import { SPEAKERS } from '../data/story';
import type { Line } from '../data/types';
import { bubble, makeGlass } from '../ui/widgets';
import { setupCamera } from './common';
import type { LevelScene } from './Level';

// Interface en jeu : cœurs, cristaux, étoiles, jauge du pouvoir, barre du boss,
// messages, petites répliques des personnages, commandes tactiles.

export class HUDScene extends Phaser.Scene {
  private level!: LevelScene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private starSlots: Phaser.GameObjects.Image[] = [];
  private crystalIcon!: Phaser.GameObjects.Image;
  private crystalText!: Phaser.GameObjects.Text;
  private toastC?: Phaser.GameObjects.Container;
  private talkC?: Phaser.GameObjects.Container;
  private talkQueue: Line[] = [];
  private perfText!: Phaser.GameObjects.Text;
  private powerRing!: Phaser.GameObjects.Graphics;
  private bossUi: Phaser.GameObjects.Image[] = [];
  private bossPanel?: Phaser.GameObjects.Container;
  private touchPower?: Phaser.GameObjects.Container;

  constructor() {
    super('HUD');
  }

  init(d: { level: LevelScene }): void {
    this.level = d.level;
  }

  create(): void {
    setupCamera(this);
    this.hearts = [];
    this.starSlots = [];
    this.bossUi = [];
    this.bossPanel = undefined;
    this.talkQueue = [];
    const L = this.level;
    makeGlass(this, 26 + L.maxHearts * 26, 44, 30 + L.maxHearts * 52, 60, 0.35);
    for (let i = 0; i < L.maxHearts; i++) {
      const h = this.add.image(46 + i * 52, 44, 'heart');
      h.setScale(48 / h.width);
      this.hearts.push(h);
    }
    makeGlass(this, VIEW_W / 2, 44, 200, 56, 0.45);
    this.crystalIcon = this.add.image(VIEW_W / 2 - 60, 44, 'crystal');
    this.crystalIcon.setScale(44 / this.crystalIcon.height);
    this.crystalText = this.add
      .text(VIEW_W / 2 - 28, 44, '0', { fontFamily: FONT_TITLE, fontSize: '38px', fontStyle: '800', color: '#e6f8ff' })
      .setOrigin(0, 0.5)
      .setStroke('#0b2a44', 6);
    for (let i = 0; i < 3; i++) {
      const s = this.add.image(VIEW_W - 200 + i * 58, 44, 'star');
      s.setScale(50 / s.width).setTint(0x30384a).setAlpha(0.75);
      this.starSlots.push(s);
    }
    // Pause.
    const pb = this.add.circle(VIEW_W - 44, 110, 30, 0x0b1a2a, 0.45).setStrokeStyle(2, 0xfff1c2, 0.3).setInteractive({ useHandCursor: true });
    this.add.text(VIEW_W - 44, 110, 'II', { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
    pb.on('pointerdown', () => this.level.phase === 'play' && this.level.pause());
    // Jauge de pouvoir (recharge) autour de l'icône.
    this.powerRing = this.add.graphics();

    const ev = this.level.events;
    ev.on('crystal', (n: number) => {
      this.crystalText.setText(String(n));
      const base = 44 / this.crystalIcon.height;
      this.tweens.add({ targets: this.crystalIcon, scale: { from: base * 1.35, to: base }, duration: 220 });
    }, this);
    ev.on('star', (i: number) => {
      const s = this.starSlots[i];
      s.clearTint().setAlpha(1);
      this.tweens.add({ targets: s, scale: { from: (50 / s.width) * 2.2, to: 50 / s.width }, angle: { from: -180, to: 0 }, duration: 700, ease: 'Back.easeOut' });
    }, this);
    ev.on('hearts', (n: number) =>
      this.hearts.forEach((h, i) => {
        const on = i < n;
        h.setTint(on ? 0xffffff : 0x3a3a48).setAlpha(on ? 1 : 0.55);
        if (!on && h.getData('on') !== false) this.tweens.add({ targets: h, scale: { from: (48 / h.width) * 1.4, to: 48 / h.width }, duration: 300 });
        if (on && h.getData('on') === false) this.tweens.add({ targets: h, scale: { from: (48 / h.width) * 1.5, to: 48 / h.width }, duration: 300, ease: 'Back.easeOut' });
        h.setData('on', on);
      }),
    this);
    ev.on('toast', (t: string) => this.toast(t), this);
    ev.on('talk', (lines: Line[]) => {
      this.talkQueue.push(...lines);
      if (!this.talkC) this.nextTalk();
    }, this);
    ev.on('boss', (hp: number, max: number) => this.bossBar(hp, max), this);
    this.events.once('shutdown', () => ev.off('crystal').off('star').off('hearts').off('toast').off('boss').off('talk'));

    this.buildTouch();
    this.perfText = this.add
      .text(12, 708, '', { fontFamily: 'monospace', fontSize: '15px', color: '#b6ffb0', backgroundColor: '#000000aa', padding: { x: 8, y: 6 } })
      .setOrigin(0, 1)
      .setVisible(saves.data.settings.showPerf);
    this.input.keyboard?.on('keydown-F3', () => {
      this.perfText.setVisible(!this.perfText.visible);
      saves.data.settings.showPerf = this.perfText.visible;
      saves.save();
    });
  }

  private bossBar(hp: number, max: number): void {
    if (!this.bossPanel) {
      const name = this.registry.get('bossName') ?? 'Boss';
      const g = makeGlass(this, VIEW_W / 2, 675, 420, 62, 0.6);
      const t = this.add.text(VIEW_W / 2 - 190, 675, name, { fontFamily: FONT_TITLE, fontSize: '24px', fontStyle: '800', color: '#ffe2a0' }).setOrigin(0, 0.5);
      this.bossPanel = this.add.container(0, 0, [g, t]);
      for (let i = 0; i < max; i++) {
        const s = this.add.image(VIEW_W / 2 + 90 + i * 40, 675, 'star').setScale(30 / 220).setTint(0xffcc4a);
        this.bossUi.push(s);
      }
      this.bossPanel.setAlpha(0).y = 40;
      this.tweens.add({ targets: this.bossPanel, alpha: 1, y: 0, duration: 400, ease: 'Back.easeOut' });
    }
    this.bossUi.forEach((s, i) => {
      const on = i < hp;
      if (!on && s.alpha === 1) this.tweens.add({ targets: s, scale: { from: 0.3, to: 30 / 220 }, duration: 400 });
      s.setAlpha(on ? 1 : 0.25).setTint(on ? 0xffcc4a : 0x444444);
    });
    if (hp <= 0) this.time.delayedCall(1200, () => this.bossPanel && this.tweens.add({ targets: [this.bossPanel, ...this.bossUi], alpha: 0, duration: 600 }));
  }

  private toast(text: string): void {
    this.toastC?.destroy();
    const c = bubble(this, text, 30, false).setPosition(VIEW_W / 2, 140).setScale(0.6).setAlpha(0);
    this.toastC = c;
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: 120, delay: 2200, duration: 400, onComplete: () => c.destroy() });
  }

  /** Réplique courte en bas d'écran, sans interrompre le jeu. */
  private nextTalk(): void {
    this.talkC?.destroy();
    this.talkC = undefined;
    const line = this.talkQueue.shift();
    if (!line) return;
    const heroId = saves.profile.hero;
    const who = line.who === 'hero' ? heroId : line.who;
    const sp = SPEAKERS[who] ?? SPEAKERS.narrator;
    const portraitKey = who === 'lumi' ? null : who;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    g.fillStyle(0x0b1a2a, 0.78).fillRoundedRect(-420, -46, 840, 92, 24);
    g.lineStyle(2, 0xffe1a0, 0.5).strokeRoundedRect(-420, -46, 840, 92, 24);
    parts.push(g);
    if (portraitKey && this.textures.exists(portraitKey)) {
      const mask = this.make.graphics({}, false).fillCircle(VIEW_W / 2 - 372, 588, 38);
      const p = this.add.image(-372, 140, portraitKey).setOrigin(0.5, 0.18);
      p.setScale(260 / p.height).setMask(mask.createGeometryMask());
      const ring = this.add.circle(-372, -2, 40).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(sp.color).color);
      parts.push(p, ring);
    } else {
      const l = this.add.image(-372, 0, 'glow').setTint(0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3);
      const c = this.add.image(-372, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
      this.tweens.add({ targets: l, scale: 1.6, duration: 600, yoyo: true, repeat: -1 });
      parts.push(l, c);
    }
    parts.push(this.add.text(-316, -34, sp.name, { fontFamily: FONT_TITLE, fontSize: '22px', fontStyle: '800', color: sp.color }));
    parts.push(
      this.add.text(-316, -6, line.text, { fontFamily: FONT_BODY, fontSize: '21px', fontStyle: '600', color: '#fff8e6', wordWrap: { width: 720 } }),
    );
    const c = this.add.container(VIEW_W / 2, 590, parts).setAlpha(0);
    this.talkC = c;
    this.tweens.add({ targets: c, alpha: 1, y: 584, duration: 250 });
    const dur = 1800 + line.text.length * 45;
    this.time.delayedCall(dur, () => {
      if (this.talkC !== c) return;
      this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => this.nextTalk() });
    });
  }

  /** Commandes tactiles : zones larges et tolérantes, multitouche, maintien du pouvoir. */
  private buildTouch(): void {
    const mode = saves.data.settings.touchControls;
    const touch = this.sys.game.device.input.touch || IS_TOUCH_DEVICE;
    if (mode === 'off' || (mode === 'auto' && !touch)) return;
    this.input.addPointer(3);
    const sc = saves.data.settings.touchScale;
    const t = this.level.inp.touch;
    const pad = (x: number, y: number, r: number, label: string, down: () => void, up: () => void) => {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.14).fillCircle(0, 0, r);
      g.lineStyle(4, 0xfff1c2, 0.6).strokeCircle(0, 0, r);
      const txt = this.add.text(0, 0, label, { fontFamily: FONT_TITLE, fontSize: `${Math.round(r * 0.9)}px`, fontStyle: '800', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.9);
      const c = this.add.container(x, y, [g, txt]).setSize(r * 2.4, r * 2.4).setInteractive();
      const press = () => {
        down();
        c.setScale(0.9).setAlpha(1);
        this.level.inp.lastDevice = 'touch';
      };
      c.on('pointerdown', press);
      // Glisser le doigt d'une flèche à l'autre change de direction sans relever.
      c.on('pointerover', (p: Phaser.Input.Pointer) => p.isDown && press());
      const release = () => {
        up();
        c.setScale(1).setAlpha(0.85);
      };
      c.on('pointerup', release);
      c.on('pointerout', release);
      c.setAlpha(0.85);
      return c;
    };
    const r = 62 * sc;
    pad(105 * sc + 10, 612, r, '◀', () => (t.left = true), () => (t.left = false));
    pad(105 * sc + 10 + r * 2.35, 612, r, '▶', () => (t.right = true), () => (t.right = false));
    pad(VIEW_W - 115 * sc, 600, 78 * sc, '⤒', () => {
      t.jump = true;
      this.level.inp.pressJump();
    }, () => (t.jump = false));
    this.touchPower = pad(VIEW_W - 115 * sc - 160 * sc, 640, 54 * sc, '★', () => {
      t.power = true;
      this.level.inp.pressPower();
    }, () => {
      if (t.power) this.level.inp.releasePower();
      t.power = false;
    });
  }

  override update(): void {
    const L = this.level;
    // Jauge de recharge du pouvoir, à côté des cristaux.
    const cdMax = L.hero.power === 'sun' ? 4 : L.hero.power === 'flower' ? 0.45 : 0.9;
    const k = 1 - Math.max(0, L.powerCooldown) / cdMax;
    const cx = VIEW_W / 2 + 130, cy = 44;
    this.powerRing.clear();
    this.powerRing.fillStyle(0x0b1a2a, 0.45).fillCircle(cx, cy, 24);
    this.powerRing.lineStyle(5, L.hero.color, k >= 1 ? 1 : 0.6).beginPath();
    this.powerRing.arc(cx, cy, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k), false).strokePath();
    if (L.charge > 0) this.powerRing.fillStyle(L.hero.color, 0.5 + 0.5 * L.charge).fillCircle(cx, cy, 8 + 8 * L.charge);
    else this.powerRing.fillStyle(L.hero.color, k >= 1 ? 0.9 : 0.35).fillCircle(cx, cy, 8);
    if (this.touchPower) this.touchPower.setAlpha(k >= 1 ? 0.95 : 0.5);
    if (this.perfText?.visible) {
      const s = perf.stats();
      this.perfText.setText(
        [
          `FPS ${s.fps.toFixed(0)}  image ${s.frameAvg.toFixed(1)} ms  p95 ${s.frameP95.toFixed(1)}  pire ${s.frameWorst.toFixed(1)}`,
          `mémoire ${s.memoryMB == null ? 'n/d' : s.memoryMB.toFixed(0) + ' Mo'}  latence saut ${s.inputLatencyMs == null ? '—' : s.inputLatencyMs.toFixed(0) + ' ms'}`,
          `chargement ${Object.entries(s.loads).map(([k2, v]) => `${k2} ${v} ms`).join(' · ')}  qualité ${L.quality}`,
        ].join('\n'),
      );
    }
  }
}
