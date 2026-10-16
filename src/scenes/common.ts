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
