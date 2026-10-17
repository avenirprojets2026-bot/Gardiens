// Caméra de plateforme : anticipation dans le sens de la course, zone morte, suivi vertical
// seulement à l'atterrissage (ou si le héros sort des marges), tremblements amortis, zoom « punch ».

export interface CameraParams {
  viewW: number;
  viewH: number;
  lookAhead: number;
  lookAheadSpeed: number;
  deadZoneX: number;
  followX: number;
  followY: number;
  screenY: number;
  airTopMargin: number;
  airBottomMargin: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface CameraTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  grounded: boolean;
}

export class CameraRig {
  x = 0;
  y = 0;
  look = 0;
  groundY = 0;
  offX = 0;
  offY = 0;
  zoomPunch = 0;
  /** Point d'intérêt temporaire (arène de boss, cinématique) : la caméra s'y centre. */
  focus: { x: number; y: number; weight: number } | null = null;
  private shakeT = 0;
  private shakeAmp = 0;
  private shakeDur = 0;
  shakeScale = 1;

  constructor(public p: CameraParams) {}

  snap(t: CameraTarget): void {
    this.look = t.facing * this.p.lookAhead;
    this.x = t.x + this.look;
    this.groundY = t.y;
    this.y = t.y - (this.p.screenY - 0.5) * this.p.viewH;
    this.clamp();
  }

  shake(amp: number, dur: number): void {
    amp *= this.shakeScale;
    if (amp <= 0) return;
    if (amp >= this.shakeAmp * (1 - this.shakeT / Math.max(this.shakeDur, 1e-6))) {
      this.shakeAmp = amp;
      this.shakeDur = dur;
      this.shakeT = 0;
    }
  }

  update(t: CameraTarget, dt: number, now: number): void {
    const p = this.p;
    const wantLook = t.facing * p.lookAhead * (Math.abs(t.vx) > 40 ? 1 : 0.6);
    this.look += (wantLook - this.look) * (1 - Math.exp(-p.lookAheadSpeed * dt));
    let tx = t.x + this.look;
    if (this.focus) tx = tx + (this.focus.x - tx) * this.focus.weight;
    let d = tx - this.x;
    d = Math.abs(d) < p.deadZoneX ? 0 : d - Math.sign(d) * p.deadZoneX;
    this.x += d * (1 - Math.exp(-p.followX * dt));

    if (t.grounded) this.groundY = t.y;
    else {
      const top = this.y - p.viewH / 2 + p.airTopMargin;
      const bottom = this.y + p.viewH / 2 - p.airBottomMargin;
      if (t.y < top || t.y > bottom) this.groundY = t.y;
    }
    let ty = this.groundY - (p.screenY - 0.5) * p.viewH;
    if (this.focus) ty = ty + (this.focus.y - ty) * this.focus.weight;
    const rate = t.grounded ? p.followY : p.followY * 0.6;
    this.y += (ty - this.y) * (1 - Math.exp(-rate * dt));
    this.clamp();

    this.offX = 0;
    this.offY = 0;
    if (this.shakeT < this.shakeDur) {
      this.shakeT += dt;
      const k = 1 - this.shakeT / this.shakeDur;
      const a = this.shakeAmp * k * k;
      this.offX = (Math.sin(now * 0.061) + Math.sin(now * 0.137)) * 0.5 * a;
      this.offY = (Math.sin(now * 0.079 + 1.3) + Math.sin(now * 0.113)) * 0.5 * a;
    }
    this.zoomPunch *= Math.exp(-6 * dt);
  }

  clamp(): void {
    const { bounds: b, viewW, viewH } = this.p;
    this.x = Math.min(Math.max(this.x, b.minX + viewW / 2), b.maxX - viewW / 2);
    this.y = Math.min(Math.max(this.y, b.minY + viewH / 2), b.maxY - viewH / 2);
  }
}
