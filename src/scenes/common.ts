import type Phaser from 'phaser';
import { FLAGS, VIEW_H, VIEW_W } from '../config';
import { QUALITY, initialQuality } from '../core/quality';

// Résolution interne : 1280×720 « logiques », multipliés par RES sur les écrans denses.
export const START_QUALITY = initialQuality();
export const RES =
  FLAGS.res ??
  (START_QUALITY === 'haut' && Math.max(screen.width, screen.height) * (devicePixelRatio || 1) >= 1700 ? QUALITY.haut.renderScale : 1);

export function setupCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(RES);
  cam.centerOn(VIEW_W / 2, VIEW_H / 2);
}

/** Transition sortante en fondu, puis démarrage d'une autre scène. */
export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 500): void {
  const cam = scene.cameras.main;
  if ((scene as Phaser.Scene & { _leaving?: boolean })._leaving) return;
  (scene as Phaser.Scene & { _leaving?: boolean })._leaving = true;
  cam.fadeOut(ms, 10, 20, 30);
  cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function resetLeaving(scene: Phaser.Scene): void {
  (scene as Phaser.Scene & { _leaving?: boolean })._leaving = false;
}

/** Décalage horizontal pour centrer une mise en page conçue en 1280 de large sur une vue plus large. */
export const DESIGN_OFFSET = (VIEW_W - 1280) / 2;

/** Décale tous les objets créés après `from` (index dans la liste d'affichage) de DESIGN_OFFSET. */
export function centerDesign(scene: Phaser.Scene, from: number): void {
  if (!DESIGN_OFFSET) return;
  const list = scene.children.list;
  for (let i = from; i < list.length; i++) {
    const o = list[i] as Phaser.GameObjects.GameObject & { x?: number };
    if (typeof o.x === 'number') o.x += DESIGN_OFFSET;
  }
}
