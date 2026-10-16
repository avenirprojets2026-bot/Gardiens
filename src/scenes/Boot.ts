import Phaser from 'phaser';
import { audio } from '../core/audio';
import { perf } from '../core/perf';
import { saves } from '../core/save';
import { buildFxTextures } from '../core/textures';

// Démarrage : manifestes, polices, textures d'effets, puis écran de chargement.

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    perf.startLoad('total');
    this.load.json('manifest', 'assets/art/manifest.json');
    this.load.json('audioManifest', 'assets/audio/manifest.json');
  }

  async create(): Promise<void> {
    audio.init(this.game);
    const s = saves.data.settings;
    audio.volumes = { music: s.music, ambience: s.ambience, sfx: s.sfx };
    buildFxTextures(this);
    try {
      await Promise.race([
        Promise.all(['800 40px "Baloo 2"', '400 20px Fredoka', '600 20px Fredoka'].map((f) => document.fonts.load(f))),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* polices de secours */
    }
    this.registry.set('manifest', this.cache.json.get('manifest') ?? { images: {}, sheets: {} });
    this.registry.set('audioTracks', new Set<string>(this.cache.json.get('audioManifest')?.tracks ?? []));
    document.getElementById('boot')?.remove();
    this.scene.start('Preload');
  }
}
