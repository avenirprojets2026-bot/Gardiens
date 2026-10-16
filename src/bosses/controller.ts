import Phaser from 'phaser';
import { audio } from '../core/audio';
import { themed } from '../core/assets';
import type { LevelDef } from '../data/types';
import { themeOf } from '../data/themes';
import type { PlatformerBody } from '../physics/body';
import { overlaps, type Solid } from '../physics/geom';
import { fitScale } from '../ui/widgets';
import { ChargerBoss } from './charger';
import { TreeBoss } from './tree';
import { PatternBoss } from './pattern';
import { BOSS_PATTERNS } from './roster';
import type { BossEvent, BossLogic } from './types';

// Combat de boss : arène qui se ferme, logique du boss, rendu (poses peintes, tremblement
// d'avertissement, ombres des glands, racines), interactions avec le héros.

export interface BossHost {
  scene: Phaser.Scene;
  L: LevelDef;
  solids: Solid[];
  body: PlatformerBody;
  prevBottom: number;
  shieldT: number;
  invuln: number;
  playing: boolean;
  hurt(dir: number): void;
  shake(amp: number, dur: number): void;
  burst(n: number, x: number, y: number): void;
  dustAt(n: number, x: number, y: number): void;
  toast(text: string): void;
  emitBoss(hp: number, max: number): void;
  slowmo(t: number): void;
  squash(x: number, y: number): void;
  onDefeated(): void;
  focus(on: boolean): void;
}

export class BossController {
  logic!: BossLogic;
  img!: Phaser.GameObjects.Image;
  done = true;
  gateClosed = false;
  private gateFx?: Phaser.GameObjects.Image;
  private noseGlow?: Phaser.GameObjects.Image;
  private acornImgs: { a: Phaser.GameObjects.Image; sh: Phaser.GameObjects.Image }[] = [];
  private waveImgs: Phaser.GameObjects.Image[] = [];
  private warn?: Phaser.GameObjects.Image;
  private isTree = false;
  private pattern?: PatternBoss;
  private beamImgs: Phaser.GameObjects.Image[] = [];
  private shotImgs: Phaser.GameObjects.Image[] = [];
  private shadow?: Phaser.GameObjects.Image;

  constructor(private h: BossHost) {}

  private k(key: string) {
    return themed(this.h.scene, key, this.h.L.theme);
  }

