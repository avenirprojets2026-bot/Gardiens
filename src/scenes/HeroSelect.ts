import Phaser from 'phaser';
import { audio } from '../core/audio';
import { saves, type Difficulty, type HeroId } from '../core/save';
import { FONT_BODY, FONT_TITLE, VIEW_H, VIEW_W } from '../config';
import { HERO_ORDER, HEROES } from '../data/heroes';
import { makeButton, makePanel, title, type Button } from '../ui/widgets';
import { centerDesign, DESIGN_OFFSET, fadeTo, resetLeaving, setupCamera } from './common';

// Sélection du héros : grande scène animée (le héros court, saute, lance son pouvoir),
// fiche de présentation, médaillons de choix, niveau de difficulté.

export class HeroSelectScene extends Phaser.Scene {
  private selected: HeroId = 'soumaya';
  private medallions: { id: HeroId; c: Phaser.GameObjects.Container; ring: Phaser.GameObjects.Graphics }[] = [];
  private stage!: Phaser.GameObjects.Sprite;
  private stageGlow!: Phaser.GameObjects.Image;
  private info!: Phaser.GameObjects.Container;
  private demoT = 0;
  private fx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bg: Phaser.GameObjects.TileSprite[] = [];

  constructor() {
    super('HeroSelect');
  }

  create(): void {
    resetLeaving(this);
    setupCamera(this);
    this.medallions = [];
    this.bg = [];
    this.selected = saves.profile.hero ?? 'soumaya';
    for (const [key, y, h, tint] of [
      ['bg_sky', -60, 840, 0xffffff],
      ['bg_hills', 130, 480, 0xffffff],
      ['bg_forest', 300, 520, 0x8fa8a0],
    ] as [string, number, number, number][]) {
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const ts = this.add.tileSprite(0, y, VIEW_W, h, key).setOrigin(0, 0).setTint(tint);
      ts.setTileScale(h / src.height, h / src.height);
      this.bg.push(ts);
    }
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x0b1626, 0.45);
    const designStart = this.children.list.length;
    title(this, 640, 50, 'Choisis ton héros', 52);

