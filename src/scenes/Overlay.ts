import Phaser from 'phaser';
import { audio } from '../core/audio';
import { saves, type LevelRecord } from '../core/save';
import { FLAGS, FONT_BODY, FONT_TITLE, VIEW_H, VIEW_W } from '../config';
import { LEVELS } from '../data/worlds';
import { makeButton, makePanel, title } from '../ui/widgets';
import { setupCamera } from './common';
import type { LevelScene } from './Level';

// Fenêtres au-dessus du niveau : pause, victoire (étoiles, cristaux, record), défaite encourageante.

export interface VictoryResult {
  crystals: number;
  stars: boolean[];
  chest: boolean;
  secrets: number;
  secretsTotal: number;
  total: number;
  time: number;
  best: LevelRecord;
  levelId: string;
  levelName: string;
  next: string | null;
  outro?: string;
  hero: string;
  smile?: string;
}

const ENCOURAGE = [
  'Pas grave ! Même les gardiens trébuchent.',
  'Presque ! Tu y étais tout près.',
  'Respire, et on recommence ensemble !',
  'Chaque essai te rend plus habile.',
];

export class OverlayScene extends Phaser.Scene {
  constructor() {
    super('Overlay');
  }

  private get level(): LevelScene {
    return this.scene.get('Level') as LevelScene;
  }

