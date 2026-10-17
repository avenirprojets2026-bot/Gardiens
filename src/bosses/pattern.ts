import { clamp, lcg } from '../core/rng';
import type { Acorn, BossEvent, BossLogic, Wave } from './types';

// Boss à motifs : une file d'attaques par phase, entrecoupée de moments de fatigue où le boss
// baisse la garde (vulnérable). Toutes les attaques sont annoncées (télégraphes) et lisibles
// par un enfant : ombre au sol avant une chute, colonne lumineuse avant un rayon, tremblement
// avant une charge.

export type Attack = 'charge' | 'hop' | 'rain' | 'wave' | 'swoop' | 'beam' | 'shots';

export interface Beam {
  x: number;
  w: number;
  t: number;
  /** Durée d'avertissement avant que le rayon ne fasse mal. */
  warn: number;
  active: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export interface PatternConfig {
  /** Attaques par phase (index = coups déjà reçus). La dernière liste sert aux phases suivantes. */
  phases: Attack[][];
  /** Fatigue (vulnérable) après tant d'attaques. */
  tiredEvery: number;
  tiredTime: number;
  /** Le boss vole (piqués, pluie depuis le ciel). */
  flying?: boolean;
  hoverY?: number;
  w: number;
  h: number;
  speed: number;
  /** Nombre d'objets d'une pluie (+2 par phase). */
  rainCount?: number;
  seed?: number;
}

type State = 'intro' | 'move' | Attack | 'windup' | 'tired' | 'hurt' | 'defeated' | 'recover';

export class PatternBoss implements BossLogic {
  state: State = 'intro';
  t = 0;
  vy = 0;
  dir = -1;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  waves: Wave[] = [];
  acorns: Acorn[] = [];
  beams: Beam[] = [];
  shots: Shot[] = [];
  events: BossEvent[] = [];
  /** Attaque en préparation (pour le rendu du télégraphe). */
  pending: Attack | null = null;
  private attacks = 0;
  private cursor = 0;
  private rng: () => number;
  private targetX = 0;
  private swoopX = 0;

  constructor(x: number, public groundY: number, public minX: number, public maxX: number, hp: number, public cfg: PatternConfig) {
    this.x = x;
    this.y = cfg.flying ? groundY - (cfg.hoverY ?? 320) : groundY;
    this.hp = hp;
    this.maxHp = hp;
    this.rng = lcg(cfg.seed ?? 5);
  }

  get phase() {
    return this.maxHp - this.hp;
  }
  get vulnerable() {
    return this.state === 'tired';
  }
  get dangerous() {
    return this.state === 'charge' || this.state === 'hop' || this.state === 'swoop' || (this.state === 'windup' && this.pending === 'charge');
  }
  get solidBody() {
    return !this.cfg.flying && (this.state === 'move' || this.state === 'rain' || this.state === 'beam' || this.state === 'shots');
  }
  get rect() {
    const h = this.state === 'tired' || this.state === 'hurt' ? this.cfg.h * 0.62 : this.cfg.h;
    return { x: this.x - this.cfg.w / 2, y: this.y - h, w: this.cfg.w, h };
  }

  private go(s: State) {
    this.state = s;
    this.t = 0;
  }

  private nextAttack(): Attack {
    const list = this.cfg.phases[Math.min(this.phase, this.cfg.phases.length - 1)];
    const a = list[this.cursor % list.length];
    this.cursor++;
    return a;
  }

  private lo() {
    return this.minX + this.cfg.w / 2;
  }
  private hi() {
    return this.maxX - this.cfg.w / 2;
  }

