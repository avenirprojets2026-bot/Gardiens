import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../config';

// Obscurité du Royaume des Ombres : un voile sombre couvre l'écran, percé par les lumières
// (le héros, les lanternes allumées, les cristaux, les sorts). Soumaya éclaire plus loin.

export interface Light {
  x: number;
  y: number;
  r: number;
}

export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, private amount: number, private color = 0x07041a) {
    this.rt = scene.add.renderTexture(0, 0, VIEW_W, VIEW_H).setOrigin(0, 0).setDepth(55);
    this.brush = scene.make.image({ key: 'glow' } as Phaser.Types.GameObjects.Sprite.SpriteConfig, false);
  }

  update(view: Phaser.Geom.Rectangle, lights: Light[], time: number): void {
    const rt = this.rt;
    rt.setPosition(view.x, view.y).setDisplaySize(view.width, view.height);
    const sx = VIEW_W / view.width;
    const sy = VIEW_H / view.height;
    rt.clear();
    rt.fill(this.color, this.amount);
    for (const l of lights) {
      const x = (l.x - view.x) * sx;
      const y = (l.y - view.y) * sy;
      if (x < -l.r || x > VIEW_W + l.r || y < -l.r || y > VIEW_H + l.r) continue;
      // Deux passes : cœur net + halo doux, avec un léger scintillement.
      const flick = 1 + 0.03 * Math.sin(time * 0.006 + l.x);
      this.brush.setScale(((l.r * 2) / 64) * flick).setAlpha(0.9);
      rt.erase(this.brush, x, y);
      this.brush.setScale((l.r / 64) * flick).setAlpha(1);
      rt.erase(this.brush, x, y);
    }
    rt.render();
  }

  destroy(): void {
    this.rt.destroy();
    this.brush.destroy();
  }
}
