import Phaser from 'phaser';
import { audio } from '../core/audio';
import { artReady, themed, type ArtManifest } from '../core/assets';
import { perf } from '../core/perf';
import { AdaptiveQuality, QUALITY, type QualityLevel } from '../core/quality';
import { saves, type Difficulty } from '../core/save';
import { FLAGS, VIEW_H, VIEW_W } from '../config';
import { HEROES, POWER_HINT, type HeroDef } from '../data/heroes';
import type { LevelDef, SwitchDef, TalkDef } from '../data/types';
import { LEVELS, nextPlayable } from '../data/worlds';
import { propKey, themeOf } from '../data/themes';
import { CameraRig, type CameraTarget } from '../game/camera';
import { InputHub, type InputFrame } from '../game/input';
import { BossController, type BossHost } from '../bosses/controller';
import { Enemies, type EnemyEntity } from '../enemies/view';
import { harmful } from '../enemies/logic';
import { Backdrop, paletteFor, type Palette } from '../level/backdrop';
import { LevelFx } from '../level/fx';
import { Darkness, type Light } from '../level/darkness';
import { HeroView } from '../level/heroView';
import { buildSolids } from '../level/solids';
import { Terrain } from '../level/terrain';
import { assisted, PlatformerBody, STEP, type BodyInput } from '../physics/body';
import { contains, overlaps, type Solid } from '../physics/geom';
import { blinkState, updateMovers } from '../physics/movers';
import { bubble, fitScale } from '../ui/widgets';
import { RES, START_QUALITY } from './common';

// Scène de jeu : simulation à pas fixe (1/120 s) découplée du rendu interpolé.

type Phase = 'play' | 'paused' | 'dying' | 'victory';

interface Pickup {
  img: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  taken: boolean;
  phase: number;
  i?: number;
}

interface Projectile {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  life: number;
  pierce: boolean;
  hit: Set<EnemyEntity>;
}

interface Swayer {
  obj: Phaser.GameObjects.Image;
  x: number;
  amp: number;
  v: number;
  a: number;
  phase: number;
}

/** Décors lumineux quel que soit le monde. */
const GLOW_PROPS: Record<string, number> = { e_mushrooms: 0x7fd8ff, e_crystal: 0x7fd8ff, e_bells: 0xc6a5ff };

const SWAYING = new Set([
  'bush1', 'bush2', 'bush3', 'fern', 'grass', 'flowers1', 'flowers2', 'mushrooms', 'c_jellybush', 'c_cottonbush', 'c_licorice',
  'c_lollipop', 'c_cane', 'e_fern', 'e_grass', 'e_bells', 'e_crystal', 'e_berry', 'e_mushrooms',
]);