    // Scène du héros : estrade lumineuse.
    const sx = 330;
    const floor = this.add.graphics();
    floor.fillStyle(0x000000, 0.3).fillEllipse(sx, 556, 340, 60);
    floor.fillStyle(0xfff1c2, 0.12).fillEllipse(sx, 552, 300, 46);
    this.stageGlow = this.add.image(sx, 380, 'glow').setScale(8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    this.stage = this.add.sprite(sx, 556, 'soumaya_idle').setOrigin(0.5, 0.975);
    this.fx = this.add.particles(0, 0, 'spark', {
      emitting: false,
      lifespan: { min: 400, max: 900 },
      speed: { min: 80, max: 300 },
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      gravityY: 200,
    });

    this.info = this.add.container(0, 0);

    // Médaillons.
    HERO_ORDER.forEach((id, i) => this.buildMedallion(id, 160 + i * 170, 612));

    // Difficulté.
    const diffs: [Difficulty, string, string][] = [
      ['facile', 'Facile', '5 cœurs, sauts assistés'],
      ['normal', 'Normal', 'L’aventure classique'],
      ['expert', 'Expert', 'Moins d’aide, pas de pont'],
    ];
    let diff = saves.profile.difficulty;
    const diffHelp = this.add.text(930, 548, '', { fontFamily: FONT_BODY, fontSize: '18px', color: '#e8f6ff' }).setOrigin(0.5);
    const btns: Button[] = diffs.map(([id, l], i) =>
      makeButton(this, 760 + i * 170, 590, l, () => {
        diff = id;
        refresh();
      }, { w: 150, h: 48, size: 22 }),
    );
    const refresh = () => {
      diffs.forEach(([id], i) => btns[i].setSelected(id === diff));
      diffHelp.setText(diffs.find((d) => d[0] === diff)![2]);
    };
    refresh();

    const go = makeButton(this, 930, 664, 'C’est parti ! ▶', () => {
      saves.profile.hero = this.selected;
      saves.profile.difficulty = diff;
      saves.save();
      audio.sfx('sfx_whoosh');
      fadeTo(this, 'WorldMap');
    }, { w: 340, h: 66, size: 32, primary: true });
    this.tweens.add({ targets: go, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    makeButton(this, 80, 50, '◀', () => fadeTo(this, 'Title', {}, 350), { w: 76, h: 56, size: 28 });

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.pick(HERO_ORDER[(HERO_ORDER.indexOf(this.selected) + 2) % 3]));
    kb.on('keydown-RIGHT', () => this.pick(HERO_ORDER[(HERO_ORDER.indexOf(this.selected) + 1) % 3]));
    kb.on('keydown-ENTER', () => go.emit('pointerdown'));
    centerDesign(this, designStart);
    this.pick(this.selected, true);
    audio.play('music', 'music_title', 800);
    this.cameras.main.fadeIn(500, 10, 20, 30);
  }

  private buildMedallion(id: HeroId, x: number, y: number): void {
    const h = HEROES[id];
    const ring = this.add.graphics();
    const draw = (on: boolean) => {
      ring.clear();
      ring.fillStyle(0x000000, 0.35).fillCircle(3, 6, 66);
      ring.fillGradientStyle(0xfff4dc, 0xfff4dc, 0xf0d29a, 0xf0d29a, 1).fillCircle(0, 0, 66);
      ring.lineStyle(on ? 7 : 4, on ? h.color : 0xc98a3c, 1).strokeCircle(0, 0, 66);
    };
    draw(false);
    const face = this.add.image(0, 0, this.portrait(id)).setDisplaySize(120, 120);
    const name = this.add
      .text(0, 82, h.name, { fontFamily: FONT_TITLE, fontSize: '24px', fontStyle: '800', color: '#fff3c8' })
      .setOrigin(0.5)
      .setStroke('#5a2d0c', 5);
    const c = this.add.container(x, y, [ring, face, name]).setSize(140, 140).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.pick(id));
    c.on('pointerover', () => audio.sfx('sfx_ui_hover', { volume: 0.4 }));
    (ring as Phaser.GameObjects.Graphics & { redraw?: (on: boolean) => void }).redraw = draw;
    this.medallions.push({ id, c, ring });
  }

