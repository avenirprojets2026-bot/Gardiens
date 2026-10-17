import { approach } from '../core/rng';
import { overlaps, type Material, type Rect, type Solid } from './geom';

// Corps du héros : déplacement à pas fixe (1/120 s), indépendant de Phaser.
// Saut à hauteur/temps d'apogée paramétrés, coyote time, jump buffer, coupure du saut,
// gravité réduite à l'apogée, correction de coin, aide au rebord, double saut,
// glissade et saut mural (Hajar), vol plané (Soumaya), courants d'air ascendants.

export const STEP = 1 / 120;

export interface BodyParams {
  maxRun: number;
  accelGround: number;
  decelGround: number;
  accelAir: number;
  decelAir: number;
  turnBoost: number;
  jumpHeight: number;
  timeToApex: number;
  fallGravityMult: number;
  apexGravityMult: number;
  apexThreshold: number;
  maxFall: number;
  jumpCut: number;
  coyoteTime: number;
  jumpBuffer: number;
  airJumps: number;
  airJumpHeight: number;
  cornerCorrection: number;
  ledgeAssist: number;
  width: number;
  height: number;
  /** Glissade et saut contre les murs. */
  wallJump?: boolean;
  /** Vitesse de chute maximale en planant (bouton saut maintenu, sauts aériens épuisés). */
  glideFall?: number;
}

export const BASE_PARAMS: BodyParams = {
  maxRun: 380,
  accelGround: 2800,
  decelGround: 3400,
  accelAir: 1900,
  decelAir: 900,
  turnBoost: 1.6,
  jumpHeight: 200,
  timeToApex: 0.4,
  fallGravityMult: 1.65,
  apexGravityMult: 0.55,
  apexThreshold: 70,
  maxFall: 1150,
  jumpCut: 0.45,
  coyoteTime: 0.1,
  jumpBuffer: 0.13,
  airJumps: 1,
  airJumpHeight: 150,
  cornerCorrection: 14,
  ledgeAssist: 10,
  width: 44,
  height: 104,
};

/** Réglages « sauts assistés » (mode facile, et toujours pour Zakaria qui a 4 ans). */
export function assisted(p: BodyParams): BodyParams {
  return {
    ...p,
    coyoteTime: 0.22,
    jumpBuffer: 0.22,
    fallGravityMult: 1.2,
    maxRun: p.maxRun * 0.85,
    ledgeAssist: 26,
    cornerCorrection: 24,
    airJumps: Math.max(p.airJumps, 1),
  };
}

export const gravityOf = (p: BodyParams) => (2 * p.jumpHeight) / (p.timeToApex * p.timeToApex);
export const jumpVelocityOf = (p: BodyParams) => (2 * p.jumpHeight) / p.timeToApex;

export interface BodyInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  down?: boolean;
}

export type BodyEvent =
  | { type: 'jump'; air: boolean }
  | { type: 'wallJump'; dir: number }
  | { type: 'land'; impact: number; material: Material }
  | { type: 'bounce'; material: Material }
  | { type: 'leaveGround' }
  | { type: 'headBump' };

export interface BodyEnv {
  /** Accélération ascendante d'un courant d'air (px/s²), 0 si aucun. */
  updraft?: number;
  /** Poussée horizontale du vent (px/s², positive vers la droite). */
  wind?: number;
  /** Multiplicateur de gravité (zones de faible pesanteur du Sanctuaire des Étoiles). */
  gravityScale?: number;
}

export class PlatformerBody {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  grounded = false;
  facing = 1;
  groundMaterial: Material = 'grass';
  /** -1 / 1 : mur touché à gauche / à droite pendant la glissade, 0 sinon. */
  wallDir = 0;
  gliding = false;
  coyote = 0;
  buffer = 0;
  jumping = false;
  airJumpsLeft: number;
  events: BodyEvent[] = [];
  gravity: number;
  jumpV: number;
  airJumpV: number;
  private wallLock = 0;
  private wallCoyote = 0;
  private lastWallDir = 0;

