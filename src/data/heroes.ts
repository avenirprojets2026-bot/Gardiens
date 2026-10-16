import { BASE_PARAMS, type BodyParams } from '../physics/body';
import type { HeroId } from '../core/save';

// Les trois gardiens. Chacun a une manière de jouer différente :
// - Soumaya : double saut, vol plané avec sa cape, étoile de lumière (maintenir = Nova chargée).
// - Hajar : la plus rapide, saute contre les murs, fait pousser une fleur-plateforme, même en l'air.
// - Zakaria : super-bond, sauts toujours assistés (il a 4 ans), éclat solaire qui repousse tout et protège.

export type PowerId = 'light' | 'flower' | 'sun';

export interface HeroDef {
  id: HeroId;
  name: string;
  age: number;
  title: string;
  tagline: string;
  color: number;
  colorCss: string;
  params: BodyParams;
  power: PowerId;
  powerName: string;
  /** Lignes affichées sur la carte de sélection. */
  traits: string[];
  /** Sauts toujours assistés, quel que soit le niveau de difficulté. */
  forceAssist: boolean;
  /** Taille affichée en jeu (px). */
  displayH: number;
  /** Petit son d'identité (hauteur de l'effet de pouvoir). */
  voiceRate: number;
}

export const HEROES: Record<HeroId, HeroDef> = {
  soumaya: {
    id: 'soumaya',
    name: 'Soumaya',
    age: 9,
    title: 'La gardienne de la lumière',
    tagline: 'Sa cape d’étoiles la fait planer au-dessus du vide.',
    color: 0xffd36b,
    colorCss: '#ffd36b',
    params: { ...BASE_PARAMS, glideFall: 150 },
    power: 'light',
    powerName: 'Étoile de lumière',
    traits: ['Double saut', 'Plane en maintenant le saut', 'Étoile de lumière — maintiens pour la Nova'],
    forceAssist: false,
    displayH: 158,
    voiceRate: 1,
  },
  hajar: {
    id: 'hajar',
    name: 'Hajar',
    age: 7,
    title: 'L’exploratrice agile',
    tagline: 'Elle grimpe partout et fait pousser des fleurs magiques.',
    color: 0x8fe36b,
    colorCss: '#8fe36b',
    params: {
      ...BASE_PARAMS,
      maxRun: 410,
      accelGround: 3300,
      jumpHeight: 190,
      airJumps: 0,
      airJumpHeight: 0,
      coyoteTime: 0.13,
      jumpBuffer: 0.15,
      wallJump: true,
    },
    power: 'flower',
    powerName: 'Fleur géante',
    traits: ['La plus rapide', 'Saute contre les murs', 'Fleur géante sous ses pieds, même en l’air'],
    forceAssist: false,
    displayH: 150,
    voiceRate: 1.15,
  },
  zakaria: {
    id: 'zakaria',
    name: 'Zakaria',
    age: 4,
    title: 'Le gardien solaire',
    tagline: 'Petit mais courageux : son soleil fait fuir les ombres.',
    color: 0xff9a5c,
    colorCss: '#ff9a5c',
    params: {
      ...BASE_PARAMS,
      maxRun: 320,
      jumpHeight: 235,
      timeToApex: 0.44,
      airJumps: 0,
      airJumpHeight: 0,
      width: 42,
      height: 92,
    },
    power: 'sun',
    powerName: 'Éclat solaire',
    traits: ['Super-bond', 'Sauts toujours assistés', 'Éclat solaire : repousse tout et protège'],
    forceAssist: true,
    displayH: 138,
    voiceRate: 0.9,
  },
};

export const HERO_ORDER: HeroId[] = ['soumaya', 'hajar', 'zakaria'];

/** Texte de l'astuce « pouvoir du héros » dans les niveaux. */
export const POWER_HINT: Record<PowerId, string> = {
  light: 'Double saut, puis maintiens pour planer',
  flower: 'Fleur magique en l’air (X)',
  sun: 'Super-bond !',
};