  /** Portrait rond (tête du héros) dessiné une fois dans une texture : pas de masque à aligner. */
  private portrait(id: HeroId): string {
    const key = `portrait_${id}`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(id).getSourceImage() as HTMLImageElement;
    const c = this.textures.createCanvas(key, 160, 160)!;
    const g = c.getContext();
    g.save();
    g.beginPath();
    g.arc(80, 80, 78, 0, Math.PI * 2);
    g.clip();
    const grd = g.createLinearGradient(0, 0, 0, 160);
    grd.addColorStop(0, '#fff4dc');
    grd.addColorStop(1, '#f0d29a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 160, 160);
    // La tête occupe le haut de l'illustration en pied : on cadre un carré centré dessus.
    const side = src.width * 0.78;
    g.drawImage(src, (src.width - side) / 2, src.height * 0.005, side, side, 0, 0, 160, 160);
    g.restore();
    c.refresh();
    return key;
  }

  private pick(id: HeroId, silent = false): void {
    this.selected = id;
    const h = HEROES[id];
    if (!silent) audio.sfx('sfx_crystal', { volume: 0.5, rate: 1 + HERO_ORDER.indexOf(id) * 0.12 });
    for (const m of this.medallions) {
      const on = m.id === id;
      (m.ring as Phaser.GameObjects.Graphics & { redraw?: (on: boolean) => void }).redraw?.(on);
      this.tweens.add({ targets: m.c, alpha: on ? 1 : 0.7, duration: 220 });
    }
    this.stageGlow.setTint(h.color);
    this.demoT = 0;
    this.stage.setAlpha(0);
    this.tweens.add({ targets: this.stage, alpha: 1, duration: 260 });

    // Fiche du héros.
    this.info.removeAll(true);
    const px = 930; // le conteneur est déjà décalé par centerDesign
    this.info.add(makePanel(this, px, 300, 560, 400));
    this.info.add(
      this.add.text(px, 140, h.name, { fontFamily: FONT_TITLE, fontSize: '54px', fontStyle: '800', color: '#4a2a10' }).setOrigin(0.5),
    );
    this.info.add(
      this.add
        .text(px, 192, `${h.title} · ${h.age} ans`, { fontFamily: FONT_BODY, fontSize: '22px', fontStyle: '600', color: h.colorCss })
        .setOrigin(0.5)
        .setStroke('#4a2a10', 4),
    );
    this.info.add(
      this.add
        .text(px, 236, h.tagline, { fontFamily: FONT_BODY, fontSize: '19px', fontStyle: '400', color: '#6b4a2a', wordWrap: { width: 480 }, align: 'center' })
        .setOrigin(0.5),
    );
    h.traits.forEach((t, i) => {
      const y = 296 + i * 52;
      const dot = this.add.image(px - 230, y, 'star').setScale(30 / 220);
      const txt = this.add.text(px - 205, y, t, { fontFamily: FONT_BODY, fontSize: '21px', fontStyle: '600', color: '#3b2a1a', wordWrap: { width: 430 } }).setOrigin(0, 0.5);
      this.info.add([dot, txt]);
    });
    this.info.add(
      this.add
        .text(px, 466, `Pouvoir (X) : ${h.powerName}`, { fontFamily: FONT_TITLE, fontSize: '24px', fontStyle: '800', color: '#a0561a' })
        .setOrigin(0.5),
    );
    this.info.setAlpha(0).x = DESIGN_OFFSET + 30;
    this.tweens.add({ targets: this.info, alpha: 1, x: DESIGN_OFFSET, duration: 280, ease: 'Cubic.easeOut' });
  }

  /** Démonstration en boucle : repos → course → saut → pouvoir. */
  override update(time: number, dms: number): void {
    const dt = dms / 1000;
    this.bg.forEach((b, i) => (b.tilePositionX += ((4 + i * 10) * dt) / b.tileScaleX));
    const id = this.selected;
    const h = HEROES[id];
    const m = this.registry.get('manifest');
    const base = (key: string) => (m.sheets[key]?.contentH ?? 300) as number;
    const scale = 380 / base(`${id}_idle`);
    this.demoT += dt;
    const t = this.demoT % 6;
    const setTex = (key: string, frame = 0) => {
      if (!this.textures.exists(key)) return;
      if (this.stage.texture.key !== key) {
        this.stage.anims.stop();
        this.stage.setTexture(key, frame);
        const s = m.sheets[key];
        this.stage.setOrigin(s?.originX ?? 0.5, s?.originY ?? 0.975);
      } else if (this.stage.frame.name !== String(frame)) this.stage.setFrame(frame);
    };
    let y = 556;
    if (t < 1.6) {
      setTex(`${id}_idle`);
      this.stage.setScale(scale, scale * (1 + Math.sin(time * 0.004) * 0.012));
    } else if (t < 3.4) {
      const key = `${id}_run`;
      if (this.stage.anims.currentAnim?.key !== key) {
        const s = m.sheets[key];
        this.stage.setOrigin(s?.originX ?? 0.5, s?.originY ?? 0.975);
        this.stage.play(key);
      }
      this.stage.setScale(scale);
    } else if (t < 4.4) {
      const k = (t - 3.4) / 1;
      y = 556 - Math.sin(k * Math.PI) * 120;
      setTex(`${id}_jump`, k < 0.25 ? 1 : k < 0.5 ? 2 : k < 0.75 ? 3 : 4);
      this.stage.setScale(scale);
    } else if (t < 5.4) {
      setTex(`${id}_cast`);
      this.stage.setScale(scale);
      if (Math.random() < 0.5) {
        this.fx.setParticleTint(h.color);
        this.fx.explode(2, this.stage.x + 70, 380);
      }
    } else {
      setTex(`${id}_victory`);
      this.stage.setScale(scale);
    }
    this.stage.y = y;
    this.stageGlow.setAlpha(0.3 + 0.08 * Math.sin(time * 0.003));
  }
}