export class LevelScene extends Phaser.Scene {
  L!: LevelDef;
  m!: ArtManifest;
  hero!: HeroDef;
  params!: PlatformerBody['p'];
  body!: PlatformerBody;
  solids: Solid[] = [];
  inp!: InputHub;
  rig!: CameraRig;
  pal!: Palette;
  backdrop!: Backdrop;
  terrain!: Terrain;
  fx!: LevelFx;
  heroView!: HeroView;
  enemies!: Enemies;
  boss!: BossController;
  difficulty: Difficulty = 'normal';
  phase: Phase = 'play';
  hearts = 3;
  maxHearts = 3;
  invuln = 0;
  shieldT = 0;
  quality: QualityLevel = START_QUALITY;
  timeInLevel = 0;
  collected = { crystals: 0, stars: [false, false, false], chest: false, secrets: 0 };
  totalCrystals = 0;
  powerCooldown = 0;
  /** Charge de la Nova de Soumaya (0-1). */
  charge = 0;
  private chargeHeld = 0;
  private acc = 0;
  private levelTime = 0;
  private prevX = 0;
  private prevY = 0;
  private slow = 0;
  private stepTimer = 0;
  private flowerUsed = false;
  private crystals: Pickup[] = [];
  private stars: Pickup[] = [];
  private heartsItems: Pickup[] = [];
  private chest: { img: Phaser.GameObjects.Image; x: number; y: number; open: boolean } | null = null;
  private springs: { img: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  private checkpoints: { x: number; y: number; lit: boolean; flame: Phaser.GameObjects.Image; post: Phaser.GameObjects.Image }[] = [];
  private checkpoint = { x: 0, y: 0 };
  private lastSafe = { x: 0, y: 0 };
  private hints: { c: Phaser.GameObjects.Container; x: number; y: number }[] = [];
  private swayers: Swayer[] = [];
  private projectiles: Projectile[] = [];
  private flowers: { s: Solid; img: Phaser.GameObjects.Image; life: number }[] = [];
  private rings: { img: Phaser.GameObjects.Image; t: number; x: number; y: number }[] = [];
  private switches: { def: SwitchDef; img: Phaser.GameObjects.Image; gem: Phaser.GameObjects.Image; on: boolean }[] = [];
  private barriers: { id: string; img: Phaser.GameObjects.Image; solid: Solid }[] = [];
  private secrets: { rect: Phaser.Geom.Rectangle; cover: Phaser.GameObjects.Image[]; found: boolean }[] = [];
  private updrafts: { x: number; y: number; w: number; h: number; power: number }[] = [];
  private talks: (TalkDef & { done: boolean })[] = [];
  private goalGlow!: Phaser.GameObjects.Image;
  private goalCrystal!: Phaser.GameObjects.Image;
  private adaptive!: AdaptiveQuality;
  private debugGfx?: Phaser.GameObjects.Graphics;
  private camFocus = false;
  private darkness?: Darkness;

  constructor() {
    super('Level');
  }

  init(d: { levelId?: string }): void {
    this.L = LEVELS[d?.levelId ?? ''] ?? LEVELS[this.registry.get('levelId') ?? ''] ?? LEVELS['1-1'];
    this.registry.set('levelId', this.L.id);
  }

  create(): void {
    // Cinématique d'introduction la première fois.
    if (this.L.intro && !FLAGS.autotest && !FLAGS.noCutscenes && !saves.profile.seenCutscenes.includes(this.L.intro)) {
      this.scene.start('Cutscene', { id: this.L.intro, then: { scene: 'Level', data: { levelId: this.L.id } } });
      return;
    }
    perf.startLoad('niveau');
    this.m = this.registry.get('manifest');
    this.resetState();
    const settings = saves.data.settings;
    this.hero = HEROES[saves.profile.hero] ?? HEROES.soumaya;
    this.difficulty = saves.profile.difficulty;
    const p = this.hero.params;
    this.params = this.difficulty === 'facile' || this.hero.forceAssist ? assisted(p) : this.difficulty === 'expert' ? { ...p, coyoteTime: 0.08 } : p;
    if (this.hero.forceAssist && this.difficulty === 'expert') this.difficulty = 'normal';
    this.maxHearts = this.difficulty === 'facile' ? 5 : 3;
    this.hearts = this.maxHearts;
    this.pal = paletteFor(this.L);

    const cam = this.cameras.main;
    cam.setZoom(RES);
    cam.setBackgroundColor(this.L.mood === 'dusk' ? '#6e5a8a' : this.pal.bg);
    this.solids = buildSolids(this.L, this.difficulty);
    this.backdrop = new Backdrop(this, this.L, this.pal);
    this.backdrop.build();
    this.terrain = new Terrain(this, this.L, this.m, this.solids, this.difficulty);
    this.terrain.build();
    this.buildObjects();
    this.buildMechanics();
    this.body = new PlatformerBody(this.params, this.L.spawn.x - this.params.width / 2, this.L.spawn.y - this.params.height);
    this.prevX = this.body.x;
    this.prevY = this.body.y;
    this.heroView = new HeroView(this, this.hero, this.m, this.pal);
    this.heroView.build();
    this.enemies = new Enemies(this, this.L);
    this.enemies.build();
    this.enemies.onSpit = (x) => audio.sfx('sfx_spit', { worldX: x, volume: 0.6 });
    this.enemies.onAlert = (x) => audio.sfx('sfx_charge', { worldX: x, volume: 0.5, rate: 1.3 });
    this.fx = new LevelFx(this, this.L, this.pal);
    this.fx.build(this.quality);
    this.boss = new BossController(this.bossHost());
    this.boss.build();
    this.darkness = this.L.darkness ? new Darkness(this, this.L.darkness) : undefined;
    if (this.L.boss) {
      this.goalCrystal.setVisible(false);
      this.goalGlow.setVisible(false);
      this.registry.set('bossName', this.L.boss.name);
    }

    this.inp = new InputHub(this);
    this.rig = new CameraRig({
      viewW: VIEW_W,
      viewH: VIEW_H,
      lookAhead: 170,
      lookAheadSpeed: 2.2,
      deadZoneX: 30,
      followX: 5.5,
      followY: 3.2,
      screenY: 0.66,
      airTopMargin: 110,
      airBottomMargin: 150,
      bounds: { minX: -100, maxX: this.L.width, minY: -900, maxY: 900 },
    });
    this.rig.shakeScale = settings.reducedMotion ? 0.3 : 1;
    this.checkpoint = { ...this.L.spawn };
    this.lastSafe = { ...this.checkpoint };
    this.rig.snap(this.camTarget());
    this.applyCamera();
    this.adaptive = new AdaptiveQuality(this.quality, settings.quality === 'auto' ? 'haut' : settings.quality, (q) => this.setQuality(q));
    this.setQuality(this.quality);
    this.scene.launch('HUD', { level: this });

    const theme = themeOf(this.L.theme);
    audio.playFirst('music', [theme.music, 'music_forest'], 2000);
    audio.playFirst('ambience', [theme.ambience], 2500);
    this.irisIn();
    this.events.once('shutdown', () => this.scene.stop('HUD'));
    if (FLAGS.debug) this.debugGfx = this.add.graphics().setDepth(1000);
    perf.endLoad('niveau');
    (window as unknown as Record<string, unknown>).__level = this;
  }

  private resetState(): void {
    this.phase = 'play';
    this.crystals = [];
    this.stars = [];
    this.heartsItems = [];
    this.springs = [];
    this.checkpoints = [];
    this.hints = [];
    this.swayers = [];
    this.projectiles = [];
    this.flowers = [];
    this.rings = [];
    this.switches = [];
    this.barriers = [];
    this.secrets = [];
    this.updrafts = [];
    this.talks = [];
    this.chest = null;
    this.collected = { crystals: 0, stars: [false, false, false], chest: false, secrets: 0 };
    this.timeInLevel = 0;
    this.acc = 0;
    this.levelTime = 0;
    this.invuln = 0;
    this.shieldT = 0;
    this.slow = 0;
    this.charge = 0;
    this.chargeHeld = 0;
    this.powerCooldown = 0;
    this.flowerUsed = false;
    this.camFocus = false;
    this.quality = START_QUALITY;
  }

  fit(key: string, size: number, axis: 'w' | 'h' = 'w'): number {
    return fitScale(this, key, size, axis);
  }

  private k(key: string): string {
    return themed(this, key, this.L.theme);
  }

  // ---------------------------------------------------------------- construction

  private buildObjects(): void {
    const L = this.L;
    const T = themeOf(L.theme);
    for (const p of L.props) {
      const key = propKey(L.theme, p.key);
      if (!this.textures.exists(key)) continue;
      const img = this.add
        .image(p.x, p.y + 8, key)
        .setOrigin(0.5, 1)
        .setScale(p.scale ?? 0.5)
        .setFlipX(!!p.flip)
        .setDepth(p.front ? 40 : -37);
      if (p.front) img.setTint(this.pal.propFront).setScale(img.scale * 0.7).setAlpha(0.92);
      else if (T.tileTint != null) img.setTint(T.tileTint);
      const glowTint = T.glowProps[p.key] ?? GLOW_PROPS[key];
      if (glowTint != null) {
        const g = this.add
          .image(p.x, p.y - img.displayHeight * 0.55, 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(glowTint)
          .setScale(img.displayWidth / 70)
          .setAlpha(0.35)
          .setDepth(img.depth - 1);
        this.tweens.add({ targets: g, alpha: 0.12, duration: 1600 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      if (SWAYING.has(key))
        this.swayers.push({ obj: img, x: p.x, amp: p.key === 'grass' || p.key === 'fern' ? 0.07 : 0.035, v: 0, a: 0, phase: Math.random() * 6 });
    }
    for (const c of L.crystals) {
      const glow = this.add.image(c.x, c.y, 'glow').setTint(0x7fd8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setAlpha(0.6).setDepth(-21);
      const img = this.add.image(c.x, c.y, 'crystal').setScale(this.fit('crystal', 40)).setDepth(-20);
      this.crystals.push({ img, glow, x: c.x, y: c.y, taken: false, phase: c.x * 0.013 });
    }
    L.stars.forEach((st, i) => {
      const glow = this.add.image(st.x, st.y, 'glow').setTint(0xffd36b).setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setAlpha(0.7).setDepth(-21);
      const img = this.add.image(st.x, st.y, 'star').setScale(this.fit('star', 74)).setDepth(-20);
      this.stars.push({ img, glow, x: st.x, y: st.y, taken: false, phase: i, i });
    });
    for (const h of L.hearts) {
      const img = this.add.image(h.x, h.y, 'heart').setScale(this.fit('heart', 46)).setDepth(-20);
      this.heartsItems.push({ img, x: h.x, y: h.y, taken: false, phase: 0 });
    }
    if (L.chest && this.textures.exists('chest')) {
      const img = this.add.image(L.chest.x, L.chest.y + 4, 'chest').setOrigin(0.5, 1).setScale(this.fit('chest', 90)).setDepth(-22);
      this.chest = { img, x: L.chest.x, y: L.chest.y, open: false };
    }
    for (const s of L.springs) {
      const key = this.k('spring');
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(s.x, s.y + 6, key).setOrigin(0.5, 1).setScale(this.fit(key, 120)).setDepth(-30);
      this.springs.push({ img, x: s.x, y: s.y });
    }
    for (const c of L.checkpoints) {
      const post = this.add.image(c.x, c.y + 6, 'lantern').setOrigin(0.5, 1).setScale(this.fit('lantern', 150, 'h')).setDepth(-30).setTint(0x8a8aa0);
      const flame = this.add.image(c.x, c.y - 110, 'glow').setTint(0xffb848).setBlendMode(Phaser.BlendModes.ADD).setScale(0).setDepth(-29);
      this.checkpoints.push({ x: c.x, y: c.y, lit: false, flame, post });
    }
    for (const h of L.hints) {
      const c = bubble(this, h.heroPower ? POWER_HINT[this.hero.power] : h.text).setPosition(h.x, h.y).setDepth(30).setAlpha(0).setScale(0.8);
      this.hints.push({ c, x: h.x, y: h.y });
    }
    const gy = L.goal.y;
    this.goalGlow = this.add.image(L.goal.x, gy - 170, 'glow').setTint(0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(7).setAlpha(0.55).setDepth(-25);
    this.goalCrystal = this.add.image(L.goal.x, gy - 170, 'crystal').setScale(this.fit('crystal', 150, 'h')).setDepth(-24);
    const [a, b] = themeOf(L.theme).goalDecor.map((k) => propKey(L.theme, k));
    if (this.textures.exists(a) && this.textures.exists(b)) {
      this.add.image(L.goal.x - 75, gy + 10, a).setOrigin(0.5, 1).setScale(this.fit(a, 180)).setDepth(-26);
      this.add.image(L.goal.x + 80, gy + 10, b).setOrigin(0.5, 1).setScale(this.fit(b, 160)).setFlipX(true).setDepth(-26);
    }
    for (let i = 0; i < 3; i++) {
      const r = this.add
        .image(L.goal.x, gy - 170, 'ray')
        .setOrigin(0.5, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.25)
        .setScale(0.6, 0.9)
        .setTint(0xbff2ff)
        .setDepth(-26)
        .setRotation((i - 1) * 0.5);
      this.tweens.add({ targets: r, alpha: 0.1, duration: 1800 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.totalCrystals = L.crystals.length + L.enemies.length + (L.chest ? 10 : 0);
  }

  /** Énigmes, courants d'air, passages secrets, dialogues. */
  private buildMechanics(): void {
    const L = this.L;
    for (const sw of L.switches ?? []) {
      const img = this.add.image(sw.x, sw.y + 4, 'switch_base').setOrigin(0.5, 1).setDepth(-28);
      const gem = this.add.image(sw.x, sw.y - 52, 'crystal').setScale(this.fit('crystal', 36)).setTint(0x8090a8).setDepth(-27);
      this.tweens.add({ targets: gem, y: gem.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.switches.push({ def: sw, img, gem, on: false });
    }
    for (const b of L.barriers ?? []) {
      const solid = this.solids.find((s) => s.tag === `barrier:${b.id}`)!;
      const img = this.add.image(b.x, b.y, 'barrier').setOrigin(0.5, 1).setDisplaySize(64, b.h).setTint(this.pal.gate).setBlendMode(Phaser.BlendModes.ADD).setDepth(-14);
      this.tweens.add({ targets: img, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
      this.barriers.push({ id: b.id, img, solid });
    }
    for (const u of L.updrafts ?? []) {
      this.updrafts.push(u);
      this.add
        .particles(0, 0, 'streak', {
          x: { min: u.x, max: u.x + u.w },
          y: u.y + u.h,
          lifespan: 1400,
          speedY: { min: -420, max: -300 },
          scaleY: { min: 0.6, max: 1.2 },
          scaleX: 1,
          alpha: { values: [0, 0.55, 0] },
          tint: 0xe8fbff,
          blendMode: 'ADD',
          frequency: 45,
        })
        .setDepth(-30);
    }
    for (const sec of L.secrets ?? []) {
      const key = propKey(L.theme, sec.coverKey ?? themeOf(L.theme).secretCover);
      const cover: Phaser.GameObjects.Image[] = [];
      if (this.textures.exists(key)) {
        const n = Math.max(2, Math.round(sec.w / 140));
        for (let i = 0; i < n; i++) {
          const img = this.add
            .image(sec.x + (i + 0.5) * (sec.w / n), sec.y + sec.h + 16, key)
            .setOrigin(0.5, 1)
            .setDepth(41)
            .setFlipX(i % 2 === 1)
            .setTint(this.pal.propFront);
          img.setScale(((sec.h + 60) / img.height) * (0.95 + (i % 3) * 0.06));
          cover.push(img);
        }
      }
      this.secrets.push({ rect: new Phaser.Geom.Rectangle(sec.x, sec.y, sec.w, sec.h), cover, found: false });
    }
    for (const w of L.winds ?? [])
      this.add
        .particles(0, 0, 'streak', {
          x: w.force > 0 ? w.x : w.x + w.w,
          y: { min: w.y, max: w.y + w.h },
          lifespan: Math.abs((w.w / 520) * 1000),
          speedX: w.force > 0 ? { min: 420, max: 620 } : { min: -620, max: -420 },
          rotate: 90,
          scaleY: { min: 0.5, max: 1 },
          alpha: { values: [0, 0.45, 0] },
          tint: 0xf0fbff,
          blendMode: 'ADD',
          frequency: 60,
        })
        .setDepth(-29);
    for (const z of L.lowGravity ?? []) {
      this.add
        .particles(0, 0, 'spark', {
          x: { min: z.x, max: z.x + z.w },
          y: { min: z.y, max: z.y + z.h },
          lifespan: 3000,
          speedY: { min: -30, max: -10 },
          scale: { start: 0.25, end: 0 },
          alpha: { values: [0, 0.8, 0] },
          tint: [0xd9c2ff, 0x9fe8ff, 0xffffff],
          blendMode: 'ADD',
          frequency: 90,
        })
        .setDepth(-29);
      const g = this.add.graphics().setDepth(-31);
      g.fillStyle(0xb8a0ff, 0.06).fillRoundedRect(z.x, z.y, z.w, z.h, 60);
    }
    this.talks = (L.talks ?? []).map((t) => ({ ...t, done: false }));
  }

  private bossHost(): BossHost {
    const self = this;
    return {
      scene: this,
      get L() {
        return self.L;
      },
      get solids() {
        return self.solids;
      },
      get body() {
        return self.body;
      },
      get prevBottom() {
        return self.prevY + self.body.p.height;
      },
      get shieldT() {
        return self.shieldT;
      },
      get invuln() {
        return self.invuln;
      },
      get playing() {
        return self.phase === 'play';
      },
      hurt: (d) => this.hurt(d),
      shake: (a, t) => this.rig.shake(a, t),
      burst: (n, x, y) => this.fx.bursts.explode(n, x, y),
      dustAt: (n, x, y) => this.fx.dust.explode(n, x, y),
      toast: (t) => this.events.emit('toast', t),
      emitBoss: (hp, max) => this.events.emit('boss', hp, max),
      slowmo: (t) => (this.slow = t),
      squash: (x, y) => (this.heroView.squash = { x, y }),
      onDefeated: () => this.bossDefeated(),
      focus: (on) => (this.camFocus = on),
    };
  }

  // ---------------------------------------------------------------- boucle

  override update(time: number, dms: number): void {
    if (!this.body) return;
    perf.frame(dms);
    const dt = Math.min(dms, 100) / 1000;
    this.adaptive.update(dt, perf.stats().frameP95);
    const inp = this.inp.sample();
    if (inp.pause && this.phase === 'play') {
      this.pause();
      this.inp.consume();
      return;
    }
    if (this.phase === 'paused') {
      this.inp.consume();
      return;
    }
    let scale = 1;
    if (this.slow > 0) {
      this.slow -= dt;
      scale = 0.35;
    }
    this.acc += dt * scale;
    let first = true;
    while (this.acc >= STEP) {
      this.prevX = this.body.x;
      this.prevY = this.body.y;
      const bi: BodyInput =
        this.phase === 'play'
          ? { left: inp.left, right: inp.right, jump: inp.jump, jumpPressed: first && inp.jumpPressed, down: inp.down }
          : { left: false, right: this.phase === 'victory' && this.body.centerX < this.L.goal.x - 40, jump: false, jumpPressed: false };
      this.fixedStep(bi, inp, first);
      first = false;
      this.acc -= STEP;
    }
    this.inp.consume();
    if (this.phase === 'play') this.timeInLevel += dt;
    this.render(time, dt);
  }

  private fixedStep(bi: BodyInput, inp: InputFrame, first: boolean): void {
    const b = this.body;
    this.levelTime += STEP;
    updateMovers(this.solids, this.levelTime, b);
    let updraft = 0;
    for (const u of this.updrafts) if (overlaps(b.rect, u)) updraft = Math.max(updraft, u.power);
    let wind = 0;
    for (const w of this.L.winds ?? []) if (overlaps(b.rect, w)) wind += w.force;
    let gravityScale = 1;
    for (const z of this.L.lowGravity ?? []) if (overlaps(b.rect, z)) gravityScale = Math.min(gravityScale, z.scale);
    b.step(bi, this.solids, STEP, { updraft, wind, gravityScale });
    if (b.grounded) this.flowerUsed = false;
    this.updateFlowers();
    if (this.shieldT > 0) this.shieldT -= STEP;
    this.boss.fixedStep(STEP, bi.jump);
    for (const e of b.events) this.onBodyEvent(e);
    if (this.invuln > 0) this.invuln -= STEP;
    if (this.powerCooldown > 0) this.powerCooldown -= STEP;
    if (this.phase === 'play') this.handlePower(inp, first);
    if (b.grounded && this.solids.some((s) => !s.oneWay && !s.off && Math.abs(s.y - b.bottom) < 1 && b.x > s.x + 60 && b.x + b.p.width < s.x + s.w - 60))
      this.lastSafe = { x: b.centerX, y: b.bottom };
    if (b.y > this.L.killY && this.phase === 'play') this.fall();

    // Ennemis.
    this.enemies.step(STEP, { x: b.centerX, y: b.bottom });
    for (const e of this.enemies.list) {
      if (!e.st.alive || this.phase !== 'play') continue;
      const r = this.enemies.rect(e);
      if (!overlaps(b.rect, r)) continue;
      if (b.vy > 0 && this.prevY + b.p.height <= r.y + 18) this.stomp(e, bi.jump);
      else if (this.shieldT > 0) this.defeat(e);
      else if (harmful(e.st) && this.invuln <= 0) this.hurt(e.st.x < b.centerX ? 1 : -1);
    }
    for (const s of this.enemies.spores) {
      if (!s.sp.alive || this.phase !== 'play') continue;
      if (overlaps(b.rect, { x: s.sp.x - 16, y: s.sp.y - 16, w: 32, h: 32 })) {
        s.sp.alive = false;
        if (this.shieldT <= 0 && this.invuln <= 0) this.hurt(s.sp.vx > 0 ? 1 : -1);
      }
    }
    this.enemies.cleanSpores((x, y) => this.fx.bursts.explode(5, x, y));

    this.stepProjectiles();
    this.stepRings();
    if (this.phase !== 'play') return;
    this.collect();
    this.stepMechanics();
    if (this.boss.done && b.centerX > this.L.goal.x - 120 && Math.abs(b.bottom - this.L.goal.y) < 60) this.victory();
  }

  // ---------------------------------------------------------------- pouvoirs

  private handlePower(inp: InputFrame, first: boolean): void {
    const power = this.hero.power;
    if (power === 'light') {
      // Appui bref : étoile ; maintien ≥ 0,5 s puis relâche : Nova.
      if (inp.powerHeld) {
        this.chargeHeld += STEP;
        if (this.chargeHeld > 0.18) {
          const before = this.charge;
          this.charge = Math.min(1, (this.chargeHeld - 0.18) / 0.5);
          if (before < 1 && this.charge >= 1) audio.sfx('sfx_charge', { volume: 0.7 });
        }
      }
      if (first && inp.power && this.powerCooldown <= 0 && this.chargeHeld <= STEP * 2) this.castStar(false);
      if (!inp.powerHeld && this.chargeHeld > 0) {
        if (this.charge >= 1 && this.powerCooldown <= 0.3) this.castStar(true);
        this.chargeHeld = 0;
        this.charge = 0;
      }
      return;
    }
    if (!(first && inp.power) || this.powerCooldown > 0) return;
    if (power === 'flower') this.castFlower();
    else this.castSun();
  }

  private castStar(nova: boolean): void {
    const b = this.body;
    this.powerCooldown = nova ? 0.9 : 0.5;
    const key = 'star';
    const img = this.add.image(b.centerX + b.facing * 30, b.y + 40, key).setScale(this.fit(key, nova ? 84 : 40)).setDepth(-9);
    const glow = this.add.image(img.x, img.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setScale(nova ? 3.4 : 1.6).setAlpha(0.8).setDepth(-10);
    this.tweens.add({ targets: img, angle: b.facing * 720, duration: 900 });
    this.projectiles.push({ img, glow, x: img.x, y: img.y, vx: b.facing * (nova ? 1000 : 900), life: nova ? 1.0 : 0.75, pierce: nova, hit: new Set() });
    audio.sfx(nova ? 'sfx_light' : 'sfx_power', { worldX: b.centerX, volume: nova ? 0.9 : 0.6, rate: nova ? 0.8 : 1 });
    if (nova) {
      this.rig.shake(3, 0.15);
      this.fx.trail.explode(20, img.x, img.y);
    }
    if (b.grounded) this.heroView.hold(`${this.heroView.key}_cast`, 0.28);
    this.heroView.squash = { x: 1.08, y: 0.94 };
  }

  private castFlower(): void {
    const b = this.body;
    if (!b.grounded && this.flowerUsed) return;
    this.flowerUsed = !b.grounded;
    this.powerCooldown = 0.45;
    const x = b.centerX - 70 + (b.grounded ? b.facing * 110 : 0);
    const y = b.grounded ? b.bottom - 95 : b.bottom + 1;
    const s: Solid = { x, y, w: 140, h: 26, oneWay: true, material: 'flower' };
    this.solids.push(s);
    const img = this.add.image(x + 70, y + 30, 'flowers2').setOrigin(0.5, 0.75).setDepth(-34);
    const sc = 161 / img.width;
    img.setScale(sc * 0.2, sc * 0.1);
    this.tweens.add({ targets: img, scaleX: sc, scaleY: sc, duration: 260, ease: 'Back.easeOut' });
    this.flowers.push({ s, img, life: 2.5 });
    this.fx.trail.explode(14, x + 70, y);
    audio.sfx('sfx_flower', { worldX: b.centerX, volume: 0.7 });
    audio.sfx('sfx_power', { worldX: b.centerX, volume: 0.4, rate: 0.85 });
    this.heroView.hold(`${this.heroView.key}_cast`, 0.3);
  }

  private updateFlowers(): void {
    for (const f of this.flowers) f.life -= STEP;
    for (const f of this.flowers.filter((x) => x.life <= 0)) {
      this.solids.splice(this.solids.indexOf(f.s), 1);
      this.fx.bursts.explode(6, f.s.x + f.s.w / 2, f.s.y);
      f.img.destroy();
    }
    this.flowers = this.flowers.filter((f) => f.life > 0);
  }

  /** Éclat solaire de Zakaria : onde qui repousse tout, bouclier doré temporaire. */
  private castSun(): void {
    const b = this.body;
    this.powerCooldown = 4;
    this.shieldT = 2.6;
    const x = b.centerX, y = b.y + b.p.height / 2;
    const img = this.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc860).setScale(0.3).setDepth(-8);
    this.rings.push({ img, t: 0, x, y });
    const core = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0a0).setScale(2).setDepth(-8);
    this.tweens.add({ targets: core, scale: 9, alpha: 0, duration: 450, onComplete: () => core.destroy() });
    this.fx.trail.explode(28, x, y);
    this.rig.shake(4, 0.2);
    audio.sfx('sfx_sun', { worldX: x, volume: 0.9 });
    audio.sfx('sfx_power', { worldX: x, volume: 0.5, rate: 1.15 });
    this.heroView.hold(`${this.heroView.key}_cast`, 0.35);
    this.events.emit('toast', 'Éclat solaire !');
  }

  private stepRings(): void {
    for (const r of this.rings) {
      r.t += STEP;
      const radius = 40 + r.t * 620;
      if (radius > 260) continue;
      for (const e of this.enemies.list)
        if (e.st.alive && Math.hypot(e.st.x - r.x, (e.st.kind === 'flyer' ? e.st.y : e.st.y - 30) - r.y) < radius) this.defeat(e);
      for (const s of this.enemies.spores) if (s.sp.alive && Math.hypot(s.sp.x - r.x, s.sp.y - r.y) < radius) s.sp.alive = false;
      this.hitSwitches({ x: r.x - radius, y: r.y - radius, w: radius * 2, h: radius * 2 });
      this.boss.magicHit({ x: r.x - radius, y: r.y - radius, w: radius * 2, h: radius * 2 });
    }
    this.rings = this.rings.filter((r) => {
      const k = r.t / 0.42;
      r.img.setScale(0.3 + k * 4.2).setAlpha(Math.max(0, 1 - k));
      if (k >= 1) {
        r.img.destroy();
        return false;
      }
      return true;
    });
  }

  private stepProjectiles(): void {
    for (const p of this.projectiles) {
      p.x += p.vx * STEP;
      p.life -= STEP;
      const box = { x: p.x - (p.pierce ? 40 : 20), y: p.y - (p.pierce ? 40 : 20), w: p.pierce ? 80 : 40, h: p.pierce ? 80 : 40 };
      for (const e of this.enemies.list) {
        if (!e.st.alive || p.hit.has(e)) continue;
        if (overlaps(box, this.enemies.rect(e))) {
          this.defeat(e);
          p.hit.add(e);
          if (!p.pierce) p.life = 0;
        }
      }
      for (const s of this.enemies.spores) if (s.sp.alive && Math.abs(s.sp.x - p.x) < 40 && Math.abs(s.sp.y - p.y) < 40) s.sp.alive = false;
      this.boss.clearShotsIn(box);
      if (p.life > 0 && this.boss.magicHit(box) && !p.pierce) p.life = 0;
      if (p.life > 0 && this.hitSwitches(box) && !p.pierce) p.life = 0;
      for (const c of this.crystals) if (!c.taken && Math.abs(c.x - p.x) < 40 && Math.abs(c.y - p.y) < 40) this.takeCrystal(c);
      // Les étoiles se brisent sur les murs.
      if (this.solids.some((s) => !s.oneWay && !s.off && overlaps({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 }, s))) p.life = 0;
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.life > 0) return true;
      this.fx.bursts.explode(p.pierce ? 18 : 8, p.x, p.y);
      p.img.destroy();
      p.glow.destroy();
      return false;
    });
  }

  // ---------------------------------------------------------------- mécaniques

  private hitSwitches(box: { x: number; y: number; w: number; h: number }): boolean {
    let hit = false;
    for (const s of this.switches) {
      if (s.on) continue;
      if (overlaps(box, { x: s.def.x - 40, y: s.def.y - 90, w: 80, h: 90 })) {
        this.activateSwitch(s);
        hit = true;
      }
    }
    return hit;
  }

  private activateSwitch(s: (typeof this.switches)[number]): void {
    s.on = true;
    s.gem.clearTint();
    this.tweens.add({ targets: s.gem, scale: s.gem.scale * 1.4, duration: 200, yoyo: true });
    const g = this.add.image(s.def.x, s.def.y - 52, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fe8ff).setScale(0).setDepth(-28);
    this.tweens.add({ targets: g, scale: 3, alpha: 0.6, duration: 500 });
    this.fx.bursts.explode(24, s.def.x, s.def.y - 52);
    audio.sfx('sfx_switch', { worldX: s.def.x });
    audio.sfx('sfx_star', { worldX: s.def.x, volume: 0.5, rate: 1.3 });
    this.terrain.reveal(s.def.id);
    for (const b of this.barriers.filter((x) => x.id === s.def.id)) {
      b.solid.off = true;
      this.tweens.killTweensOf(b.img);
      this.tweens.add({ targets: b.img, alpha: 0, scaleY: 0, duration: 600, ease: 'Cubic.easeIn' });
      audio.sfx('sfx_gate', { worldX: b.solid.x });
    }
    this.events.emit('toast', 'Un passage s’ouvre !');
  }

  private stepMechanics(): void {
    const b = this.body;
    // Interrupteurs à piétiner.
    for (const s of this.switches) {
      if (s.on || s.def.mode !== 'stomp') continue;
      if (b.vy >= 0 && Math.abs(b.centerX - s.def.x) < 46 && b.bottom >= s.def.y - 70 && b.bottom <= s.def.y + 4 && this.prevY + b.p.height <= s.def.y - 40) {
        this.activateSwitch(s);
        b.vy = -700;
        this.heroView.squash = { x: 0.85, y: 1.2 };
      }
    }
    for (const sec of this.secrets) {
      if (sec.found || !sec.rect.contains(b.centerX, b.y + b.p.height / 2)) continue;
      sec.found = true;
      this.collected.secrets++;
      for (const c of sec.cover) this.tweens.add({ targets: c, alpha: 0.18, duration: 500 });
      audio.sfx('sfx_secret', { volume: 0.9 });
      audio.sfx('sfx_chest', { volume: 0.4, rate: 1.4 });
      this.events.emit('toast', 'Passage secret découvert !');
      this.fx.trail.explode(20, b.centerX, b.y);
    }
    for (const t of this.talks) {
      if (t.done || b.centerX < t.x) continue;
      t.done = true;
      this.events.emit('talk', t.lines);
    }
  }

  private collect(): void {
    const b = this.body;
    const top = b.y - 6;
    const bot = b.y + b.p.height + 6;
    for (const c of this.crystals) if (!c.taken && Math.abs(c.x - b.centerX) < 46 && c.y > top - 20 && c.y < bot + 10) this.takeCrystal(c);
    for (const s of this.stars) if (!s.taken && Math.abs(s.x - b.centerX) < 60 && s.y > top - 30 && s.y < bot + 20) this.takeStar(s);
    for (const h of this.heartsItems) if (!h.taken && Math.abs(h.x - b.centerX) < 46 && h.y > top - 20 && h.y < bot) this.takeHeart(h);
    if (this.chest && !this.chest.open && Math.abs(this.chest.x - b.centerX) < 70 && Math.abs(this.chest.y - b.bottom) < 40) this.openChest();
    for (const c of this.checkpoints) if (!c.lit && b.centerX > c.x - 20 && Math.abs(c.y - b.bottom) < 200) this.lightCheckpoint(c);
  }

  private onBodyEvent(e: PlatformerBody['events'][number]): void {
    const b = this.body;
    const hv = this.heroView;
    if (e.type === 'jump') {
      audio.sfx(e.air ? 'sfx_double_jump' : 'sfx_jump', { worldX: b.centerX, volume: e.air ? 0.8 : 0.7, rate: this.hero.voiceRate });
      hv.squash = { x: 0.86, y: 1.16 };
      if (e.air) {
        this.fx.trail.explode(16, b.centerX, b.bottom - 10);
        this.fx.bursts.explode(10, b.centerX, b.bottom);
      } else this.fx.dust.explode(5, b.centerX, b.bottom);
    } else if (e.type === 'wallJump') {
      audio.sfx('sfx_jump', { worldX: b.centerX, volume: 0.7, rate: 1.2 });
      hv.squash = { x: 0.84, y: 1.18 };
      this.fx.dust.explode(6, b.centerX - e.dir * 24, b.y + b.p.height * 0.6);
      this.fx.bursts.explode(6, b.centerX - e.dir * 24, b.y + b.p.height * 0.5);
    } else if (e.type === 'land') {
      const k = Math.min(1, e.impact / 1100);
      hv.squash = { x: 1 + 0.25 * k, y: 1 - 0.22 * k };
      this.fx.dust.explode(Math.round(4 + 8 * k), b.centerX, b.bottom);
      audio.sfx('sfx_land', { worldX: b.centerX, volume: 0.35 + 0.5 * k });
      if (k > 0.85) this.rig.shake(4, 0.18);
    } else if (e.type === 'bounce') {
      hv.squash = { x: 0.8, y: 1.25 };
      audio.sfx('sfx_bounce', { worldX: b.centerX });
      const sp = this.springs.find((s) => Math.abs(s.x - b.centerX) < 80);
      if (sp) this.tweens.add({ targets: sp.img, scaleY: sp.img.scaleY * 0.7, scaleX: sp.img.scaleX * 1.18, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.fx.bursts.explode(12, b.centerX, b.bottom);
    }
  }

  // ---------------------------------------------------------------- collecte

  private takeCrystal(c: Pickup): void {
    c.taken = true;
    this.collected.crystals++;
    audio.sfx('sfx_crystal', { worldX: c.x, volume: 0.55, pitchVar: 0, rate: 1 + (this.collected.crystals % 8) * 0.03 });
    this.fx.bursts.explode(6, c.x, c.y);
    c.glow?.destroy();
    this.tweens.add({ targets: c.img, y: c.y - 40, scale: c.img.scale * 1.5, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => c.img.destroy() });
    this.events.emit('crystal', this.collected.crystals);
  }

  private takeStar(s: Pickup): void {
    s.taken = true;
    this.collected.stars[s.i!] = true;
    audio.sfx('sfx_star', { worldX: s.x, volume: 0.9, pitchVar: 0 });
    audio.duck(0.4, 200);
    this.time.delayedCall(1600, () => audio.unduck());
    this.slow = 0.25;
    this.rig.zoomPunch = saves.data.settings.reducedMotion ? 0.02 : 0.06;
    this.fx.bursts.explode(30, s.x, s.y);
    this.fx.trail.explode(24, s.x, s.y);
    this.fx.confettiBurst(s.x, s.y, 26);
    s.glow?.destroy();
    this.tweens.add({ targets: s.img, scale: s.img.scale * 2, alpha: 0, angle: 360, duration: 600, ease: 'Back.easeIn', onComplete: () => s.img.destroy() });
    this.events.emit('star', s.i);
  }

  private takeHeart(h: Pickup): void {
    h.taken = true;
    this.hearts = Math.min(this.maxHearts, this.hearts + 1);
    audio.sfx('sfx_crystal', { worldX: h.x, rate: 0.8 });
    this.tweens.add({ targets: h.img, scale: h.img.scale * 1.6, alpha: 0, duration: 300, onComplete: () => h.img.destroy() });
    this.events.emit('hearts', this.hearts, this.maxHearts);
  }

  private openChest(): void {
    const c = this.chest!;
    c.open = true;
    this.collected.chest = true;
    audio.sfx('sfx_chest', { worldX: c.x });
    this.tweens.add({ targets: c.img, scaleY: c.img.scaleY * 1.15, duration: 120, yoyo: true });
    this.fx.bursts.explode(40, c.x, c.y - 40);
    this.fx.trail.explode(30, c.x, c.y - 40);
    for (let i = 0; i < 10; i++)
      this.time.delayedCall(i * 60, () => {
        this.collected.crystals++;
        this.events.emit('crystal', this.collected.crystals);
        audio.sfx('sfx_crystal', { worldX: c.x, volume: 0.35, rate: 1 + i * 0.05 });
      });
    this.events.emit('toast', 'Coffre secret ! +10 cristaux');
  }

  private lightCheckpoint(c: (typeof this.checkpoints)[number]): void {
    c.lit = true;
    this.checkpoint = { x: c.x + 40, y: c.y };
    c.post.clearTint();
    this.tweens.add({ targets: c.flame, scale: 2.2, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c.flame, alpha: 0.7, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 500 });
    this.fx.bursts.explode(16, c.x, c.y - 110);
    audio.sfx('sfx_checkpoint', { worldX: c.x });
    this.hearts = this.maxHearts;
    this.events.emit('hearts', this.hearts, this.maxHearts);
    this.events.emit('toast', 'Lanterne allumée !');
  }

  // ---------------------------------------------------------------- combat

  private stomp(e: EnemyEntity, jumpHeld: boolean): void {
    this.defeat(e);
    this.body.vy = jumpHeld ? -980 : -720;
    this.heroView.squash = { x: 0.85, y: 1.18 };
    this.rig.shake(3, 0.12);
  }

  private defeat(e: EnemyEntity): void {
    if (!e.st.alive) return;
    this.enemies.defeatVisual(e);
    audio.sfx(e.st.kind === 'flyer' ? 'sfx_wisp' : 'sfx_stomp', { worldX: e.st.x });
    if (e.st.kind === 'flyer') audio.sfx('sfx_stomp', { worldX: e.st.x, volume: 0.4, rate: 1.4 });
    const y = e.st.kind === 'flyer' ? e.st.y : e.st.y - 30;
    this.fx.dust.explode(10, e.st.x, y + 10);
    this.fx.bursts.explode(10, e.st.x, y);
    // Chaque ennemi apaisé libère un cristal.
    this.collected.crystals++;
    this.events.emit('crystal', this.collected.crystals);
  }

  hurt(dir: number): void {
    if (this.phase !== 'play') return;
    this.hearts--;
    this.invuln = 1.6;
    audio.sfx('sfx_hurt', { worldX: this.body.centerX });
    this.heroView.hold(`${this.heroView.key}_surprised`, 0.45);
    this.body.vx = dir * 420;
    this.body.vy = -520;
    this.body.grounded = false;
    this.rig.shake(7, 0.25);
    this.events.emit('hearts', this.hearts, this.maxHearts);
    if (this.hearts <= 0) this.softDefeat();
  }

  private fall(): void {
    this.hearts--;
    this.events.emit('hearts', this.hearts, this.maxHearts);
    audio.sfx('sfx_hurt', {});
    if (this.hearts <= 0) this.softDefeat();
    else this.respawnAt(this.lastSafe.x, this.lastSafe.y, false);
  }

  /** Défaite douce : écran d'encouragement, puis retour à la dernière lanterne. */
  private softDefeat(): void {
    this.phase = 'dying';
    this.cameras.main.fadeOut(450, 20, 30, 50);
    this.time.delayedCall(500, () => {
      this.scene.pause();
      this.scene.launch('Overlay', { mode: 'defeat', hero: this.hero.name });
    });
  }

  /** Appelé par l'écran de défaite. */
  retryFromCheckpoint(): void {
    this.hearts = this.maxHearts;
    this.events.emit('hearts', this.hearts, this.maxHearts);
    this.respawnAt(this.checkpoint.x, this.checkpoint.y, true);
    this.cameras.main.fadeIn(500, 20, 30, 50);
    this.phase = 'play';
  }

  private respawnAt(x: number, y: number, snap: boolean): void {
    const b = this.body;
    b.x = x - b.p.width / 2;
    b.y = y - b.p.height - 2;
    b.vx = 0;
    b.vy = 0;
    this.prevX = b.x;
    this.prevY = b.y;
    this.invuln = 1.2;
    this.fx.trail.explode(20, x, y - 60);
    if (snap) this.rig.snap(this.camTarget());
  }

  private bossDefeated(): void {
    const L = this.boss.logic;
    audio.sfx('sfx_star', { worldX: L.x, volume: 1, pitchVar: 0 });
    audio.playFirst('music', [themeOf(this.L.theme).music], 1500);
    this.events.emit('toast', this.L.boss?.smile ?? `${this.L.boss?.name} sourit enfin !`);
    this.events.emit('boss', 0, L.maxHp);
    this.fx.trail.explode(40, L.x, L.y - 120);
    this.fx.confettiBurst(L.x, L.y - 200, 80);
    this.time.delayedCall(900, () => {
      this.goalCrystal.setVisible(true).setAlpha(0);
      this.goalGlow.setVisible(true).setAlpha(0);
      const y = this.goalCrystal.y;
      this.goalCrystal.y = y - 300;
      this.tweens.add({ targets: this.goalCrystal, y, alpha: 1, duration: 1400, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: this.goalGlow, alpha: 0.55, duration: 1400 });
      this.fx.bursts.explode(30, this.L.goal.x, y);
    });
  }

  private victory(): void {
    this.phase = 'victory';
    audio.stop('music', 600);
    this.time.delayedCall(500, () => audio.play('music', 'music_victory', 200, false));
    this.tweens.add({ targets: this.goalCrystal, y: this.goalCrystal.y - 40, scale: this.goalCrystal.scale * 1.25, duration: 1600, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.goalGlow, scale: 12, alpha: 0.9, duration: 1600 });
    this.time.delayedCall(300, () => {
      this.fx.bursts.explode(60, this.L.goal.x, this.L.goal.y - 190);
      this.fx.trail.explode(40, this.L.goal.x, this.L.goal.y - 190);
    });
    for (const [delay, n] of [
      [350, 70],
      [900, 50],
    ])
      this.time.delayedCall(delay, () => {
        const v = this.cameras.main.worldView;
        this.fx.confettiBurst(v.x + 40, v.bottom - 60, n, [280, 320]);
        this.fx.confettiBurst(v.right - 40, v.bottom - 60, n, [220, 260]);
        audio.sfx('sfx_chest', { volume: 0.5, rate: 1.2 + delay / 3000 });
      });
    const next = this.L.next ?? null;
    const best = saves.recordLevel(
      this.L.id,
      { stars: this.collected.stars, crystals: this.collected.crystals, time: this.timeInLevel, chest: this.collected.chest, hero: this.hero.id },
      next,
    );
    this.time.delayedCall(2200, () => {
      this.scene.pause();
      this.scene.launch('Overlay', {
        mode: 'victory',
        result: {
          ...this.collected,
          total: this.totalCrystals,
          time: this.timeInLevel,
          best,
          levelId: this.L.id,
          levelName: this.L.name,
          next: nextPlayable(this.L.id, (t) => artReady(this, t)),
          outro: this.L.outro,
          hero: this.hero.name,
          smile: this.L.boss?.smile,
          secretsTotal: this.L.secrets?.length ?? 0,
        },
      });
    });
  }

  pause(): void {
    this.phase = 'paused';
    audio.duck(0.35);
    this.scene.pause();
    this.scene.launch('Overlay', { mode: 'pause' });
  }

  resumeFromPause(): void {
    this.phase = 'play';
    audio.unduck();
  }

  // ---------------------------------------------------------------- rendu

  private camTarget(): CameraTarget {
    const b = this.body;
    return { x: b.centerX, y: b.bottom, vx: b.vx, vy: b.vy, facing: b.facing, grounded: b.grounded };
  }

  private applyCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(RES * (1 + this.rig.zoomPunch));
    cam.centerOn(this.rig.x + this.rig.offX, this.rig.y + this.rig.offY);
  }

  setQuality(q: QualityLevel): void {
    this.quality = q;
    const p = QUALITY[q];
    this.fx.setQuality(q);
    this.backdrop.setQuality(p.fog, p.foreground);
    if (this.heroView.glow) this.heroView.glow.active = q !== 'bas';
  }

  private render(time: number, dt: number): void {
    const b = this.body;
    const a = this.acc / STEP;
    const x = Phaser.Math.Linear(this.prevX, b.x, a) + b.p.width / 2;
    const y = Phaser.Math.Linear(this.prevY, b.y, a) + b.p.height;
    if (this.camFocus && this.L.boss) {
      const bx = (this.L.boss.minX + this.L.boss.maxX) / 2;
      this.rig.focus = { x: bx, y: this.L.boss.y - 200, weight: 0.55 };
    } else this.rig.focus = null;
    this.rig.update(this.camTarget(), dt, time);
    this.applyCamera();
    const view = this.cameras.main.worldView;
    audio.setListener(view.centerX, view.width);
    this.heroView.update({
      body: b,
      x,
      y,
      time,
      dt,
      invuln: this.invuln > 0 && this.phase === 'play',
      victory: this.phase === 'victory',
      shieldT: this.shieldT,
      charge: this.charge,
      solids: this.solids,
    });
    if (b.grounded && Math.abs(b.vx) > 120) {
      this.stepTimer -= dt * (Math.abs(b.vx) / b.p.maxRun);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.28;
        audio.step(b.groundMaterial, b.centerX, time);
        if (Math.random() < 0.5) this.fx.dust.explode(1, x - b.facing * 14, y);
      }
    }
    if (b.gliding && Math.random() < 0.4) this.fx.trail.explode(1, x - b.facing * 20, y - 60);
    this.backdrop.update(view, time);
    for (const w of this.terrain.water) {
      if (w.refl) w.refl.tilePositionX = (view.x * 0.38) / w.refl.tileScaleX;
      if (w.disp) {
        w.disp.x = 0.004 + 0.003 * Math.sin(time * 0.0021);
        w.disp.y = 0.01 + 0.006 * Math.sin(time * 0.0017 + 1);
      }
    }
    for (const v of this.terrain.platVis) {
      const def = v.s.ref!;
      if (def.fall) {
        const f = v.s._fall;
        const away = !!f && f.away > 0;
        v.img.setVisible(!away);
        if (away || !f) {
          if (!f) v.img.setPosition(v.s.x + v.ox, v.s.y + v.oy);
          continue;
        }
        const shake = f.dropping ? 0 : Math.min(1, f.stand / 0.7);
        v.img.setPosition(v.s.x + v.ox + Math.sin(time * 0.06) * 3 * shake, v.s.y + v.oy + Math.sin(time * 0.003 + v.s.x) * 2);
        v.img.setRotation(f.dropping ? Math.min(0.6, f.off / 500) * (v.s.x % 2 ? 1 : -1) : Math.sin(time * 0.002 + v.s.x) * 0.03 + Math.sin(time * 0.05) * 0.05 * shake);
        v.img.setAlpha(f.dropping ? Math.max(0, 1 - f.off / 600) : 1);
      } else if (def.blink && !def.requires) {
        const bs = blinkState(def, this.levelTime);
        v.img.setPosition(v.s.x + v.ox, v.s.y + v.oy);
        v.img.setAlpha(bs.on ? (bs.warn > 0 ? 0.55 + 0.45 * Math.round((Math.sin(time * 0.05) + 1) / 2) : 1) : 0.12);
      } else {
        v.img.setPosition(v.s.x + v.ox, v.s.y + v.oy);
        if (def.bob) v.img.setRotation(Math.sin(time * 0.0013 + v.s.x) * 0.02);
        if (v.img.getData('ghost')) v.img.setAlpha(0.14 + 0.08 * Math.sin(time * 0.004));
      }
    }
    for (const f of this.flowers) f.img.setAlpha(f.life < 0.6 ? f.life / 0.6 : 1);
    for (const p of this.projectiles) {
      p.img.setPosition(p.x, p.y);
      p.glow.setPosition(p.x, p.y);
      if (Math.random() < 0.6) this.fx.trail.explode(1, p.x, p.y);
    }
    this.boss.render(time);
    this.enemies.render(time, dt);
    for (const c of this.crystals) {
      if (c.taken) continue;
      const o = Math.sin(time * 0.003 + c.phase) * 5;
      c.img.y = c.y + o;
      c.glow!.y = c.y + o;
      c.glow!.setAlpha(0.45 + 0.2 * Math.sin(time * 0.004 + c.phase));
      c.img.scaleX = Math.abs(c.img.scaleY) * Math.cos(time * 0.002 + c.phase);
    }
    for (const s of this.stars) {
      if (s.taken) continue;
      s.img.y = s.y + Math.sin(time * 0.0025 + s.i!) * 8;
      s.glow!.y = s.img.y;
      s.img.setRotation(Math.sin(time * 0.0018 + s.i!) * 0.15);
      s.glow!.setScale(2.4 + 0.3 * Math.sin(time * 0.004));
    }
    for (const h of this.heartsItems) if (!h.taken) h.img.setScale(this.fit('heart', 46) * (1 + 0.08 * Math.sin(time * 0.008)));
    this.goalCrystal.setRotation(Math.sin(time * 0.0012) * 0.05);
    for (const s of this.swayers) {
      const d = Math.abs(s.x - x);
      if (d < 70 && Math.abs(b.vx) > 60) s.v += (b.vx / b.p.maxRun) * 0.9 * dt * 60 * (1 - d / 70) * s.amp;
      s.v += (-s.a * 90 - s.v * 7) * dt;
      s.a += s.v * dt;
      s.obj.setRotation(s.a + Math.sin(time * 0.0011 + s.phase) * s.amp * 0.35);
    }
    this.fx.update(view, dt);
    for (const h of this.hints) {
      const on = Math.abs(h.x - x) < 360 && this.phase === 'play';
      h.c.setAlpha(Phaser.Math.Linear(h.c.alpha, on ? 1 : 0, Math.min(1, dt * 6)));
      h.c.setScale(Phaser.Math.Linear(h.c.scale, on ? 1 : 0.8, Math.min(1, dt * 6)));
      h.c.y = h.y + Math.sin(time * 0.003 + h.x) * 4;
    }
    if (this.darkness) this.darkness.update(view, this.collectLights(x, y), time);
    if (this.debugGfx) this.drawDebug();
    perf.presented();
  }

  /** Sources de lumière qui percent l'obscurité. */
  private collectLights(hx: number, hy: number): Light[] {
    const out: Light[] = [{ x: hx, y: hy - this.body.p.height * 0.55, r: this.hero.power === 'light' ? 340 : 250 }];
    if (this.shieldT > 0) out.push({ x: hx, y: hy - 50, r: 300 });
    for (const c of this.checkpoints) out.push({ x: c.x, y: c.y - 110, r: c.lit ? 320 : 90 });
    for (const c of this.crystals) if (!c.taken) out.push({ x: c.x, y: c.y, r: 55 });
    for (const s of this.stars) if (!s.taken) out.push({ x: s.x, y: s.y, r: 110 });
    for (const p of this.projectiles) out.push({ x: p.x, y: p.y, r: p.pierce ? 260 : 170 });
    for (const r of this.rings) out.push({ x: r.x, y: r.y, r: 120 + r.t * 900 });
    for (const sw of this.switches) out.push({ x: sw.def.x, y: sw.def.y - 50, r: sw.on ? 260 : 80 });
    for (const e of this.enemies.list) if (e.st.alive && e.st.kind === 'flyer') out.push({ x: e.st.x, y: e.st.y, r: 90 });
    if (this.goalGlow.visible) out.push({ x: this.L.goal.x, y: this.L.goal.y - 170, r: 300 });
    return out;
  }

  private drawDebug(): void {
    const g = this.debugGfx!;
    g.clear().lineStyle(2, 0xff00ff, 1);
    for (const s of this.solids) if (!s.off) g.strokeRect(s.x, s.y, s.w, Math.min(s.h, 60));
    g.lineStyle(2, 0x00ffff, 1).strokeRect(this.body.x, this.body.y, this.body.p.width, this.body.p.height);
    g.lineStyle(2, 0xffff00, 1);
    for (const e of this.enemies.list) if (e.st.alive) {
      const r = this.enemies.rect(e);
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const u of this.updrafts) g.strokeRect(u.x, u.y, u.w, u.h);
  }

  private irisIn(): void {
    if (this.renderer.type !== Phaser.WEBGL || FLAGS.autotest) return;
    const wipe = this.cameras.main.filters.external.addWipe(0.15, 0, 0);
    wipe.setRevealEffect();
    wipe.progress = 0;
    this.tweens.add({ targets: wipe, progress: 1, duration: 900, ease: 'Sine.easeOut', onComplete: () => this.cameras.main.filters.external.remove(wipe) });
  }

  /** Pour les tests automatisés : téléporte le héros. */
  debugTeleport(x: number, y: number): void {
    this.respawnAt(x, y, true);
  }

  get secretsFound(): number {
    return this.collected.secrets;
  }

  isInside(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return contains(r, x, y);
  }
}