  create(d: { mode: 'pause' | 'victory' | 'defeat'; result?: VictoryResult; hero?: string }): void {
    setupCamera(this);
    const cx = VIEW_W / 2;
    const shade = this.add.rectangle(cx, VIEW_H / 2, VIEW_W, VIEW_H, 0x061224, 0).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.55, duration: 250 });
    const root = this.add.container(0, 0);
    if (d.mode === 'pause') this.pause(root);
    else if (d.mode === 'defeat') this.defeat(root, d.hero ?? '');
    else this.victory(root, d.result!);
    root.setScale(0.85).setAlpha(0).setPosition(cx * 0.15, 54);
    this.tweens.add({ targets: root, scale: 1, x: 0, y: 0, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  }

  private leaveTo(scene: string, data?: object): void {
    this.scene.stop();
    this.scene.stop('HUD');
    this.scene.stop('Level');
    audio.stop('ambience');
    this.scene.start(scene, data);
  }

  private restart(levelId: string): void {
    this.scene.stop();
    this.scene.stop('HUD');
    this.level.scene.restart({ levelId });
  }

  private pause(root: Phaser.GameObjects.Container): void {
    const cx = VIEW_W / 2;
    const L = this.level;
    root.add(makePanel(this, cx, 360, 600, 560));
    root.add(this.add.text(cx, 125, 'Pause', { fontFamily: FONT_TITLE, fontSize: '64px', fontStyle: '800', color: '#7a4a17' }).setOrigin(0.5));
    root.add(
      this.add
        .text(cx, 180, `${L.L.id} · ${L.L.name}`, { fontFamily: FONT_BODY, fontSize: '22px', fontStyle: '600', color: '#7a5230' })
        .setOrigin(0.5),
    );
    const resume = () => {
      this.scene.stop();
      this.scene.resume('Level');
      L.resumeFromPause();
    };
    root.add(makeButton(this, cx, 255, 'Reprendre', resume, { w: 400, primary: true }));
    root.add(makeButton(this, cx, 340, 'Recommencer', () => this.restart(L.L.id), { w: 400 }));
    root.add(makeButton(this, cx, 425, 'Réglages', () => {
      this.scene.pause();
      this.scene.launch('Settings', { from: 'Overlay' });
    }, { w: 400, h: 62, size: 26 }));
    root.add(makeButton(this, cx, 505, 'Carte du monde', () => this.leaveTo('WorldMap'), { w: 400, h: 62, size: 26 }));
    const c = L.collected;
    root.add(
      this.add
        .text(cx, 580, `◆ ${c.crystals}   ★ ${c.stars.filter(Boolean).length}/3${L.L.chest ? `   Coffre ${c.chest ? '✓' : '…'}` : ''}`, {
          fontFamily: FONT_TITLE, fontSize: '26px', fontStyle: '800', color: '#a0561a',
        })
        .setOrigin(0.5),
    );
    this.input.keyboard?.once('keydown-ESC', resume);
    this.input.keyboard?.once('keydown-P', resume);
  }

  private defeat(root: Phaser.GameObjects.Container, hero: string): void {
    const cx = VIEW_W / 2;
    root.add(makePanel(this, cx, 360, 640, 420));
    root.add(title(this, cx, 210, `Courage, ${hero} !`, 52, '#ffd36b'));
    const heroKey = saves.profile.hero;
    if (this.textures.exists(`${heroKey}_surprised`)) {
      const img = this.add.image(cx - 230, 470, `${heroKey}_surprised`).setOrigin(0.5, 1);
      img.setScale(200 / img.height);
      root.add(img);
    }
    root.add(
      this.add
        .text(cx + 40, 300, ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)], {
          fontFamily: FONT_BODY, fontSize: '24px', fontStyle: '600', color: '#5a3a1a', wordWrap: { width: 380 }, align: 'center',
        })
        .setOrigin(0.5),
    );
    root.add(makeButton(this, cx + 40, 400, 'Réessayer depuis la lanterne', () => {
      this.scene.stop();
      this.scene.resume('Level');
      this.level.retryFromCheckpoint();
    }, { w: 400, h: 66, size: 22, primary: true }));
    root.add(makeButton(this, cx + 40, 485, 'Carte du monde', () => this.leaveTo('WorldMap'), { w: 300, h: 56, size: 22 }));
    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.stop();
      this.scene.resume('Level');
      this.level.retryFromCheckpoint();
    });
  }

  private victory(root: Phaser.GameObjects.Container, r: VictoryResult): void {
    const cx = VIEW_W / 2;
    root.add(makePanel(this, cx, 360, 720, 580));
    root.add(this.add.text(cx, 125, `Bravo, ${r.hero} !`, { fontFamily: FONT_TITLE, fontSize: '60px', fontStyle: '800', color: '#7a4a17' }).setOrigin(0.5));
    root.add(
      this.add
        .text(cx, 180, r.smile ?? `${r.levelName} : un cristal de lumière rallumé`, { fontFamily: FONT_BODY, fontSize: '24px', color: '#6b4a2a' })
        .setOrigin(0.5),
    );
    r.stars.forEach((got, i) => {
      const s = this.add.image(cx - 120 + i * 120, 275, 'star');
      const sc = 96 / s.width;
      s.setScale(0).setTint(got ? 0xffffff : 0x8a7a68).setAlpha(got ? 1 : 0.5);
      root.add(s);
      this.tweens.add({
        targets: s,
        scale: sc,
        angle: { from: -120, to: 0 },
        delay: 400 + i * 350,
        duration: 500,
        ease: 'Back.easeOut',
        onStart: () => got && audio.sfx('sfx_crystal', { rate: 0.9 + i * 0.15 }),
      });
    });
    const mm = Math.floor(r.time / 60);
    const ss = String(Math.floor(r.time % 60)).padStart(2, '0');
    const record = r.best.bestTime != null && Math.abs(r.best.bestTime - r.time) < 0.01;
    const counter = this.add
      .text(cx, 372, `◆ 0 / ${r.total}`, { fontFamily: FONT_TITLE, fontSize: '34px', fontStyle: '800', color: '#2a6a9a' })
      .setOrigin(0.5);
    root.add(counter);
    this.tweens.addCounter({
      from: 0,
      to: r.crystals,
      duration: 900,
      delay: 1300,
      onUpdate: (tw) => counter.setText(`◆ ${Math.round(tw.getValue() ?? 0)} / ${r.total}`),
    });
    const extras = [`Temps ${mm}:${ss}${record ? ' (record !)' : ''}`];
    if (r.chest) extras.push('Coffre ✓');
    if (r.secretsTotal) extras.push(`Secrets ${r.secrets}/${r.secretsTotal}`);
    root.add(this.add.text(cx, 418, extras.join('   ·   '), { fontFamily: FONT_BODY, fontSize: '24px', fontStyle: '600', color: '#3b2a1a' }).setOrigin(0.5));

    const nextLevel = r.next && LEVELS[r.next] ? r.next : null;
    const goNext = () => {
      if (r.outro && !FLAGS.autotest) this.leaveTo('Cutscene', { id: r.outro, then: nextLevel ? { scene: 'Level', data: { levelId: nextLevel } } : { scene: 'WorldMap' } });
      else if (nextLevel) this.restart(nextLevel);
      else this.leaveTo('WorldMap');
    };
    root.add(makeButton(this, cx, 500, nextLevel ? 'Niveau suivant ▶' : 'Continuer ▶', goNext, { w: 380, primary: true }));
    root.add(makeButton(this, cx - 125, 590, 'Rejouer', () => this.restart(r.levelId), { w: 230, h: 60, size: 26 }));
    root.add(makeButton(this, cx + 125, 590, 'Carte', () => this.leaveTo('WorldMap'), { w: 230, h: 60, size: 26 }));
    this.input.keyboard?.once('keydown-ENTER', goNext);
    (window as unknown as Record<string, unknown>).__victory = r;
  }
}
