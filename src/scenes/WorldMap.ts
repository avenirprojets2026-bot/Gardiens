import Phaser from 'phaser';
import { audio } from '../core/audio';
import { saves } from '../core/save';
import { FONT_BODY, FONT_TITLE, VIEW_H, VIEW_W } from '../config';
import { HEROES } from '../data/heroes';
import { LEVELS, WORLDS, type WorldDef } from '../data/worlds';
import { artReady } from '../core/assets';
import { makeButton, makeGlass, makePanel } from '../ui/widgets';
import { fadeTo, resetLeaving, setupCamera } from './common';

// Carte des dix royaumes : la carte peinte, les chemins lumineux, le héros qui saute d'un
// monde à l'autre, et un panneau pour choisir le niveau.

export class WorldMapScene extends Phaser.Scene {
  private mx = (x: number) => x;
  private my = (y: number) => y;
  private panel?: Phaser.GameObjects.Container;
  private marker?: Phaser.GameObjects.Image;
  private current = 1;

  constructor() {
    super('WorldMap');
  }

  /** Un monde est ouvert quand son premier niveau est débloqué et construit. */
  private worldOpen(w: WorldDef): boolean {
    return this.worldBuilt(w) && saves.isUnlocked(w.levels[0]);
  }

  private worldBuilt(w: WorldDef): boolean {
    return w.levels.length > 0 && artReady(this, w.theme);
  }

  create(): void {
    resetLeaving(this);
    setupCamera(this);
    this.cameras.main.setBackgroundColor('#2a1c10');
    this.panel = undefined;
    const map = this.add.image(VIEW_W / 2, VIEW_H / 2, 'worldmap');
    const sc = Math.max(VIEW_W / map.width, VIEW_H / map.height);
    map.setScale(sc);
    this.mx = (x) => VIEW_W / 2 + (x - 0.5) * map.width * sc;
    this.my = (y) => VIEW_H / 2 + (y - 0.5) * map.height * sc;

    // Lucioles sur la vallée.
    for (let i = 0; i < 26; i++) {
      const g = this.add
        .image(this.mx(0.05 + Math.random() * 0.3), this.my(0.6 + Math.random() * 0.35), 'glow')
        .setTint(0xe8ff9a)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.12 + Math.random() * 0.12);
      this.tweens.add({ targets: g, alpha: { from: 0, to: 0.9 }, x: g.x + Math.random() * 30 - 15, y: g.y - 10, duration: 1200 + Math.random() * 1800, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }

    // Chemins vers les mondes 9 et 10 (absents de l'illustration d'origine).
    const path = this.add.graphics();
    const dash = (a: WorldDef, b: WorldDef) => {
      const x0 = this.mx(a.x), y0 = this.my(a.y), x1 = this.mx(b.x), y1 = this.my(b.y);
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 18);
      const bend = 40;
      for (let i = 1; i < n; i += 2) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend;
        const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend * 0.5;
        path.fillStyle(0x3a2008, 0.6).fillCircle(x + 1, y + 2, 4.5);
        path.fillStyle(0xffd77a, 0.95).fillCircle(x, y, 4);
      }
    };
    dash(WORLDS[7], WORLDS[8]);
    dash(WORLDS[8], WORLDS[9]);

    const p = saves.profile;
    for (const w of WORLDS) {
      const x = this.mx(w.x), y = this.my(w.y);
      const open = this.worldOpen(w);
      const built = this.worldBuilt(w);
      const done = built && w.levels.every((id) => p.levels[id]?.completed);
      const glow = this.add
        .image(x, y, 'glow')
        .setTint(open ? w.color : 0x889aaa)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(open ? 2.6 : 1.5)
        .setAlpha(open ? 0.8 : 0.35);
      if (open) this.tweens.add({ targets: glow, scale: 3.2, alpha: 0.5, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const disc = this.add.circle(x, y, 26, open ? 0xffd36b : 0x3a4252, 0.95).setStrokeStyle(4, done ? 0x9dff8a : open ? 0xfff3c8 : 0x9aa4b4);
      this.add
        .text(x, y, open ? String(w.n) : '🔒', { fontFamily: FONT_TITLE, fontSize: open ? '30px' : '20px', fontStyle: '800', color: open ? '#5a2d0c' : '#dfe6ee' })
        .setOrigin(0.5);
      if (done) this.add.image(x + 22, y - 22, 'star').setScale(26 / 220);
      disc.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.sfx('sfx_ui_click');
        if (open) this.openWorld(w.n);
        else if (!built) this.toast(`${w.name} : en construction… bientôt !`);
        else this.toast(`Termine le monde ${w.n - 1} pour ouvrir ce royaume`);
      });
      const label = this.add
        .text(x, y + 38, w.short, { fontFamily: FONT_BODY, fontSize: '17px', fontStyle: '600', color: '#fff8e6' })
        .setOrigin(0.5, 0)
        .setStroke('#3a2008', 5);
      if (!open) label.setAlpha(0.75);
    }

    const heroKey = p.hero ?? 'soumaya';
    if (this.textures.exists(heroKey)) {
      this.marker = this.add.image(0, 0, heroKey).setOrigin(0.5, 1);
      this.marker.setScale(110 / this.marker.height);
    }

