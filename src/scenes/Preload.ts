import Phaser from 'phaser';
import { createAnims, loadArt, type ArtManifest } from '../core/assets';
import { loadAudio } from '../core/audio';
import { perf } from '../core/perf';
import { saves, type HeroId } from '../core/save';
import { FLAGS, FONT_BODY, FONT_TITLE, VIEW_W } from '../config';
import { HERO_ORDER } from '../data/heroes';
import { setupCamera } from './common';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    perf.startLoad('assets');
    setupCamera(this);
    this.cameras.main.setBackgroundColor('#0e1d2e');
    const cx = VIEW_W / 2;
    this.add.image(cx, 310, 'glow').setScale(5).setTint(0x7fd8ff).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .text(cx, 230, 'Les Gardiens des Mondes Magiques', { fontFamily: FONT_TITLE, fontSize: '44px', color: '#ffe9b0', fontStyle: '800' })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 10, true, true);
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.35).fillRoundedRect(cx - 260, 400, 520, 26, 13);
    frame.lineStyle(2, 0xffe1a0, 0.7).strokeRoundedRect(cx - 260, 400, 520, 26, 13);
    const bar = this.add.graphics();
    const label = this.add.text(cx, 450, 'Chargement des royaumes…', { fontFamily: FONT_BODY, fontSize: '22px', color: '#cfe8ff' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillGradientStyle(0x8fe3ff, 0xffe39a, 0x5fb8ff, 0xffc66b, 1).fillRoundedRect(cx - 256, 404, Math.max(18, 512 * p), 18, 9);
      label.setText(`Chargement des royaumes… ${Math.round(p * 100)} %`);
    });
    this.load.on('loaderror', (f: { key: string }) => console.warn('Ressource manquante :', f.key));
    loadArt(this, this.registry.get('manifest') as ArtManifest);
    loadAudio(this, this.registry.get('audioTracks') as Set<string>);
  }

  create(): void {
    createAnims(this, this.registry.get('manifest') as ArtManifest);
    perf.endLoad('assets');
    perf.endLoad('total');
    if (FLAGS.hero && HERO_ORDER.includes(FLAGS.hero as HeroId)) saves.profile.hero = FLAGS.hero as HeroId;
    if (FLAGS.autotest) this.scene.start('Level', { levelId: FLAGS.level });
    else if (FLAGS.scene) this.scene.start(FLAGS.scene, { id: FLAGS.level, levelId: FLAGS.level });
    else this.scene.start('Title');
  }
}
