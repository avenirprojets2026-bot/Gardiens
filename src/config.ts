// Constantes globales et options passées par l'URL (?level=2-1&hero=hajar&autotest&debug).

/**
 * Largeur logique : 1280 en 16:9, élargie jusqu'à 1600 sur les écrans plus larges (téléphones
 * 19,5:9) pour montrer plus de décor au lieu de bandes noires. Fixée au démarrage.
 */
function computeViewW(): number {
  if (typeof window === 'undefined') return 1280;
  const w = Math.max(window.innerWidth, window.innerHeight);
  const h = Math.min(window.innerWidth, window.innerHeight) || 1;
  const want = Math.min(1600, Math.max(1280, 720 * (w / h)));
  return Math.round(want / 2) * 2;
}
export const VIEW_W = computeViewW();
export const VIEW_H = 720;
export const ART = 'assets/art/';
export const AUDIO = 'assets/audio/';

export const FONT_TITLE = '"Baloo 2", Fredoka, sans-serif';
export const FONT_BODY = 'Fredoka, sans-serif';

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const FLAGS = {
  debug: params.has('debug'),
  /** Démarre directement un niveau, sans menus ni cinématiques ; pas de temps réel (pas fixe 1/60). */
  autotest: params.has('autotest'),
  level: params.get('level') ?? '1-1',
  hero: params.get('hero'),
  scene: params.get('scene'),
  res: params.has('res') ? Number(params.get('res')) : null,
  noCutscenes: params.has('nocine'),
  /** Force une qualité graphique (bas | moyen | haut), utile pour les tests. */
  quality: params.get('q'),
};

export const IS_TOUCH_DEVICE =
  typeof navigator !== 'undefined' &&
  (navigator.maxTouchPoints > 0 || 'ontouchstart' in globalThis);
