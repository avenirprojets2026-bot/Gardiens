import Phaser from 'phaser';
import { perf } from '../core/perf';

// Entrées unifiées : clavier (flèches, ZQSD/WASD), manette, boutons tactiles.
// Les appuis brefs sont mis en file pour ne jamais être perdus entre deux pas physiques.

export interface InputFrame {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  power: boolean;
  /** Bouton pouvoir maintenu (attaque chargée). */
  powerHeld: boolean;
  powerReleased: boolean;
  pause: boolean;
}

export class InputHub {
  touch = { left: false, right: false, jump: false, power: false };
  lastDevice: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private jumpQueue = 0;
  private powerQueue = 0;
  private powerUpQueue = 0;
  private pauseQueue = 0;
  private padPrev = { jump: false, power: false, start: false };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const bind = (name: string, codes: number[]) => (this.keys[name] = codes.map((c) => kb.addKey(c, true, false)));
    bind('left', [K.LEFT, K.Q, K.A]);
    bind('right', [K.RIGHT, K.D]);
    bind('down', [K.DOWN, K.S]);
    bind('jump', [K.SPACE, K.UP, K.Z, K.W]);
    bind('power', [K.X, K.SHIFT, K.E, K.K]);
    for (const k of this.keys.jump) k.on('down', (_k: unknown, ev?: KeyboardEvent) => this.pressJump(ev?.timeStamp));
    for (const k of this.keys.power) {
      k.on('down', () => {
        this.powerQueue++;
        this.lastDevice = 'keyboard';
      });
      k.on('up', () => this.powerUpQueue++);
    }
    kb.addKey(K.ESC).on('down', () => this.pauseQueue++);
    kb.addKey(K.P).on('down', () => this.pauseQueue++);
  }

  pressJump(t?: number): void {
    this.jumpQueue++;
    perf.markInput(t ?? performance.now());
  }
  pressPower(): void {
    this.powerQueue++;
  }
  releasePower(): void {
    this.powerUpQueue++;
  }
  pressPause(): void {
    this.pauseQueue++;
  }

  private down(name: string): boolean {
    return this.keys[name].some((k) => k.isDown);
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    return gp && gp.total > 0 ? gp.getPad(0) : null;
  }

  sample(): InputFrame {
    const pad = this.pad();
    let pl = false, pr = false, pd = false, pj = false, pp = false, ps = false;
    if (pad) {
      const sx = pad.leftStick.x;
      pl = pad.left || sx < -0.35;
      pr = pad.right || sx > 0.35;
      pd = pad.down || pad.leftStick.y > 0.6;
      pj = !!(pad.A || pad.B);
      pp = !!(pad.X || pad.Y || pad.R1 || pad.R2 > 0.5);
      ps = (pad as unknown as { buttons?: { pressed: boolean }[] }).buttons?.[9]?.pressed ?? false;
      if (pj && !this.padPrev.jump) {
        this.pressJump();
        this.lastDevice = 'gamepad';
      }
      if (pp && !this.padPrev.power) this.powerQueue++;
      if (!pp && this.padPrev.power) this.powerUpQueue++;
      if (ps && !this.padPrev.start) this.pauseQueue++;
      this.padPrev = { jump: pj, power: pp, start: ps };
      if (pl || pr) this.lastDevice = 'gamepad';
    }
    return {
      left: this.down('left') || pl || this.touch.left,
      right: this.down('right') || pr || this.touch.right,
      down: this.down('down') || pd,
      jump: this.down('jump') || pj || this.touch.jump,
      jumpPressed: this.jumpQueue > 0,
      power: this.powerQueue > 0,
      powerHeld: this.down('power') || pp || this.touch.power,
      powerReleased: this.powerUpQueue > 0,
      pause: this.pauseQueue > 0,
    };
  }

  consume(): void {
    this.jumpQueue = 0;
    this.powerQueue = 0;
    this.powerUpQueue = 0;
    this.pauseQueue = 0;
  }
}
