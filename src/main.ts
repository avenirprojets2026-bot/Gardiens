import Phaser from 'phaser';
import '@fontsource/baloo-2/800.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import { IS_TOUCH_DEVICE, VIEW_H, VIEW_W } from './config';
import { BootScene } from './scenes/Boot';
import { PreloadScene } from './scenes/Preload';
import { TitleScene } from './scenes/Title';
import { HeroSelectScene } from './scenes/HeroSelect';
import { WorldMapScene } from './scenes/WorldMap';
import { LevelScene } from './scenes/Level';
import { HUDScene } from './scenes/HUD';
import { OverlayScene } from './scenes/Overlay';
import { SettingsScene } from './scenes/Settings';
import { CutsceneScene } from './scenes/Cutscene';
import { GalleryScene } from './scenes/Gallery';
import { RES } from './scenes/common';

if (IS_TOUCH_DEVICE) document.body.classList.add('touch');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W * RES,
  height: VIEW_H * RES,
  backgroundColor: '#0e1d2e',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  // panicMax court : après un retour d'onglet, on ne reste pas au ralenti plus de ~20 images.
  fps: { target: 60, smoothStep: true, panicMax: 20 },
  input: { gamepad: true, activePointers: 4 },
  audio: { disableWebAudio: false },
  scene: [BootScene, PreloadScene, TitleScene, HeroSelectScene, WorldMapScene, LevelScene, HUDScene, OverlayScene, SettingsScene, CutsceneScene, GalleryScene],
});

(window as unknown as Record<string, unknown>).__game = game;

// Mobile : le son se débloque au premier toucher ; on tente aussi le plein écran paysage.
const unlock = () => {
  const ctx = (game.sound as Phaser.Sound.WebAudioSoundManager).context;
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  if (IS_TOUCH_DEVICE && !game.scale.isFullscreen && document.fullscreenEnabled) {
    game.scale.startFullscreen();
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o?.lock?.('landscape').catch(() => {});
  }
};
window.addEventListener('pointerup', unlock, { once: true });

// Pause automatique quand l'onglet est masqué (appel, changement d'application).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  const lvl = game.scene.getScene('Level') as unknown as LevelScene | null;
  if (lvl && game.scene.isActive('Level') && lvl.phase === 'play') lvl.pause();
});

if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
