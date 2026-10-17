import Phaser from 'phaser';
import { audio, type Bus } from '../core/audio';
import { saves, type Quality } from '../core/save';
import { FONT_BODY, VIEW_H, VIEW_W } from '../config';
import { makeButton, makePanel, title, type Button } from '../ui/widgets';
import { setupCamera } from './common';

// Réglages (accessibles depuis l'accueil et la pause) : volumes, qualité, commandes, confort, profils.

export class SettingsScene extends Phaser.Scene {
  private from = 'Title';

  constructor() {
    super('Settings');
  }

  init(d: { from?: string }): void {
    this.from = d.from ?? 'Title';
  }

  create(): void {
    setupCamera(this);
    const cx = VIEW_W / 2;
    const s = saves.data.settings;
    const shade = this.add.rectangle(cx, VIEW_H / 2, VIEW_W, VIEW_H, 0x061224, 0).setInteractive();
    this.tweens.add({ targets: shade, fillAlpha: 0.6, duration: 200 });
    const root = this.add.container(0, 0);
    root.add(makePanel(this, cx, 360, 900, 650));
    root.add(title(this, cx, 78, 'Réglages', 50, '#ffe9b0'));

    const label = (y: number, text: string) =>
      root.add(this.add.text(cx - 400, y, text, { fontFamily: FONT_BODY, fontSize: '25px', fontStyle: '600', color: '#5a3a1a' }).setOrigin(0, 0.5));

    // Curseurs de volume à 5 crans.
    const slider = (y: number, text: string, bus: Bus) => {
      label(y, text);
      const dots: Phaser.GameObjects.Arc[] = [];
      const draw = () => dots.forEach((d, i) => d.setFillStyle(i < Math.round(audio.volumes[bus] * 5) ? 0xe08a2a : 0xe8d6a8));
      for (let i = 0; i < 5; i++) {
        const d = this.add.circle(cx - 60 + i * 52, y, 18, 0xe8d6a8).setStrokeStyle(3, 0xc98a3c).setInteractive({ useHandCursor: true });
        d.on('pointerdown', () => {
          const v = audio.volumes[bus] === (i + 1) / 5 && i === 0 ? 0 : (i + 1) / 5;
          audio.setVolume(bus, v);
          s[bus] = v;
          saves.save();
          draw();
          audio.sfx('sfx_ui_click');
        });
        dots.push(d);
        root.add(d);
      }
      const mute = this.add.text(cx + 220, y, 'muet', { fontFamily: FONT_BODY, fontSize: '20px', color: '#8a6a4a' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      mute.on('pointerdown', () => {
        audio.setVolume(bus, 0);
        s[bus] = 0;
        saves.save();
        draw();
      });
      root.add(mute);
      draw();
    };
    slider(150, 'Musique', 'music');
    slider(205, 'Effets', 'sfx');
    slider(260, 'Ambiance', 'ambience');

    // Choix multiples.
    const choice = <T extends string>(y: number, text: string, opts: [T, string][], get: () => T, set: (v: T) => void, w = 130) => {
      label(y, text);
      const btns: Button[] = [];
      const refresh = () => btns.forEach((b, i) => b.setSelected(opts[i][0] === get()));
      opts.forEach(([v, l], i) => {
        const b = makeButton(this, cx - 30 + i * (w + 12) + w / 2, y, l, () => {
          set(v);
          saves.save();
          refresh();
        }, { w, h: 46, size: 20 });
        btns.push(b);
        root.add(b);
      });
      refresh();
    };
    choice<Quality>(325, 'Graphismes', [['auto', 'Auto'], ['bas', 'Léger'], ['moyen', 'Moyen'], ['haut', 'Beau']], () => s.quality, (v) => (s.quality = v), 105);
    choice<'auto' | 'on' | 'off'>(385, 'Boutons tactiles', [['auto', 'Auto'], ['on', 'Toujours'], ['off', 'Jamais']], () => s.touchControls, (v) => (s.touchControls = v));
    choice<string>(445, 'Taille des boutons', [['0.85', 'Petits'], ['1', 'Normaux'], ['1.25', 'Grands']], () => String(s.touchScale), (v) => (s.touchScale = Number(v)));
    choice<string>(505, 'Secousses et flashs', [['off', 'Normaux'], ['on', 'Réduits']], () => (s.reducedMotion ? 'on' : 'off'), (v) => (s.reducedMotion = v === 'on'));
    choice<string>(565, 'Profil de joueur', [['0', 'Joueur 1'], ['1', 'Joueur 2'], ['2', 'Joueur 3']], () => String(saves.data.activeProfile), (v) => saves.selectProfile(Number(v)));

    if (!saves.persistent)
      root.add(
        this.add
          .text(cx, 612, 'Sauvegarde indisponible dans ce navigateur (navigation privée ?) : la progression sera perdue en fermant la page.', {
            fontFamily: FONT_BODY, fontSize: '16px', color: '#a04020', wordWrap: { width: 800 }, align: 'center',
          })
          .setOrigin(0.5),
      );
    const fs = makeButton(this, cx - 160, 660, this.scale.isFullscreen ? 'Fenêtre' : 'Plein écran', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    }, { w: 260, h: 56, size: 24 });
    root.add(fs);
    root.add(makeButton(this, cx + 160, 660, 'Fermer', () => this.close(), { w: 260, h: 56, size: 26, primary: true }));
    this.input.keyboard?.once('keydown-ESC', () => this.close());
    root.setAlpha(0.01).setY(12); // jamais 0 : Phaser ignore les appuis sur un objet à opacité nulle
    this.tweens.add({ targets: root, alpha: 1, y: 0, duration: 220, ease: 'Quad.easeOut' });
  }

  private close(): void {
    this.scene.stop();
    if (this.from !== 'Title') this.scene.resume(this.from);
    this.game.events.emit('settings-closed');
  }
}