  constructor(public p: BodyParams, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.gravity = gravityOf(p);
    this.jumpV = jumpVelocityOf(p);
    this.airJumpV = Math.sqrt(2 * this.gravity * Math.max(0, p.airJumpHeight));
    this.airJumpsLeft = p.airJumps;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: this.p.width, h: this.p.height };
  }
  get centerX() {
    return this.x + this.p.width / 2;
  }
  get bottom() {
    return this.y + this.p.height;
  }

  step(inp: BodyInput, solids: Solid[], dt = STEP, env: BodyEnv = {}): void {
    const p = this.p;
    this.events.length = 0;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0 && this.wallLock <= 0) this.facing = dir;

    // Horizontal : accélération/décélération, demi-tour vif, glace glissante.
    const ctrl = this.wallLock > 0 ? 0.25 : 1;
    // Le vent décale la vitesse visée : porté par une rafale, ralenti face à elle.
    const target = dir * p.maxRun + (env.wind ?? 0) * 0.3;
    const ice = this.grounded && this.groundMaterial === 'ice';
    let accel: number;
    if (dir === 0) accel = (this.grounded ? p.decelGround * (ice ? 0.16 : 1) : p.decelAir) * (env.wind ? 0.5 : 1);
    else {
      accel = this.grounded ? p.accelGround * (ice ? 0.45 : 1) : p.accelAir;
      if (Math.sign(this.vx) !== 0 && Math.sign(this.vx) !== dir) accel *= p.turnBoost;
    }
    this.vx = approach(this.vx, target, accel * ctrl * dt);
    if (this.wallLock > 0) this.wallLock -= dt;

    // Fenêtres de tolérance.
    this.coyote = this.grounded ? p.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = inp.jumpPressed ? p.jumpBuffer : Math.max(0, this.buffer - dt);
    this.wallCoyote = this.wallDir !== 0 ? 0.1 : Math.max(0, this.wallCoyote - dt);
    if (this.wallDir !== 0) this.lastWallDir = this.wallDir;

    if (this.buffer > 0) {
      if (this.grounded || this.coyote > 0) {
        this.vy = -this.jumpV;
        this.grounded = false;
        this.coyote = 0;
        this.buffer = 0;
        this.jumping = true;
        this.events.push({ type: 'jump', air: false });
      } else if (p.wallJump && this.wallCoyote > 0 && this.lastWallDir !== 0) {
        const away = -this.lastWallDir;
        this.vx = away * p.maxRun * 1.15;
        this.vy = -this.jumpV * 0.93;
        this.facing = away;
        this.buffer = 0;
        this.wallCoyote = 0;
        this.wallDir = 0;
        this.wallLock = 0.16;
        this.jumping = true;
        this.airJumpsLeft = p.airJumps;
        this.events.push({ type: 'wallJump', dir: away });
      } else if (inp.jumpPressed && this.airJumpsLeft > 0) {
        this.airJumpsLeft--;
        this.vy = -this.airJumpV;
        this.buffer = 0;
        this.jumping = true;
        this.events.push({ type: 'jump', air: true });
      }
    }

    // Saut à hauteur variable : relâcher le bouton coupe la montée.
    if (this.jumping && !inp.jump && this.vy < 0) {
      this.vy *= p.jumpCut;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    let g = this.gravity;
    if (!this.grounded) {
      if (Math.abs(this.vy) < p.apexThreshold && inp.jump) g *= p.apexGravityMult;
      else if (this.vy > 0) g *= p.fallGravityMult;
    }
    this.vy += g * (env.gravityScale ?? 1) * dt;
    if (env.updraft) this.vy = Math.max(-620, this.vy - env.updraft * dt);

    // Glissade murale et vol plané limitent la vitesse de chute.
    let maxFall = p.maxFall;
    this.gliding = false;
    if (!this.grounded && this.vy > 0) {
      if (p.wallJump && this.wallDir !== 0 && dir === this.wallDir) maxFall = 170;
      else if (p.glideFall && inp.jump && this.airJumpsLeft === 0) {
        maxFall = p.glideFall;
        this.gliding = true;
      }
    }
    this.vy = Math.min(this.vy, maxFall);

    // Intégration en sous-pas pour ne jamais traverser une plateforme fine.
    const wasGrounded = this.grounded;
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    this.grounded = false;
    for (let i = 0; i < n; i++) {
      this.moveX(dx / n, solids);
      this.moveY(dy / n, solids);
    }

    // Collage au sol en descente de pente/plateforme mobile.
    if (!this.grounded && wasGrounded && this.vy >= 0) {
      const probe = { x: this.x, y: this.y + 2, w: p.width, h: p.height };
      for (const s of solids) {
        if (s.off) continue;
        if (overlaps(probe, s) && this.bottom <= s.y + 2) {
          this.y = s.y - p.height;
          this.grounded = true;
          this.vy = 0;
          break;
        }
      }
    }

    // Contact mural (pour la glissade), uniquement en l'air.
    this.wallDir = 0;
    if (p.wallJump && !this.grounded) {
      if (this.blockedAt(this.x + 2, this.y, solids)) this.wallDir = 1;
      else if (this.blockedAt(this.x - 2, this.y, solids)) this.wallDir = -1;
    }

    if (wasGrounded && !this.grounded) this.events.push({ type: 'leaveGround' });
    if (this.grounded) this.airJumpsLeft = p.airJumps;
  }

  private moveX(dx: number, solids: Solid[]): void {
    if (dx === 0) return;
    this.x += dx;
    const r = this.rect;
    for (const s of solids) {
      if (s.off || s.oneWay || !overlaps(r, s)) continue;
      const step = this.bottom - s.y;
      if (!this.grounded && this.vy >= -50 && step > 0 && step <= this.p.ledgeAssist) {
        // Aide au rebord : on monte la marche au lieu de buter.
        this.y = s.y - this.p.height;
      } else {
        this.x = dx > 0 ? s.x - this.p.width : s.x + s.w;
        this.vx = 0;
        r.x = this.x;
      }
    }
  }

  private moveY(dy: number, solids: Solid[]): void {
    if (dy === 0) return;
    const prevBottom = this.bottom;
    const prevTop = this.y;
    this.y += dy;
    for (const s of solids) {
      if (s.off) continue;
      const r = this.rect;
      if (!overlaps(r, s)) continue;
      if (dy > 0) {
        if (s.oneWay && prevBottom > s.y + 4) continue;
        this.y = s.y - this.p.height;
        const impact = this.vy;
        if (s.bounce) {
          this.vy = -s.bounce;
          this.airJumpsLeft = this.p.airJumps;
          this.events.push({ type: 'bounce', material: s.material ?? 'mushroom' });
          return;
        }
        this.vy = 0;
        if (!this.grounded) {
          this.grounded = true;
          this.groundMaterial = s.material ?? 'grass';
          if (impact > 200) this.events.push({ type: 'land', impact, material: this.groundMaterial });
        }
      } else {
        if (s.oneWay) continue;
        // Correction de coin : on glisse sur le côté au lieu de se cogner la tête.
        const cc = this.p.cornerCorrection;
        const overRight = r.x + r.w - s.x;
        const overLeft = s.x + s.w - r.x;
        if (prevTop >= s.y + s.h - 0.01) {
          if (overRight > 0 && overRight <= cc && !this.blockedAt(this.x - overRight, this.y, solids)) {
            this.x -= overRight;
            continue;
          }
          if (overLeft > 0 && overLeft <= cc && !this.blockedAt(this.x + overLeft, this.y, solids)) {
            this.x += overLeft;
            continue;
          }
        }
        this.y = s.y + s.h;
        this.vy = 0;
        this.jumping = false;
        this.events.push({ type: 'headBump' });
      }
    }
  }

  blockedAt(x: number, y: number, solids: Solid[]): boolean {
    const r = { x, y, w: this.p.width, h: this.p.height };
    return solids.some((s) => !s.off && !s.oneWay && overlaps(r, s));
  }
}