  update(dt: number, targetX: number): void {
    this.events.length = 0;
    this.t += dt;
    this.targetX = targetX;
    const ph = this.phase;
    const hover = this.groundY - (this.cfg.hoverY ?? 320);
    switch (this.state) {
      case 'intro':
        if (this.t > 1.8) {
          this.events.push('roar');
          this.go('move');
        }
        break;
      case 'move': {
        // Se rapproche du héros sans le coller, puis choisit une attaque.
        const want = clamp(targetX + (this.x > targetX ? 260 : -260), this.lo(), this.hi());
        this.dir = targetX < this.x ? -1 : 1;
        this.x += clamp(want - this.x, -1, 1) * Math.min(Math.abs(want - this.x), (this.cfg.speed + 20 * ph) * dt);
        if (this.cfg.flying) this.y += (hover + Math.sin(this.t * 2.4) * 18 - this.y) * Math.min(1, dt * 3);
        if (this.t > 1.4 - 0.25 * ph) {
          if (this.attacks > 0 && this.attacks % this.cfg.tiredEvery === 0 && this.pending !== null) {
            this.pending = null;
            this.events.push('tired');
            this.go(this.cfg.flying ? 'recover' : 'tired');
            break;
          }
          this.pending = this.nextAttack();
          this.events.push('windup');
          this.go('windup');
        }
        break;
      }
      case 'windup':
        this.dir = targetX < this.x ? -1 : 1;
        if (this.t > 0.9 - 0.12 * ph) {
          const a = this.pending!;
          this.attacks++;
          this.startAttack(a);
        }
        break;
      case 'charge':
        this.x += this.dir * (470 + 80 * ph) * dt;
        if (this.x <= this.lo() || this.x >= this.hi()) {
          this.x = clamp(this.x, this.lo(), this.hi());
          this.events.push('bonk');
          this.pending = null;
          this.go('tired');
        }
        break;
      case 'hop':
        this.vy += 2200 * dt;
        this.y += this.vy * dt;
        this.x = clamp(this.x + this.dir * 160 * dt, this.lo(), this.hi());
        if (this.y >= this.groundY && this.vy > 0) {
          this.y = this.groundY;
          this.vy = 0;
          this.events.push('land');
          this.waves.push({ x: this.x - this.cfg.w / 2, dir: -1, life: 2.4 }, { x: this.x + this.cfg.w / 2, dir: 1, life: 2.4 });
          this.go('move');
        }
        break;
      case 'swoop': {
        // Plane au-dessus du point visé (ombre au sol), puis pique.
        if (this.t < 1.0) {
          this.x += clamp(this.swoopX - this.x, -1, 1) * Math.min(Math.abs(this.swoopX - this.x), 520 * dt);
          this.y += (hover - 60 - this.y) * Math.min(1, dt * 4);
        } else {
          this.vy = Math.min(1400, this.vy + 3600 * dt);
          this.y += this.vy * dt;
          if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.vy = 0;
            this.events.push('land');
            this.waves.push({ x: this.x - this.cfg.w / 2, dir: -1, life: 1.8 }, { x: this.x + this.cfg.w / 2, dir: 1, life: 1.8 });
            this.pending = null;
            this.go('tired');
          }
        }
        break;
      }
      case 'rain':
      case 'shots':
      case 'beam':
      case 'wave':
        if (this.cfg.flying) this.y += (hover + Math.sin(this.t * 2.4) * 18 - this.y) * Math.min(1, dt * 3);
        if (this.t > 1.2 && this.acorns.length === 0 && this.beams.length === 0 && this.shots.length === 0) this.go('move');
        break;
      case 'recover':
        // Un boss volant se pose pour souffler (vulnérable une fois au sol).
        this.vy = Math.min(900, this.vy + 2000 * dt);
        this.y = Math.min(this.groundY, this.y + this.vy * dt);
        if (this.y >= this.groundY) {
          this.vy = 0;
          this.go('tired');
        }
        break;
      case 'tired':
        if (this.t > this.cfg.tiredTime - 0.35 * ph) {
          this.events.push('windup');
          this.go('move');
        }
        break;
      case 'hurt':
        if (this.t > 1) this.go(this.hp <= 0 ? 'defeated' : 'move');
        break;
    }
    if (this.state !== 'tired' && this.state !== 'hurt' && this.state !== 'defeated' && this.state !== 'recover' && this.state !== 'hop' && this.state !== 'swoop' && !this.cfg.flying)
      this.y = this.groundY;
    this.stepHazards(dt);
  }

