import Phaser from 'phaser';
import { audio } from '../core/audio';
import { FONT_BODY, FONT_TITLE } from '../config';

// Éléments d'interface communs : boutons dorés, panneaux parchemin, textes titrés, bulles.

export interface ButtonOptions {
  w?: number;
  h?: number;
  size?: number;
  primary?: boolean;
  /** Icône dessinée à gauche du texte (clé de texture). */
  icon?: string;
}

export type Button = Phaser.GameObjects.Container & { setSelected(v: boolean): void; label: Phaser.GameObjects.Text };

export function makeButton(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, o: ButtonOptions = {}): Button {
  const w = o.w ?? 300;
  const h = o.h ?? 70;
  const g = scene.add.graphics();
  const label = scene.add
    .text(o.icon ? 18 : 0, -2, text, { fontFamily: FONT_TITLE, fontSize: `${o.size ?? 30}px`, fontStyle: '800', color: '#fff8e6' })
    .setOrigin(0.5)
    .setStroke('#5a2d0c', 6);
  const parts: Phaser.GameObjects.GameObject[] = [g, label];
  if (o.icon && scene.textures.exists(o.icon)) {
    const ic = scene.add.image(-label.width / 2 - 8, -2, o.icon);
    ic.setScale((h * 0.62) / Math.max(ic.width, ic.height));
    parts.push(ic);
  }
  const c = scene.add.container(x, y, parts) as Button;
  c.label = label;
  let selected = false;
  let hover = false;
  const draw = () => {
    g.clear();
    const top = o.primary ? 0xffc24d : selected ? 0x7fd36a : 0xb8894a;
    const bot = o.primary ? 0xe07a1f : selected ? 0x3f9a3a : 0x7a5228;
    g.fillStyle(0x000000, 0.28).fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, h / 2);
    g.fillGradientStyle(top, top, bot, bot, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle(0xffffff, hover ? 0.28 : 0.16).fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, h * 0.38, h * 0.19);
    g.lineStyle(3, 0xfff1c2, selected || o.primary ? 1 : 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  };
  draw();
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => {
    hover = true;
    draw();
    audio.sfx('sfx_ui_hover', { volume: 0.4 });
    scene.tweens.add({ targets: c, scale: 1.05, duration: 120 });
  });
  c.on('pointerout', () => {
    hover = false;
    draw();
    scene.tweens.add({ targets: c, scale: 1, duration: 120 });
  });
  c.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
    audio.sfx('sfx_ui_click', { volume: 0.7 });
    onClick();
  });
  c.setSelected = (v: boolean) => {
    selected = v;
    draw();
  };
  return c;
}

/** Panneau parchemin à double liseré doré. */
export function makePanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, radius = 36): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(x - w / 2 + 6, y - h / 2 + 10, w, h, radius);
  g.fillGradientStyle(0xfff4dc, 0xfff4dc, 0xf3dcae, 0xf3dcae, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(6, 0xc98a3c, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20, radius - 8);
  return g;
}

/** Panneau sombre translucide (HUD, bandeaux). */
export function makeGlass(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.45): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x0b1a2a, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
  g.lineStyle(2, 0xfff1c2, 0.25).strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
  return g;
}

export function title(scene: Phaser.Scene, x: number, y: number, text: string, size = 54, color = '#fff3c8'): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT_TITLE, fontSize: `${size}px`, fontStyle: '800', color })
    .setOrigin(0.5)
    .setStroke('#5a2d0c', Math.round(size / 6))
    .setShadow(0, 5, '#000', 10, true, true);
}

export function body(scene: Phaser.Scene, x: number, y: number, text: string, size = 22, color = '#3b2a1a', weight = '600'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT_BODY, fontSize: `${size}px`, fontStyle: weight, color });
}

/** Bulle d'information (astuces en jeu, toasts). */
export function bubble(scene: Phaser.Scene, text: string, size = 26, tail = true): Phaser.GameObjects.Container {
  const t = scene.add
    .text(0, 0, text, { fontFamily: FONT_BODY, fontSize: `${size}px`, color: '#3b2a1a', fontStyle: '600', align: 'center', wordWrap: { width: 560 } })
    .setOrigin(0.5);
  const w = t.width + 46;
  const h = t.height + 26;
  const g = scene.add.graphics();
  g.fillStyle(0xfff6e0, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(26, h / 2));
  g.lineStyle(3, 0xe6b450, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(26, h / 2));
  if (tail) g.fillStyle(0xfff6e0, 0.95).fillTriangle(-10, h / 2 - 1, 10, h / 2 - 1, 0, h / 2 + 14);
  return scene.add.container(0, 0, [g, t]);
}

/** Échelle pour qu'une texture tienne dans `size` px (largeur ou hauteur). */
export function fitScale(scene: Phaser.Scene, key: string, size: number, axis: 'w' | 'h' = 'w'): number {
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  return size / (axis === 'w' ? img.width : img.height);
}
