import type Phaser from 'phaser';
import { mulberry32 } from './rng';

// Textures d'effets dessinées au démarrage (halos, étincelles, brouillard, rayons...).
// Elles complètent les illustrations peintes : aucune n'est utilisée comme personnage ou décor principal.

type Painter = (ctx: CanvasRenderingContext2D) => void;

export function buildFxTextures(scene: Phaser.Scene): void {
  const tex = scene.textures;
  const make = (key: string, w: number, h: number, paint: Painter) => {
    if (tex.exists(key)) return;
    const c = tex.createCanvas(key, w, h)!;
    paint(c.getContext());
    c.refresh();
  };

  make('glow', 64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });

  make('spark', 64, 64, (g) => {
    g.translate(32, 32);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    for (let i = 0; i < 2; i++) {
      g.save();
      g.rotate((i * Math.PI) / 2);
      g.beginPath();
      g.ellipse(0, 0, 31, 3.2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fill();
  });

  make('puff', 64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,248,230,0.9)');
    r.addColorStop(1, 'rgba(255,248,230,0)');
    g.fillStyle = r;
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
  });

  make('leaf', 32, 20, (g) => {
    g.fillStyle = '#e8b74a';
    g.beginPath();
    g.ellipse(16, 10, 14, 7, 0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,70,20,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(4, 13);
    g.lineTo(28, 7);
    g.stroke();
  });

  make('petal', 24, 16, (g) => {
    const r = g.createLinearGradient(0, 0, 24, 16);
    r.addColorStop(0, '#ffffff');
    r.addColorStop(1, '#e8e0ff');
    g.fillStyle = r;
    g.beginPath();
    g.ellipse(12, 8, 11, 5.5, 0.2, 0, Math.PI * 2);
    g.fill();
  });

  make('confetti', 14, 8, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 14, 8);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(7, 0, 7, 8);
  });

  make('ray', 256, 1024, (g) => {
    const v = g.createLinearGradient(0, 0, 0, 1024);
    v.addColorStop(0, 'rgba(255,236,190,0.55)');
    v.addColorStop(0.7, 'rgba(255,236,190,0.12)');
    v.addColorStop(1, 'rgba(255,236,190,0)');
    const hz = g.createLinearGradient(0, 0, 256, 0);
    hz.addColorStop(0, 'rgba(0,0,0,1)');
    hz.addColorStop(0.5, 'rgba(0,0,0,0)');
    hz.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = v;
    g.beginPath();
    g.moveTo(96, 0);
    g.lineTo(160, 0);
    g.lineTo(256, 1024);
    g.lineTo(0, 1024);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = hz;
    g.fillRect(0, 0, 256, 1024);
  });

  make('fog', 1024, 256, (g) => {
    const rnd = mulberry32(11);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * 1024;
      const y = 90 + rnd() * 80;
      const rx = 120 + rnd() * 220;
      const ry = 30 + rnd() * 40;
      const a = 0.08 + rnd() * 0.12;
      for (const off of [-1024, 0, 1024]) {
        const r = g.createRadialGradient(x + off, y, 0, x + off, y, rx);
        r.addColorStop(0, `rgba(236,246,255,${a})`);
        r.addColorStop(1, 'rgba(236,246,255,0)');
        g.save();
        g.translate(x + off, y);
        g.scale(1, ry / rx);
        g.translate(-(x + off), -y);
        g.fillStyle = r;
        g.beginPath();
        g.arc(x + off, y, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  });

  make('ripples', 256, 256, (g) => {
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const v =
          Math.sin((x / 256) * Math.PI * 4 + Math.sin((y / 256) * Math.PI * 2) * 1.5) * 0.5 +
          Math.sin((y / 256) * Math.PI * 6) * 0.5;
        const i = (y * 256 + x) * 4;
        img.data[i] = 128 + v * 60;
        img.data[i + 1] = 128 + Math.cos((y / 256) * Math.PI * 8) * 40;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });

  make('glint', 48, 6, (g) => {
    const r = g.createLinearGradient(0, 0, 48, 0);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 2, 48, 2);
  });

  make('vignette', 512, 288, (g) => {
    const r = g.createRadialGradient(256, 144, 90, 256, 144, 300);
    r.addColorStop(0, 'rgba(10,20,40,0)');
    r.addColorStop(1, 'rgba(10,20,40,0.55)');
    g.fillStyle = r;
    g.fillRect(0, 0, 512, 288);
  });

  // Anneau d'onde de choc (éclat solaire, atterrissage du boss).
  make('ring', 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 40, 64, 64, 63);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.7, 'rgba(255,255,255,0.85)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });

  // Courant d'air ascendant : traînée verticale douce.
  make('streak', 16, 128, (g) => {
    const r = g.createLinearGradient(0, 0, 0, 128);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.beginPath();
    g.ellipse(8, 64, 3, 62, 0, 0, Math.PI * 2);
    g.fill();
  });

  // Petit visage de feu follet (ennemi volant) : yeux et sourcils grognons sur un halo.
  make('wisp_face', 96, 96, (g) => {
    const r = g.createRadialGradient(48, 52, 4, 48, 52, 44);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.beginPath();
    g.arc(48, 52, 44, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a1840';
    for (const ex of [36, 60]) {
      g.beginPath();
      g.ellipse(ex, 50, 5, 7, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    for (const ex of [37.5, 61.5]) {
      g.beginPath();
      g.arc(ex, 47, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#2a1840';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(28, 38);
    g.lineTo(42, 42);
    g.moveTo(68, 38);
    g.lineTo(54, 42);
    g.moveTo(42, 64);
    g.quadraticCurveTo(48, 60, 54, 64);
    g.stroke();
  });

  // Spore (projectile du champignon cracheur).
  make('spore', 40, 40, (g) => {
    const r = g.createRadialGradient(16, 16, 2, 20, 20, 19);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.beginPath();
    g.arc(20, 20, 19, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(80,40,90,0.55)';
    for (const [x, y] of [[14, 16], [24, 13], [22, 25]]) {
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  });

  // Interrupteur-cristal (énigme) : socle de pierre sculpté.
  make('switch_base', 96, 60, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 60);
    grd.addColorStop(0, '#9b8a73');
    grd.addColorStop(1, '#4d4033');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(10, 60);
    g.lineTo(18, 18);
    g.quadraticCurveTo(48, 6, 78, 18);
    g.lineTo(86, 60);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,240,210,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(20, 22);
    g.quadraticCurveTo(48, 12, 76, 22);
    g.stroke();
    g.fillStyle = 'rgba(30,20,10,0.35)';
    for (let i = 0; i < 5; i++) g.fillRect(24 + i * 11, 34 + (i % 2) * 6, 6, 3);
  });

  // Barrière de lumière (porte fermée par une énigme).
  make('barrier', 64, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.65, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < 256; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, y, 64, 5);
    }
  });
}