  build(): void {
    const def = this.h.L.boss;
    this.done = !def;
    if (!def) return;
    const s = this.h.scene;
    this.isTree = def.kind === 'tree';
    if (def.kind === 'pattern') {
      const cfg = BOSS_PATTERNS[def.pattern ?? 'sentinel'];
      this.pattern = new PatternBoss(def.x, def.y, def.minX, def.maxX, def.hp, cfg);
      this.logic = this.pattern;
    } else this.logic = this.isTree ? new TreeBoss(def.x, def.y, def.minX, def.maxX, def.hp) : new ChargerBoss(def.x, def.y, def.minX, def.maxX, def.hp);
    this.img = s.add.image(def.x, def.y, this.k('boss')).setOrigin(0.5, 0.97).setDepth(-12);
    this.img.setData('base', def.displayH ? def.displayH / this.img.height : (this.isTree ? 400 : 270) / this.img.width);
    if (this.isTree) this.noseGlow = s.add.image(def.x, def.y - 200, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setDepth(-11).setVisible(false);
    this.warn = s.add.image(def.x, def.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6040).setDepth(-13).setAlpha(0);
  }

  /** Porte de l'arène = premier mur du niveau. */
  private gate() {
    return this.h.L.walls?.[0];
  }

  fixedStep(dt: number, jumpHeld: boolean): void {
    if (!this.h.L.boss || !this.logic) return;
    const b = this.h.body;
    const g = this.gate();
    if (!this.gateClosed && !this.done && g && b.x > g.x + g.w + 40) this.closeGate();
    const L = this.logic;
    if (L.state === 'defeated') return;
    const engaged = b.centerX > this.h.L.boss.minX;
    L.update(dt, engaged ? b.centerX : L.x + L.dir * 200);
    if (!engaged && L.state === 'intro') L.t = 0;
    this.handle(L.events);
    if (!this.h.playing) return;
    const r = L.rect;
    const stomping = b.vy > 0 && this.h.prevBottom <= r.y + 30;
    if (overlaps(b.rect, r)) {
      if (stomping) {
        const hit = L.stomped();
        b.vy = jumpHeld ? -1000 : -820;
        this.h.squash(0.85, 1.2);
        this.handle(L.events);
        if (!hit) audio.sfx('sfx_bounce', { worldX: L.x, rate: 0.8 });
      } else if (L.dangerous && this.h.invuln <= 0 && this.h.shieldT <= 0) this.h.hurt(L.x < b.centerX ? 1 : -1);
      else if (L.dangerous) b.vx = (b.centerX < L.x ? -1 : 1) * 450;
      if (L.solidBody && !stomping && b.centerX < L.x) {
        b.x = Math.min(b.x, r.x - b.p.width);
        b.vx = Math.min(b.vx, -60);
      }
    }
    for (const a of L.acorns ?? []) {
      if (a.delay > 0) continue;
      if (overlaps(b.rect, { x: a.x - 22, y: a.y - 26, w: 44, h: 46 })) {
        a.landed = true;
        this.h.burst(10, a.x, a.y);
        if (this.h.shieldT > 0) audio.sfx('sfx_bounce', { worldX: a.x, rate: 1.3 });
        else if (this.h.invuln <= 0) this.h.hurt(a.x < b.centerX ? 1 : -1);
      }
    }
    for (const w of L.waves)
      if (b.grounded && Math.abs(w.x - b.centerX) < 30 && this.h.invuln <= 0 && this.h.shieldT <= 0) this.h.hurt(w.dir);
    const P = this.pattern;
    if (P && this.h.invuln <= 0 && this.h.shieldT <= 0) {
      if (P.beamHits(b.centerX)) this.h.hurt(b.centerX < L.x ? -1 : 1);
      for (const s of P.shots)
        if (s.alive && overlaps(b.rect, { x: s.x - 18, y: s.y - 18, w: 36, h: 36 })) {
          s.alive = false;
          this.h.hurt(s.vx > 0 ? 1 : -1);
        }
    }
  }

  /** Les tirs magiques du héros détruisent les projectiles du boss. */
  clearShotsIn(rect: { x: number; y: number; w: number; h: number }): void {
    for (const s of this.pattern?.shots ?? []) if (s.alive && overlaps(rect, { x: s.x - 18, y: s.y - 18, w: 36, h: 36 })) s.alive = false;
  }

  /** Coup magique (étoile, éclat solaire) : ne blesse que si le boss est vulnérable. */
  magicHit(rect: { x: number; y: number; w: number; h: number }): boolean {
    if (!this.logic || this.done || this.logic.state === 'defeated') return false;
    if (!overlaps(rect, this.logic.rect)) return false;
    if (this.logic.vulnerable) {
      this.logic.stomped();
      this.handle(this.logic.events);
    }
    return true;
  }

  private closeGate(): void {
    const g = this.gate()!;
    const s = this.h.scene;
    this.gateClosed = true;
    this.h.solids.push({ ...g, material: 'stone', tag: 'gate' });
    const fx = s.add
      .image(g.x + g.w / 2, this.h.L.boss!.y, 'ray')
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(themeOf(this.h.L.theme).palette(this.h.L.mood).gate)
      .setScale(0.35, 0.75)
      .setAlpha(0)
      .setDepth(-13);
    s.tweens.add({ targets: fx, alpha: 0.55, duration: 400 });
    s.tweens.add({ targets: fx, scaleX: 0.42, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.gateFx = fx;
    this.h.burst(20, g.x, this.h.L.boss!.y - 80);
    this.h.shake(4, 0.25);
    audio.sfx('sfx_gate', { worldX: g.x });
    audio.sfx('sfx_checkpoint', { worldX: g.x, rate: 0.8 });
    audio.playFirst('music', ['music_boss'], 900);
    this.h.focus(true);
  }

  private handle(events: BossEvent[]): void {
    const L = this.logic;
    const name = this.h.L.boss!.name;
    for (const e of events) {
      switch (e) {
        case 'roar':
          this.h.shake(6, 0.6);
          audio.sfx('sfx_boss_roar', { worldX: L.x });
          audio.sfx('sfx_stomp', { worldX: L.x, rate: 0.55, volume: 1 });
          this.h.toast(`${name} se réveille !`);
          this.h.emitBoss(L.hp, L.maxHp);
          break;
        case 'windup':
          audio.sfx('sfx_hurt', { worldX: L.x, rate: 0.6, volume: 0.5 });
          break;
        case 'charge':
          this.h.dustAt(10, L.x, L.y);
          audio.sfx('sfx_whoosh', { worldX: L.x, volume: 0.7 });
          break;
        case 'bonk':
          this.h.shake(9, 0.35);
          this.h.burst(18, L.x + L.dir * 110, L.y - 90);
          audio.sfx('sfx_land', { worldX: L.x, rate: 0.6, volume: 1 });
          break;
        case 'tired':
          audio.sfx('sfx_ui_hover', { worldX: L.x, rate: 0.5, volume: 0.7 });
          break;
        case 'land':
          if (this.isTree) {
            this.h.shake(2, 0.1);
            audio.sfx('sfx_land', { worldX: L.x - 300, rate: 1.4, volume: 0.5 });
          } else {
            this.h.shake(7, 0.3);
            this.h.dustAt(20, L.x, L.y);
            audio.sfx('sfx_land', { worldX: L.x, rate: 0.5, volume: 1 });
          }
          break;
        case 'hit':
          this.h.shake(5, 0.2);
          this.h.slowmo(0.2);
          this.h.burst(24, L.x, L.y - 140);
          audio.sfx('sfx_boss_hit', { worldX: L.x });
          audio.sfx('sfx_stomp', { worldX: L.x, volume: 1 });
          this.h.emitBoss(L.hp, L.maxHp);
          break;
        case 'defeated':
          this.defeated();
          break;
      }
    }
  }

  private defeated(): void {
    const s = this.h.scene;
    this.done = true;
    for (const w of this.h.L.walls ?? []) {
      const i = this.h.solids.findIndex((x) => x.x === w.x && x.w === w.w);
      if (i >= 0) this.h.solids.splice(i, 1);
    }
    if (this.gateFx) s.tweens.add({ targets: this.gateFx, alpha: 0, duration: 800, onComplete: () => this.gateFx?.destroy() });
    this.h.focus(false);
    this.h.onDefeated();
  }

  render(time: number): void {
    const L = this.logic;
    if (!L || !this.img) return;
    const st = L.state;
    const P = this.pattern;
    const stunned = P ? st === 'tired' || st === 'hurt' : this.isTree ? st === 'tired' || st === 'hurt' : st === 'stunned' || st === 'hurt';
    const angry = P ? st !== 'move' && st !== 'intro' && !stunned && st !== 'recover' : this.isTree ? st === 'acorns' || st === 'roots' : st === 'windup' || st === 'charge';
    const key = stunned ? this.k('boss_stunned') : st === 'defeated' ? this.k('boss_happy') : angry ? this.k('boss_charge') : this.k('boss');
    if (this.img.texture.key !== key && this.h.scene.textures.exists(key)) this.img.setTexture(key);
    const base = this.img.getData('base') as number;
    let sx = 1, sy = 1, ox = 0, rot = 0;
    if (P) {
      if (st === 'windup') {
        ox = Math.sin(time * 0.09) * 4;
        sy = 0.95;
        sx = 1.04;
      } else if (st === 'tired') sy = 1 + 0.025 * Math.sin(time * 0.004);
      else sy = 1 + 0.03 * Math.sin(time * 0.006);
      if (st === 'charge') rot = -L.dir * 0.06;
      if (P.cfg.flying && st !== 'tired' && st !== 'hurt') rot += Math.sin(time * 0.004) * 0.05;
    } else if (this.isTree) {
      rot = Math.sin(time * 0.0011) * 0.015;
      if (angry) {
        ox = Math.sin(time * 0.05) * 3;
        rot = Math.sin(time * 0.02) * 0.03;
      }
      if (st === 'tired') sy = 1 + 0.025 * Math.sin(time * 0.004);
    } else {
      if (st === 'walk') sy = 1 + 0.03 * Math.sin(time * 0.012);
      if (st === 'windup') {
        ox = Math.sin(time * 0.09) * 4;
        sy = 0.95;
        sx = 1.04;
      }
      if (st === 'charge') rot = -L.dir * 0.05;
      if (st === 'hop') sy = L.vy < 0 ? 1.08 : 0.96;
    }
    this.img.setAlpha(st === 'hurt' && Math.floor(time / 70) % 2 ? 0.45 : 1);
    this.img.setPosition(L.x + ox, L.y).setRotation(rot);
    this.img.setScale(base * sx * (!this.isTree && L.dir > 0 ? -1 : 1), base * sy);
    if (P) this.renderPattern(P, time);
    // Télégraphe : lueur rouge au sol pendant la préparation de la charge.
    this.warn
      ?.setPosition(L.x + L.dir * 160, L.groundY - 10)
      .setScale(4, 0.6)
      .setAlpha(st === 'windup' ? 0.4 + 0.3 * Math.sin(time * 0.04) : 0);
    if (this.noseGlow) {
      this.noseGlow
        .setVisible(st === 'tired')
        .setPosition(L.x - 40, L.y - 215)
        .setScale(1.4 + 0.3 * Math.sin(time * 0.01))
        .setAlpha(0.8);
    }
    const s = this.h.scene;
    const acorns = L.acorns ?? [];
    while (this.acornImgs.length < acorns.length) {
      const sh = s.add.image(0, 0, 'glow').setTint(0x000000).setDepth(-16);
      const a = s.add.image(0, 0, s.textures.exists('e_acorn') ? 'e_acorn' : 'spark').setDepth(-8);
      if (s.textures.exists('e_acorn')) a.setScale(fitScale(s, 'e_acorn', 46));
      this.acornImgs.push({ a, sh });
    }
    this.acornImgs.forEach((o, i) => {
      const ac = acorns[i];
      o.a.setVisible(!!ac && ac.delay <= 0);
      o.sh.setVisible(!!ac);
      if (!ac) return;
      const hgt = Math.max(0, L.groundY - ac.y);
      o.sh.setPosition(ac.x, L.groundY - 2).setScale(1.9 - hgt / 900, 0.42 - hgt / 4000).setAlpha(Math.min(0.85, 0.45 + 0.4 * (1 - hgt / 720)));
      o.a.setPosition(ac.x, ac.y).setRotation(time * 0.01 + i);
    });
    const waveKey = this.isTree && s.textures.exists('e_fern') ? 'e_fern' : 'puff';
    while (this.waveImgs.length < L.waves.length) {
      const w = s.add.image(0, 0, waveKey).setDepth(-11);
      if (this.isTree) w.setTint(0x8a6a48).setOrigin(0.5, 1);
      else w.setTint(0xd8c08a);
      this.waveImgs.push(w);
    }
    this.waveImgs.forEach((img, i) => {
      const w = L.waves[i];
      img.setVisible(!!w);
      if (!w) return;
      if (this.isTree) {
        const sc = waveKey === 'e_fern' ? fitScale(s, 'e_fern', 110) : 1.4;
        img.setPosition(w.x, L.groundY + 6).setScale(sc, sc * (0.55 + 0.12 * Math.sin(time * 0.03 + i)));
      } else img.setPosition(w.x, L.groundY - 14).setScale(1.6, 0.9 + 0.2 * Math.sin(time * 0.03)).setAlpha(Math.min(1, w.life));
    });
  }

  /** Télégraphes et projectiles du boss à motifs. */
  private renderPattern(P: PatternBoss, time: number): void {
    const s = this.h.scene;
    const tint = themeOf(this.h.L.theme).palette(this.h.L.mood).gate;
    if (!this.shadow) this.shadow = s.add.image(0, 0, 'glow').setTint(0x000000).setDepth(-16);
    // Ombre du boss volant au sol : indique où il va piquer.
    const air = P.groundY - P.y;
    this.shadow.setVisible(!!P.cfg.flying && air > 10).setPosition(P.x, P.groundY - 2).setScale(4 - air / 220, 0.6 - air / 1500).setAlpha(0.35 + (P.state === 'swoop' ? 0.3 : 0));
    while (this.beamImgs.length < P.beams.length)
      this.beamImgs.push(s.add.image(0, 0, 'ray').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(-7));
    this.beamImgs.forEach((img, i) => {
      const b = P.beams[i];
      img.setVisible(!!b && b.t > 0);
      if (!b || b.t <= 0) return;
      const live = b.t >= b.warn;
      img
        .setPosition(b.x + b.w / 2, P.groundY + 10)
        .setTint(live ? 0xffffff : tint)
        .setScale(live ? (b.w / 256) * 1.6 : (b.w / 256) * (0.5 + 0.3 * Math.sin(time * 0.04)), 1.1)
        .setAlpha(live ? 0.95 : 0.25 + 0.25 * (b.t / b.warn));
    });
    while (this.shotImgs.length < P.shots.length) this.shotImgs.push(s.add.image(0, 0, 'spore').setBlendMode(Phaser.BlendModes.ADD).setDepth(-8).setScale(1.3));
    this.shotImgs.forEach((img, i) => {
      const sh = P.shots[i];
      img.setVisible(!!sh);
      if (sh) img.setPosition(sh.x, sh.y).setTint(tint).setRotation(time * 0.01);
    });
  }
}