  private startAttack(a: Attack): void {
    const ph = this.phase;
    this.pending = a;
    switch (a) {
      case 'charge':
        this.events.push('charge');
        this.go('charge');
        break;
      case 'hop':
        this.vy = -820;
        this.go('hop');
        break;
      case 'swoop':
        this.swoopX = clamp(this.targetX, this.lo(), this.hi());
        this.vy = 0;
        this.events.push('charge');
        this.go('swoop');
        break;
      case 'rain': {
        const n = (this.cfg.rainCount ?? 3) + ph * 2;
        for (let i = 0; i < n; i++) {
          const ax = clamp(this.targetX + (this.rng() - 0.5) * 420, this.minX + 40, this.maxX - 40);
          this.acorns.push({ x: ax, y: this.groundY - 720, vy: 0, delay: 0.3 + i * (0.4 - 0.05 * ph), landed: false });
        }
        this.go('rain');
        break;
      }
      case 'wave':
        this.events.push('charge');
        for (let i = 0; i < 1 + Math.min(ph, 2); i++)
          this.waves.push({ x: this.x + (this.targetX < this.x ? -1 : 1) * (this.cfg.w / 2 + i * 240), dir: this.targetX < this.x ? -1 : 1, life: 5 });
        this.go('wave');
        break;
      case 'beam': {
        const n = 2 + ph;
        const span = this.maxX - this.minX;
        const offset = this.rng();
        for (let i = 0; i < n; i++) {
          const bx = this.minX + ((i + offset) / n) * span;
          this.beams.push({ x: bx, w: 110, t: 0, warn: 1.1 - 0.1 * ph, active: 0.5 });
        }
        // Un rayon vise toujours le héros, pour qu'il doive bouger.
        this.beams.push({ x: this.targetX - 55, w: 110, t: -0.35, warn: 1.1 - 0.1 * ph, active: 0.5 });
        this.go('beam');
        break;
      }
      case 'shots': {
        const n = 2 + ph;
        for (let i = 0; i < n; i++) {
          const dx = this.targetX - this.x + (i - (n - 1) / 2) * 150;
          const flight = 1.1;
          this.shots.push({ x: this.x, y: this.y - this.cfg.h * 0.7, vx: clamp(dx / flight, -520, 520), vy: -700 + i * 30, alive: true });
        }
        this.events.push('charge');
        this.go('shots');
        break;
      }
    }
  }

  private stepHazards(dt: number): void {
    for (const a of this.acorns) {
      if (a.delay > 0) a.delay -= dt;
      else {
        a.vy += 1500 * dt;
        a.y += a.vy * dt;
        if (a.y >= this.groundY - 18) {
          a.landed = true;
          this.events.push('land');
        }
      }
    }
    this.acorns = this.acorns.filter((a) => !a.landed);
    for (const w of this.waves) {
      w.x += w.dir * (380 + 40 * this.phase) * dt;
      w.life -= dt;
    }
    this.waves = this.waves.filter((w) => w.life > 0 && w.x > this.minX && w.x < this.maxX);
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < b.warn + b.active);
    for (const s of this.shots) {
      s.vy += 1100 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > this.groundY - 8) s.alive = false;
    }
    this.shots = this.shots.filter((s) => s.alive);
  }

  /** Le rayon fait-il mal à cette abscisse ? */
  beamHits(x: number): boolean {
    return this.beams.some((b) => b.t >= b.warn && x > b.x && x < b.x + b.w);
  }

  stomped(): boolean {
    if (this.state !== 'tired') {
      this.events.push('bounceOff');
      return false;
    }
    this.hp--;
    this.events.push('hit');
    this.acorns = [];
    this.beams = [];
    this.shots = [];
    if (this.hp <= 0) {
      this.events.push('defeated');
      this.waves = [];
    }
    this.go('hurt');
    return true;
  }
}
