import type { Material, PlatformDef, Rect } from '../physics/geom';

export interface Pt {
  x: number;
  y: number;
}

export interface GroundDef {
  x: number;
  w: number;
  y: number;
  material?: Material;
}

export type EnemyKind = 'beetle' | 'charger' | 'flyer' | 'spitter';

export interface EnemyDef {
  kind?: EnemyKind;
  x: number;
  /** Altitude pour les volants (centre). */
  y?: number;
  minX: number;
  maxX: number;
  speed: number;
}

export interface PropDef {
  key: string;
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  /** Premier plan (devant le héros, assombri). */
  front?: boolean;
}

export interface HintDef {
  x: number;
  y: number;
  text: string;
  icon?: string;
  /** Remplacé par la description du pouvoir du héros choisi. */
  heroPower?: boolean;
}

export interface SpringDef {
  x: number;
  y: number;
  power: number;
}

export interface UpdraftDef extends Rect {
  power: number;
}

export interface SwitchDef {
  id: string;
  x: number;
  y: number;
  /** stomp : sauter dessus ; shoot : toucher avec un pouvoir. */
  mode: 'stomp' | 'shoot';
}

export interface BarrierDef {
  id: string;
  x: number;
  y: number;
  h: number;
}

/** Zone secrète : un feuillage de premier plan la cache, il s'efface quand on y entre. */
export interface SecretDef extends Rect {
  coverKey?: string;
}

export interface Line {
  who: 'soumaya' | 'hajar' | 'zakaria' | 'hero' | 'narrator' | 'boss' | 'lumi';
  text: string;
}

export interface TalkDef {
  x: number;
  lines: Line[];
}

export type BossKind = 'charger' | 'tree' | 'pattern';

export interface BossDef {
  kind?: BossKind;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  hp: number;
  name: string;
  /** Phrase affichée à la victoire. */
  smile?: string;
  /** Pour kind 'pattern' : clé dans bosses/roster.ts. */
  pattern?: string;
  /** Hauteur affichée du boss (px). */
  displayH?: number;
}

/** Identifiant d'univers visuel (voir data/themes.ts). */
export type ThemeId = string;
export type Mood = 'day' | 'dusk' | 'night';

export interface LevelDef {
  id: string;
  name: string;
  world: number;
  theme?: ThemeId;
  mood?: Mood;
  next?: string | null;
  width: number;
  killY: number;
  spawn: Pt;
  grounds: GroundDef[];
  platforms: PlatformDef[];
  springs: SpringDef[];
  water: { x: number; w: number; y: number }[];
  crystals: Pt[];
  stars: Pt[];
  hearts: Pt[];
  chest: Pt | null;
  checkpoints: Pt[];
  enemies: EnemyDef[];
  props: PropDef[];
  hints: HintDef[];
  goal: Pt;
  walls?: Rect[];
  boss?: BossDef;
  updrafts?: UpdraftDef[];
  /** Zones de vent horizontal (force > 0 : vers la droite). */
  winds?: (Rect & { force: number })[];
  /** Zones de faible pesanteur. */
  lowGravity?: (Rect & { scale: number })[];
  /** Obscurité (0 = aucune, 1 = noir) : seules les lumières éclairent. */
  darkness?: number;
  switches?: SwitchDef[];
  barriers?: BarrierDef[];
  secrets?: SecretDef[];
  talks?: TalkDef[];
  /** Décor de fond peint propre à ce niveau (sinon celui du thème). */
  sky?: string;
  /** Cinématique jouée avant le niveau (une seule fois, puis rejouable depuis la galerie). */
  intro?: string;
  /** Cinématique jouée après la victoire. */
  outro?: string;
}