    makeGlass(this, VIEW_W / 2, 43, 500, 62, 0.55);
    this.add.text(VIEW_W / 2, 43, 'Carte des Royaumes', { fontFamily: FONT_TITLE, fontSize: '38px', fontStyle: '800', color: '#ffe9b0' }).setOrigin(0.5);
    const totalStars = WORLDS.filter((w) => this.worldBuilt(w)).reduce((s, w) => s + w.levels.length * 3, 0);
    this.add
      .text(VIEW_W - 30, 43, `★ ${saves.starCount} / ${totalStars}   ◆ ${p.totalCrystals}`, { fontFamily: FONT_TITLE, fontSize: '28px', fontStyle: '800', color: '#fff3c8' })
      .setOrigin(1, 0.5)
      .setStroke('#3a2008', 6);
    makeButton(this, 110, 43, '◀ Héros', () => fadeTo(this, 'HeroSelect', {}, 350), { w: 180, h: 54, size: 24 });
    makeButton(this, 110, 110, 'Trésors', () => fadeTo(this, 'Gallery', {}, 350), { w: 180, h: 50, size: 22 });

    // Monde courant : le plus avancé débloqué.
    const openWorlds = WORLDS.filter((w) => this.worldOpen(w));
    this.current = openWorlds.length ? openWorlds[openWorlds.length - 1].n : 1;
    this.placeMarker(this.current, false);
    this.input.keyboard?.on('keydown-RIGHT', () => this.step(1));
    this.input.keyboard?.on('keydown-LEFT', () => this.step(-1));
    audio.play('music', 'music_title', 800);
    audio.stop('ambience');
    this.cameras.main.fadeIn(500, 10, 20, 30);
    this.time.delayedCall(500, () => this.openWorld(this.current));
  }

  private step(d: number): void {
    const n = this.current + d;
    const w = WORLDS[n - 1];
    if (w && this.worldOpen(w)) this.openWorld(n);
  }

  private placeMarker(n: number, hop: boolean): void {
    if (!this.marker) return;
    const w = WORLDS[n - 1];
    const x = this.mx(w.x) + 6, y = this.my(w.y) - 34;
    this.tweens.killTweensOf(this.marker);
    const bob = () => this.tweens.add({ targets: this.marker, y: y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (!hop) {
      this.marker.setPosition(x, y);
      bob();
      return;
    }
    audio.sfx('sfx_jump', { volume: 0.5 });
    const sx = this.marker.x, sy = this.marker.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        this.marker!.setPosition(sx + (x - sx) * k, sy + (y - sy) * k - Math.sin(k * Math.PI) * 80);
      },
      onComplete: () => {
        audio.sfx('sfx_land', { volume: 0.4 });
        bob();
      },
    });
  }

  private openWorld(n: number): void {
    if (n !== this.current) this.placeMarker(n, true);
    else if (!this.panel) this.placeMarker(n, false);
    this.current = n;
    this.panel?.destroy();
    const w = WORLDS[n - 1];
    const p = saves.profile;
    const cx = VIEW_W / 2;
    const items: Phaser.GameObjects.GameObject[] = [makePanel(this, cx, 572, 1100, 250)];
    items.push(this.add.text(cx - 520, 466, `Monde ${n} · ${w.name}`, { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: '800', color: '#7a4a17' }));
    items.push(this.add.text(cx - 520, 504, `${w.blurb}  Gardien : ${w.guardian}`, { fontFamily: FONT_BODY, fontSize: '17px', color: '#7a5230' }));
    w.levels.forEach((id, i) => {
      const L = LEVELS[id];
      const unlocked = saves.isUnlocked(id);
      const rec = p.levels[id];
      const x = cx - 350 + i * 350;
      const label = `${id}  ${L.name}${L.boss ? '  👑' : ''}`;
      const b = makeButton(this, x, 572, unlocked ? label : `${id}  🔒`, () => {
        if (!unlocked) return this.toast('Termine le niveau précédent pour l’ouvrir');
        audio.sfx('sfx_whoosh');
        audio.stop('music', 600);
        fadeTo(this, 'Level', { levelId: id });
      }, { w: 330, h: 64, size: 19, primary: unlocked && !rec?.completed });
      if (!unlocked) b.setAlpha(0.6);
      items.push(b);
      for (let s = 0; s < 3; s++) {
        const got = !!rec?.stars[s];
        items.push(this.add.image(x - 40 + s * 40, 630, 'star').setScale(30 / 220).setTint(got ? 0xffffff : 0x6a5a48).setAlpha(got ? 1 : 0.5));
      }
      if (rec?.chest) items.push(this.add.image(x + 100, 630, 'chest').setScale(34 / 300));
      if (rec?.bestTime != null)
        items.push(
          this.add
            .text(x - 150, 630, `${Math.floor(rec.bestTime / 60)}:${String(Math.floor(rec.bestTime % 60)).padStart(2, '0')}`, { fontFamily: FONT_BODY, fontSize: '16px', color: '#7a5230' })
            .setOrigin(0, 0.5),
        );
    });
    items.push(this.add.text(cx + 520, 470, `avec ${HEROES[p.hero ?? 'soumaya'].name}`, { fontFamily: FONT_BODY, fontSize: '20px', fontStyle: '600', color: '#7a5230' }).setOrigin(1, 0));
    this.panel = this.add.container(0, 40, items).setAlpha(0);
    this.tweens.add({ targets: this.panel, alpha: 1, y: 0, duration: 380, ease: 'Back.easeOut' });
    this.input.keyboard?.off('keydown-ENTER');
    this.input.keyboard?.on('keydown-ENTER', () => {
      const id = [...w.levels].reverse().find((l) => saves.isUnlocked(l) && !p.levels[l]?.completed) ?? w.levels[0];
      if (saves.isUnlocked(id)) fadeTo(this, 'Level', { levelId: id });
    });
  }

  private toast(text: string): void {
    const t = this.add
      .text(VIEW_W / 2, 120, text, { fontFamily: FONT_BODY, fontSize: '26px', fontStyle: '600', color: '#3b2a1a', backgroundColor: '#fff6e0', padding: { x: 22, y: 10 } })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 200, yoyo: true, hold: 1600, onComplete: () => t.destroy() });
  }
}
