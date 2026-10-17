import { FLAGS } from '../config';
import { saves, type Quality } from './save';

// Niveaux de qualité graphique et adaptation automatique selon le temps de rendu réel.

export type QualityLevel = Exclude<Quality, 'auto'>;

export interface QualityPreset {
  particles: number;
  filters: boolean;
  fog: boolean;
  foreground: boolean;
  renderScale: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  bas: { particles: 0.35, filters: false, fog: false, foreground: true, renderScale: 1 },
  moyen: { particles: 0.7, filters: true, fog: true, foreground: true, renderScale: 1 },
  haut: { particles: 1, filters: true, fog: true, foreground: true, renderScale: 1.5 },
};

export function initialQuality(): QualityLevel {
  if (FLAGS.quality === 'bas' || FLAGS.quality === 'moyen' || FLAGS.quality === 'haut') return FLAGS.quality;
  const q = saves.data.settings.quality;
  if (q !== 'auto') return q;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  return mobile ? (cores >= 8 ? 'moyen' : 'bas') : cores >= 4 ? 'haut' : 'moyen';
}

/** Descend d'un cran si le p95 dépasse 20 ms pendant 2 s ; remonte après 8 s sous 13 ms. */
export class AdaptiveQuality {
  private over = 0;
  private under = 0;

  constructor(
    public level: QualityLevel,
    private max: QualityLevel,
    private onChange: (q: QualityLevel) => void,
  ) {}

  update(dt: number, p95: number): void {
    const order: QualityLevel[] = ['bas', 'moyen', 'haut'];
    const i = order.indexOf(this.level);
    if (p95 > 20) {
      this.over += dt;
      this.under = 0;
    } else if (p95 < 13) {
      this.under += dt;
      this.over = 0;
    } else {
      this.over = 0;
      this.under = 0;
    }
    if (this.over > 2 && i > 0) {
      this.level = order[i - 1];
      this.over = 0;
      this.onChange(this.level);
    } else if (this.under > 8 && i < order.indexOf(this.max)) {
      this.level = order[i + 1];
      this.under = 0;
      this.onChange(this.level);
    }
  }
}
