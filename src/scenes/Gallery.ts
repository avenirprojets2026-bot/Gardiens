import Phaser from 'phaser';
import { audio } from '../core/audio';
import { saves } from '../core/save';
import { FONT_BODY, FONT_TITLE, VIEW_H, VIEW_W } from '../config';
import { REWARDS } from '../data/rewards';
import { CUTSCENE_ORDER, CUTSCENES } from '../data/story';
import { WORLDS } from '../data/worlds';
import { makeButton, makePanel, title } from '../ui/widgets';
import { centerDesign, fadeTo, resetLeaving, setupCamera } from './common';

// Galerie des trésors : récompenses gagnées, progression par monde, cinématiques à revoir.

export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }

  create(): void {
    resetLeaving(this);
    setupCamera(this);
    const p = saves.profile;
    if (this.textures.exists('bgd_sky.enchanted')) {
      const bg = this.add.image(VIEW_W / 2, VIEW_H / 2, 'bgd_sky.enchanted');
      bg.setScale(Math.max(VIEW_W / bg.width, VIEW_H / bg.height));
    }
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x081428, 0.5);
    const designStart = this.children.list.length;
    title(this, 640, 50, 'Trésors des Gardiens', 50);
    makeButton(this, 80, 50, '◀', () => fadeTo(this, 'WorldMap', {}, 350), { w: 76, h: 56, size: 28 });

    // Récompenses.
    makePanel(this, 400, 400, 720, 560);
    this.add.text(70, 140, 'Récompenses', { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: '800', color: '#7a4a17' });
    const got = REWARDS.filter((r) => r.got(p)).length;
    this.add.text(730, 146, `${got} / ${REWARDS.length}`, { fontFamily: FONT_TITLE, fontSize: '26px', fontStyle: '800', color: '#a0561a' }).setOrigin(1, 0);
    REWARDS.forEach((r, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 120 + col * 170, y = 230 + row * 125;
      const on = r.got(p);
      const disc = this.add.circle(x, y, 40, on ? 0xfff1c2 : 0xd8c8a8).setStrokeStyle(4, on ? 0xe0a030 : 0xb0a080);
      if (this.textures.exists(r.icon)) {
        const ic = this.add.image(x, y, r.icon);
        ic.setScale(58 / Math.max(ic.width, ic.height));
        if (!on) ic.setTint(0x605848).setAlpha(0.5);
        else if (r.tint) ic.setTint(r.tint);
      }
      if (on) {
        const gl = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe1a0).setScale(2.2).setAlpha(0.35);
        this.tweens.add({ targets: gl, alpha: 0.1, duration: 1400, yoyo: true, repeat: -1 });
      }
      this.add.text(x, y + 50, r.name, { fontFamily: FONT_BODY, fontSize: '16px', fontStyle: '600', color: on ? '#3b2a1a' : '#8a7a60', align: 'center', wordWrap: { width: 160 } }).setOrigin(0.5, 0);
      disc.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toast(`${r.name} : ${r.desc}${on ? ' ✓' : ''}`));
    });

    // Progression des mondes.
    makePanel(this, 1000, 270, 460, 300);
    this.add.text(790, 140, 'Mondes', { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: '800', color: '#7a4a17' });
    WORLDS.forEach((w, i) => {
      const y = 190 + i * 22;
      const stars = w.levels.reduce((s, id) => s + (p.levels[id]?.stars.filter(Boolean).length ?? 0), 0);
      const label = w.levels.length ? `★ ${stars}/${w.levels.length * 3}` : 'bientôt';
      this.add.text(800, y, `${w.n}. ${w.short}`, { fontFamily: FONT_BODY, fontSize: '17px', fontStyle: '600', color: '#3b2a1a' }).setOrigin(0, 0.5);
      this.add.text(1200, y, label, { fontFamily: FONT_BODY, fontSize: '17px', fontStyle: '600', color: w.levels.length ? '#a0561a' : '#9a8a70' }).setOrigin(1, 0.5);
    });

    // Cinématiques.
    makePanel(this, 1000, 560, 460, 260);
    this.add.text(790, 448, 'Cinématiques', { fontFamily: FONT_TITLE, fontSize: '28px', fontStyle: '800', color: '#7a4a17' });
    CUTSCENE_ORDER.forEach((id, i) => {
      const seen = p.seenCutscenes.includes(id);
      const x = 900 + (i % 2) * 210, y = 512 + Math.floor(i / 2) * 58;
      const b = makeButton(this, x, y, seen ? CUTSCENES[id].title : '???', () => {
        if (!seen) return this.toast('Avance dans l’aventure pour la découvrir');
        audio.stop('music', 500);
        fadeTo(this, 'Cutscene', { id, then: { scene: 'Gallery' } });
      }, { w: 200, h: 48, size: 15 });
      if (!seen) b.setAlpha(0.55);
    });
    centerDesign(this, designStart);
    audio.play('music', 'music_title', 800);
    this.cameras.main.fadeIn(400, 10, 20, 30);
  }

  private toast(text: string): void {
    const t = this.add
      .text(VIEW_W / 2, 690, text, { fontFamily: FONT_BODY, fontSize: '22px', fontStyle: '600', color: '#3b2a1a', backgroundColor: '#fff6e0', padding: { x: 18, y: 8 } })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 200, yoyo: true, hold: 1800, onComplete: () => t.destroy() });
  }
}
