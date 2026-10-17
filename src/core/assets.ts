import type Phaser from 'phaser';
import { ART } from '../config';
import { BASE_THEMES, THEMES } from '../data/themes';

// Manifeste des illustrations peintes (dimensions, lignes de sol des tuiles, planches d'animation).

export interface ImageMeta {
  file: string;
  w: number;
  h: number;
  /** Hauteur (px source) entre le haut de l'image et la surface praticable. */
  top?: number;
  /** Largeur praticable (px source) d'une plateforme. */
  usableW?: number;
}

export interface SheetMeta {
  file: string;
  frameW: number;
  frameH: number;
  frames: number;
  fps: number;
  loop: boolean;
  contentH?: number;
  originX?: number;
  originY?: number;
}

export interface ArtManifest {
  images: Record<string, ImageMeta>;
  sheets: Record<string, SheetMeta>;
}

/** Les versions « détaillées » (bgd_/fgd_) remplacent les couches de base quand elles existent. */
const DETAILED: Record<string, string> = { fg_top: 'fgd_top', fg_bottom: 'fgd_bottom', bg_sky: 'bgd_sky', bg_hills: 'bgd_hills' };

export function loadArt(scene: Phaser.Scene, m: ArtManifest): void {
  for (const [key, meta] of Object.entries(m.images)) {
    const [base, theme] = key.split('.');
    const d = DETAILED[base];
    // La couche de base du thème par défaut reste utile aux menus (sauf premier plan).
    if (d && (theme || base.startsWith('fg_')) && m.images[theme ? `${d}.${theme}` : d]) continue;
    scene.load.image(key, ART + meta.file);
  }
  for (const [key, s] of Object.entries(m.sheets)) {
    scene.load.spritesheet(key, ART + s.file, { frameWidth: s.frameW, frameHeight: s.frameH });
  }
}

export function createAnims(scene: Phaser.Scene, m: ArtManifest): void {
  for (const [key, s] of Object.entries(m.sheets)) {
    if (scene.anims.exists(key) || s.frames < 2) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: s.frames - 1 }),
      frameRate: s.fps,
      repeat: s.loop ? -1 : 0,
    });
  }
}

/** Clé d'illustration pour un thème : « plat_big.candy » si elle existe, sinon « plat_big ». */
export function themed(scene: Phaser.Scene, key: string, theme?: string): string {
  if (theme && theme !== 'forest' && scene.textures.exists(`${key}.${theme}`)) return `${key}.${theme}`;
  const base = THEMES[theme ?? '']?.base;
  if (base && base !== 'forest' && scene.textures.exists(`${key}.${base}`)) return `${key}.${base}`;
  return key;
}

/** Les illustrations d'un univers sont-elles chargées ? (sinon le monde reste « en construction »). */
export function artReady(scene: Phaser.Scene, theme?: string): boolean {
  if (!theme || BASE_THEMES.includes(theme) || scene.textures.exists(`bgd_sky.${theme}`)) return true;
  const sky = THEMES[theme]?.sky;
  return !!sky && scene.textures.exists(sky);
}

/** Variante détaillée d'une couche de décor si disponible. */
export function detailed(scene: Phaser.Scene, key: string, theme?: string): string {
  const d = DETAILED[key];
  if (d) {
    const k = themed(scene, d, theme);
    if (scene.textures.exists(k)) return k;
  }
  return themed(scene, key, theme);
}
