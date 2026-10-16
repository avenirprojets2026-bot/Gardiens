import type Phaser from 'phaser';
import { AUDIO } from '../config';

// Directeur audio : musique et ambiance en fondu enchaîné, effets spatialisés (panoramique
// selon la position à l'écran), variations de hauteur pour éviter la répétition.

export type Bus = 'music' | 'ambience' | 'sfx';

/** Toutes les pistes connues. Une piste absente du disque est simplement ignorée. */
export const AUDIO_KEYS = [
  'music_title', 'music_forest', 'music_candy', 'music_enchanted', 'music_victory', 'music_boss',
  'music_crystal', 'music_clouds', 'music_sky', 'music_observatory', 'music_stars', 'music_shadow',
  'music_citadel', 'music_final', 'music_story',
  'amb_forest', 'amb_candy', 'amb_enchanted', 'amb_crystal', 'amb_wind', 'amb_night', 'amb_shadow',
  'sfx_jump', 'sfx_double_jump', 'sfx_land', 'sfx_crystal', 'sfx_star', 'sfx_bounce', 'sfx_stomp', 'sfx_hurt',
  'sfx_checkpoint', 'sfx_chest', 'sfx_ui_click', 'sfx_ui_hover', 'sfx_whoosh', 'sfx_power',
  'sfx_step_grass_0', 'sfx_step_grass_1', 'sfx_step_grass_2', 'sfx_step_grass_3',
  'sfx_step_wood_0', 'sfx_step_wood_1', 'sfx_step_wood_2',
  'sfx_light', 'sfx_sun', 'sfx_flower', 'sfx_charge', 'sfx_switch', 'sfx_gate', 'sfx_boss_roar', 'sfx_boss_hit',
  'sfx_wind', 'sfx_spit', 'sfx_wisp', 'sfx_secret', 'sfx_text',
] as const;

export type AudioKey = (typeof AUDIO_KEYS)[number];

export function loadAudio(scene: Phaser.Scene, available: Set<string>): void {
  for (const k of AUDIO_KEYS) {
    if (!available.has(k)) continue;
    scene.load.audio(k, [`${AUDIO}${k}.ogg`, `${AUDIO}${k}.mp3`]);
  }
}

interface Track {
  key: string;
  snd: Phaser.Sound.BaseSound & { setVolume?: (v: number) => unknown; volume?: number };
}

export interface SfxOptions {
  volume?: number;
  rate?: number;
  pitchVar?: number;
  /** Position monde : panoramique et atténuation hors écran. */
  worldX?: number;
}

class AudioDirector {
  volumes: Record<Bus, number> = { music: 0.7, ambience: 0.6, sfx: 0.9 };
  private current: Partial<Record<Bus, Track>> = {};
  private lastStep = 0;
  private listener = { x: 640, w: 1280 };
  private game?: Phaser.Game;
  private ducked = 1;

  init(game: Phaser.Game): void {
    this.game = game;
  }

  private get sound() {
    return this.game!.sound;
  }

  has(key: string): boolean {
    return !!this.game?.cache.audio.exists(key);
  }

  setVolume(bus: Bus, v: number): void {
    this.volumes[bus] = v;
    if (bus !== 'sfx') this.current[bus]?.snd.setVolume?.(v * (bus === 'music' ? this.ducked : 1));
  }

  /** Lance une piste en boucle sur un bus, en fondu enchaîné avec la précédente. */
  play(bus: 'music' | 'ambience', key: string, fadeMs = 1200, loop = true): void {
    if (!this.game) return;
    const cur = this.current[bus];
    if ((cur?.key === key && cur.snd.isPlaying) || !this.has(key)) return;
    const snd = this.sound.add(key, { loop, volume: 0 }) as Track['snd'];
    snd.play();
    this.tweenVolume(snd, this.volumes[bus] * (bus === 'music' ? this.ducked : 1), fadeMs);
    if (cur) {
      const old = cur.snd;
      this.tweenVolume(old, 0, fadeMs, () => old.destroy());
    }
    this.current[bus] = { key, snd };
  }

  /** Lance la première piste disponible parmi plusieurs (repli si une musique manque). */
  playFirst(bus: 'music' | 'ambience', keys: string[], fadeMs = 1200, loop = true): void {
    const k = keys.find((x) => this.has(x));
    if (k) this.play(bus, k, fadeMs, loop);
    else this.stop(bus, fadeMs);
  }

  stop(bus: 'music' | 'ambience', fadeMs = 800): void {
    const cur = this.current[bus];
    if (!cur) return;
    this.tweenVolume(cur.snd, 0, fadeMs, () => cur.snd.destroy());
    delete this.current[bus];
  }

  duck(level = 0.35, ms = 400): void {
    this.ducked = level;
    const m = this.current.music;
    if (m) this.tweenVolume(m.snd, this.volumes.music * level, ms);
  }

  unduck(ms = 600): void {
    this.ducked = 1;
    const m = this.current.music;
    if (m) this.tweenVolume(m.snd, this.volumes.music, ms);
  }

  setListener(x: number, w: number): void {
    this.listener = { x, w };
  }

  sfx(key: string, o: SfxOptions = {}): void {
    if (!this.has(key)) return;
    let vol = (o.volume ?? 1) * this.volumes.sfx;
    let pan = 0;
    if (o.worldX != null) {
      const rel = (o.worldX - this.listener.x) / (this.listener.w / 2);
      pan = Math.max(-1, Math.min(1, rel * 0.75));
      const beyond = Math.max(0, Math.abs(rel) - 1);
      vol *= 1 / (1 + beyond * 2.5);
    }
    if (vol < 0.01) return;
    const pv = o.pitchVar ?? 0.06;
    const rate = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * pv);
    this.sound.play(key, { volume: vol, rate, pan } as Phaser.Types.Sound.SoundConfig);
  }

  step(material: string, worldX: number, now: number): void {
    if (now - this.lastStep < 90) return;
    this.lastStep = now;
    const key =
      material === 'wood' || material === 'stone' || material === 'crystal'
        ? `sfx_step_wood_${Math.floor(Math.random() * 3)}`
        : `sfx_step_grass_${Math.floor(Math.random() * 4)}`;
    const rate = material === 'crystal' ? 1.5 : material === 'stone' ? 0.8 : material === 'cloud' ? 1.25 : 1;
    this.sfx(key, { worldX, volume: material === 'cloud' ? 0.3 : 0.55, pitchVar: 0.1, rate });
  }

  private tweenVolume(snd: Track['snd'], target: number, ms: number, done?: () => void): void {
    const from = snd.volume ?? 0;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / Math.max(ms, 1));
      const e = k * k * (3 - 2 * k);
      try {
        snd.setVolume?.(from + (target - from) * e);
      } catch {
        return;
      }
      if (k < 1) requestAnimationFrame(tick);
      else done?.();
    };
    tick();
  }
}

export const audio = new AudioDirector();
