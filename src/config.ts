// Constantes globales et options passées par l'URL (?level=2-1&hero=hajar&autotest&debug).

export const VIEW_W = 1280;
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
