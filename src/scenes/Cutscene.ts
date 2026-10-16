import Phaser from 'phaser';
import { audio } from '../core/audio';
import { detailed, themed } from '../core/assets';
import { saves, type HeroId } from '../core/save';
import { FONT_BODY, FONT_TITLE, VIEW_H, VIEW_W } from '../config';
import { HEROES } from '../data/heroes';
import { CUTSCENES, SPEAKERS, type Shot } from '../data/story';
import { makeButton } from '../ui/widgets';
import { setupCamera } from './common';

// Cinématique en moteur : décor peint en parallaxe lente, acteurs qui entrent en scène,
// boîte de dialogue au texte qui s'écrit, avance au toucher/Espace, « Passer » toujours visible.

export interface CutsceneData {
  id: string;
  then?: { scene: string; data?: object };
}

export class CutsceneScene extends Phaser.Scene {
  private data_!: CutsceneData;
  private shotIndex = 0;
  private lineIndex = 0;
  private shotLayer!: Phaser.GameObjects.Container;
  private layers: { ts: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private textObj!: Phaser.GameObjects.Text;
  private nameObj!: Phaser.GameObjects.Text;
  private box!: Phaser.GameObjects.Container;
  private full = '';
  private shown = 0;
  private typing = false;
  private lumi?: Phaser.GameObjects.Image;
  private pan = 0;
  private ending = false;
  private actors: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor() {
    super('Cutscene');
  }

  init(d: CutsceneData): void {
    this.data_ = d;
    this.shotIndex = 0;
    this.lineIndex = 0;
    this.ending = false;
  }

  create(): void {
    setupCamera(this);
    const cs = CUTSCENES[this.data_.id];
    if (!cs) return this.finish();
    saves.markCutscene(cs.id);
    this.cameras.main.setBackgroundColor('#081220');
    this.shotLayer = this.add.container(0, 0);

    // Bandes cinéma.
    this.add.rectangle(VIEW_W / 2, 0, VIEW_W, 90, 0x000000).setOrigin(0.5, 0).setDepth(50);
    this.add.rectangle(VIEW_W / 2, VIEW_H, VIEW_W, 40, 0x000000).setOrigin(0.5, 1).setDepth(50);
    this.add
      .text(40, 45, cs.title, { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: '800', color: '#ffe9b0' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    makeButton(this, VIEW_W - 120, 45, 'Passer ▶▶', () => this.finish(), { w: 190, h: 52, size: 22 }).setDepth(52);

    // Boîte de dialogue.
    const g = this.add.graphics();
    g.fillStyle(0x0b1a2a, 0.82).fillRoundedRect(-560, -78, 1120, 156, 28);
    g.lineStyle(3, 0xffe1a0, 0.6).strokeRoundedRect(-560, -78, 1120, 156, 28);
    this.nameObj = this.add.text(-520, -58, '', { fontFamily: FONT_TITLE, fontSize: '26px', fontStyle: '800', color: '#ffd36b' });
    this.textObj = this.add.text(-520, -20, '', {
      fontFamily: FONT_BODY,
      fontSize: '27px',
      fontStyle: '600',
      color: '#fff8e6',
      wordWrap: { width: 1040 },
      lineSpacing: 6,
    });
    const hint = this.add.text(530, 56, '▼', { fontFamily: FONT_BODY, fontSize: '22px', color: '#ffe1a0' }).setOrigin(1, 1);
    this.tweens.add({ targets: hint, y: 62, duration: 500, yoyo: true, repeat: -1 });
    this.box = this.add.container(VIEW_W / 2, VIEW_H - 120, [g, this.nameObj, this.textObj, hint]).setDepth(40);

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length) this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());

    if (cs.music) audio.playFirst('music', [cs.music, 'music_title'], 1200);
    this.cameras.main.fadeIn(700, 8, 18, 32);
    this.showShot();
  }

  private heroKey(): HeroId {
    return saves.profile.hero ?? 'soumaya';
  }

  private showShot(): void {
    const cs = CUTSCENES[this.data_.id];
    const shot = cs.shots[this.shotIndex];
    this.shotLayer.removeAll(true);
    this.layers = [];
    this.actors.clear();
    this.pan = shot.pan ?? 0;
    this.buildBackdrop(shot);
    for (const a of shot.actors) {
      const key = a.key === 'hero' ? this.heroKey() : a.key;
      if (!this.textures.exists(key)) continue;
      const x = VIEW_W * a.x;
      const h = a.h ?? 460;
      if (a.glow != null || a.key === 'hero') {
        const col = a.glow ?? HEROES[this.heroKey()].color;
        const gl = this.add.image(x, 640 - h * 0.45, 'glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(h / 60);
        this.shotLayer.add(gl);
      }
      const img = this.add.image(x, 650, key).setOrigin(0.5, 1).setFlipX(!!a.flip);
      img.setScale(h / img.height);
      const finalX = x;
      if (a.enter === 'left') img.x -= 420;
      if (a.enter === 'right') img.x += 420;
      if (a.enter === 'drop') img.y -= 500;
      img.setAlpha(0);
      this.tweens.add({ targets: img, x: finalX, y: 650, alpha: 1, duration: 900, ease: 'Cubic.easeOut', delay: 150 });
      this.tweens.add({ targets: img, scaleY: img.scaleY * 1.012, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1100 });
      this.shotLayer.add(img);
      this.actors.set(a.key === 'hero' ? 'hero' : key.split('.')[0].split('_')[0], img);
    }
    if (shot.lumi) {
      this.lumi = this.add.image(VIEW_W * 0.5, 260, 'glow').setTint(0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2);
      const core = this.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
      this.shotLayer.add([this.lumi, core]);
      this.lumi.setData('core', core);
    } else this.lumi = undefined;
    this.lineIndex = 0;
    this.showLine();
  }

  private buildBackdrop(shot: Shot): void {
    if (shot.image && this.textures.exists(shot.image)) {
      const img = this.add.image(VIEW_W / 2, VIEW_H / 2, shot.image);
      const sc = Math.max(VIEW_W / img.width, VIEW_H / img.height) * 1.08;
      img.setScale(sc);
      this.tweens.add({ targets: img, scale: sc * 1.06, duration: 9000, ease: 'Sine.easeInOut' });
      this.shotLayer.add(img);
    } else {
      const theme = shot.theme;
      const tint = shot.mood === 'dusk' ? [0xffb6c6, 0xa99ac8, 0x8f8fb8] : shot.mood === 'night' ? [0x8090c0, 0x7080b0, 0x607090] : [0xffffff, 0xffffff, 0xd0e0d0];
      const layer = (key: string, speed: number, y: number, h: number, t: number) => {
        if (!this.textures.exists(key)) return;
        const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const ts = this.add.tileSprite(0, y, VIEW_W, h, key).setOrigin(0, 0).setTint(t);
        ts.setTileScale(h / src.height, h / src.height);
        ts.tilePositionX = Math.random() * 1000;
        this.layers.push({ ts, speed });
        this.shotLayer.add(ts);
      };
      layer(detailed(this, 'bg_sky', theme), 3, -60, 860, tint[0]);
      layer(detailed(this, 'bg_hills', theme), 8, 130, 480, tint[1]);
      layer('fog', 12, 380, 180, 0xffffff);
      layer(this.textures.exists(themed(this, 'bgd_forest', theme)) ? themed(this, 'bgd_forest', theme) : themed(this, 'bg_forest', theme), 18, 220, 560, tint[2]);
      const ground = themed(this, 'ground_mid', theme);
      if (this.textures.exists(ground)) {
        const src = this.textures.get(ground).getSourceImage() as HTMLImageElement;
        const ts = this.add.tileSprite(0, 610, VIEW_W, 300, ground).setOrigin(0, 0);
        ts.setTileScale(300 / src.height, 300 / src.height);
        this.layers.push({ ts, speed: 30 });
        this.shotLayer.add(ts);
      }
    }
    const vig = this.add.image(VIEW_W / 2, VIEW_H / 2, 'vignette').setDisplaySize(VIEW_W, VIEW_H).setAlpha(0.8);
    this.shotLayer.add(vig);
    this.addFx(shot.fx);
  }

  private addFx(fx: Shot['fx']): void {
    if (!fx) return;
    if (fx === 'shatter') {
      // Le Grand Cristal éclate : éclats qui s'envolent vers les mondes.
      const c = this.add.image(VIEW_W / 2, 300, 'crystal').setScale(0.9);
      const gl = this.add.image(VIEW_W / 2, 300, 'glow').setScale(9).setTint(0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.shotLayer.add([gl, c]);
      this.time.delayedCall(900, () => {
        this.cameras.main.shake(400, 0.008);
        audio.sfx('sfx_hurt', { rate: 0.5 });
        c.setVisible(false);
        this.tweens.add({ targets: gl, alpha: 0, scale: 14, duration: 900 });
        for (let i = 0; i < 18; i++) {
          const s = this.add.image(VIEW_W / 2, 300, 'crystal').setScale(0.12 + Math.random() * 0.12).setRotation(Math.random() * 6);
          this.shotLayer.add(s);
          const a = Math.random() * Math.PI * 2;
          this.tweens.add({ targets: s, x: VIEW_W / 2 + Math.cos(a) * (300 + Math.random() * 400), y: 300 + Math.sin(a) * 260, angle: 360, alpha: 0.2, duration: 1600, ease: 'Cubic.easeOut' });
        }
        const veil = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x40485a, 0);
        this.shotLayer.add(veil);
        this.tweens.add({ targets: veil, fillAlpha: 0.45, duration: 1800 });
      });
    } else {
      const tint = fx === 'gloom' ? [0x6a5a8a] : fx === 'crystals' ? [0x9fe8ff, 0xc2a8ff] : [0xfff1a0, 0xffd36b, 0xffffff];
      const p = this.add.particles(0, 0, fx === 'crystals' ? 'spark' : 'glow', {
        x: { min: 0, max: VIEW_W },
        y: { min: 120, max: 620 },
        lifespan: 3000,
        speedY: { min: -30, max: -8 },
        scale: { start: 0.3, end: 0 },
        alpha: { values: [0, 0.9, 0] },
        tint,
        blendMode: 'ADD',
        frequency: 70,
      });
      this.shotLayer.add(p);
      if (fx === 'dawn') {
        const sun = this.add.image(VIEW_W * 0.7, 160, 'glow').setScale(14).setTint(0xffe1a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.shotLayer.add(sun);
        this.tweens.add({ targets: sun, alpha: 0.5, duration: 2500 });
      }
    }
  }

  private showLine(): void {
    const cs = CUTSCENES[this.data_.id];
    const line = cs.shots[this.shotIndex].lines[this.lineIndex];
    const who = line.who === 'hero' ? this.heroKey() : line.who;
    const sp = SPEAKERS[who] ?? SPEAKERS.narrator;
    this.nameObj.setText(sp.name).setColor(sp.color);
    this.textObj.setY(sp.name ? -20 : -40);
    this.textObj.setFontStyle(who === 'narrator' ? 'italic' : '600');
    this.full = line.text;
    this.shown = 0;
    this.typing = true;
    this.textObj.setText('');
    // Le personnage qui parle s'avance légèrement, les autres s'estompent.
    const speaker = line.who === 'hero' ? 'hero' : who;
    for (const [k, img] of this.actors) {
      const on = k === speaker || (line.who === 'boss' && k === 'boss') || (k === 'hero' && who === this.heroKey());
      this.tweens.add({ targets: img, alpha: on || this.actors.size === 1 ? 1 : 0.7, duration: 250 });
    }
    this.box.setScale(0.98);
    this.tweens.add({ targets: this.box, scale: 1, duration: 160 });
  }

  private advance(): void {
    if (this.ending) return;
    if (this.typing) {
      this.shown = this.full.length;
      this.textObj.setText(this.full);
      this.typing = false;
      return;
    }
    audio.sfx('sfx_ui_click', { volume: 0.5 });
    const cs = CUTSCENES[this.data_.id];
    const shot = cs.shots[this.shotIndex];
    if (this.lineIndex < shot.lines.length - 1) {
      this.lineIndex++;
      this.showLine();
    } else if (this.shotIndex < cs.shots.length - 1) {
      this.shotIndex++;
      this.cameras.main.fadeOut(350, 8, 18, 32);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.showShot();
        this.cameras.main.fadeIn(450, 8, 18, 32);
      });
    } else this.finish();
  }

  private finish(): void {
    if (this.ending) return;
    this.ending = true;
    const then = this.data_.then ?? { scene: 'WorldMap' };
    this.cameras.main.fadeOut(500, 8, 18, 32);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(then.scene, then.data));
  }

  override update(time: number, dms: number): void {
    const dt = dms / 1000;
    for (const l of this.layers) l.ts.tilePositionX += (l.speed * this.pan * dt) / l.ts.tileScaleX;
    if (this.typing) {
      this.shown += dt * 42;
      const n = Math.min(this.full.length, Math.floor(this.shown));
      if (n !== this.textObj.text.length) {
        this.textObj.setText(this.full.slice(0, n));
        if (n % 3 === 0) audio.sfx('sfx_text', { volume: 0.25, pitchVar: 0.15 });
      }
      if (n >= this.full.length) this.typing = false;
    }
    if (this.lumi) {
      const x = VIEW_W * 0.5 + Math.sin(time * 0.0011) * 180;
      const y = 250 + Math.sin(time * 0.0023) * 40;
      this.lumi.setPosition(x, y).setScale(1.1 + 0.15 * Math.sin(time * 0.01));
      (this.lumi.getData('core') as Phaser.GameObjects.Image).setPosition(x, y).setRotation(time * 0.002);
    }
  }
}
