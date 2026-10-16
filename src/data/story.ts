import type { Line, ThemeId } from './types';

// Cinématiques en moteur : décor peint en parallaxe, personnages qui entrent en scène,
// dialogues courts lus au rythme de l'enfant. Toujours passables.

export interface Actor {
  key: string;
  /** Position relative à l'écran (0-1). */
  x: number;
  flip?: boolean;
  /** Hauteur affichée (px). */
  h?: number;
  /** Entrée depuis le côté. */
  enter?: 'left' | 'right' | 'fade' | 'drop';
  glow?: number;
}

export interface Shot {
  theme?: ThemeId;
  mood?: 'day' | 'dusk' | 'night';
  /** Image plein écran (ex. carte) à la place du décor en parallaxe. */
  image?: string;
  actors: Actor[];
  lines: Line[];
  /** Sens du lent travelling de caméra. */
  pan?: number;
  /** Effet spécial du plan. */
  fx?: 'shatter' | 'crystals' | 'dawn' | 'sparkles' | 'gloom';
  /** Afficher la luciole Lumi. */
  lumi?: boolean;
}

export interface Cutscene {
  id: string;
  title: string;
  music?: string;
  shots: Shot[];
}

const S = 'soumaya', H = 'hajar', Z = 'zakaria';

export const CUTSCENES: Record<string, Cutscene> = {
  intro: {
    id: 'intro',
    title: 'Le Grand Cristal',
    music: 'music_story',
    shots: [
      {
        image: 'worldmap',
        actors: [],
        fx: 'sparkles',
        lines: [
          { who: 'narrator', text: 'Au-delà des collines, dix mondes magiques brillaient grâce au Grand Cristal.' },
          { who: 'narrator', text: 'Mais une nuit, la Fileuse d’Ombre a tissé un grand voile gris…' },
        ],
      },
      {
        image: 'worldmap',
        actors: [],
        fx: 'shatter',
        lines: [
          { who: 'narrator', text: 'Le Grand Cristal s’est brisé en mille éclats, et les mondes se sont endormis.' },
          { who: 'narrator', text: 'Leurs gardiens sont devenus tout ronchons.' },
        ],
      },
      {
        theme: 'forest',
        mood: 'dusk',
        pan: 1,
        lumi: true,
        actors: [
          { key: H, x: 0.24, enter: 'left', h: 470 },
          { key: S, x: 0.5, enter: 'fade', h: 520, glow: 0xffd36b },
          { key: Z, x: 0.76, enter: 'right', h: 420, flip: true },
        ],
        lines: [
          { who: 'lumi', text: 'Soumaya, Hajar, Zakaria ! Vous seuls pouvez rallumer les cristaux !' },
          { who: 'soumaya', text: 'Ma cape d’étoiles est prête.' },
          { who: 'hajar', text: 'Et moi, je connais tous les sentiers de la forêt !' },
          { who: 'zakaria', text: 'Moi j’ai le soleil dans les mains ! Et mon lion en peluche.' },
          { who: 'lumi', text: 'Alors en route, Gardiens ! Chaque cristal ramène un peu de lumière.' },
        ],
      },
    ],
  },
  world1_end: {
    id: 'world1_end',
    title: 'La forêt se réveille',
    music: 'music_story',
    shots: [
      {
        theme: 'forest',
        mood: 'day',
        pan: -1,
        lumi: true,
        fx: 'dawn',
        actors: [
          { key: 'boss_happy', x: 0.72, enter: 'fade', h: 300, flip: true },
          { key: 'hero', x: 0.3, enter: 'left', h: 460 },
        ],
        lines: [
          { who: 'boss', text: 'Oh… j’avais une épine d’ombre coincée dans ma carapace. Merci !' },
          { who: 'hero', text: 'Tu es beaucoup plus gentil quand tu souris, Roi Ronchon.' },
          { who: 'lumi', text: 'Le premier cristal brille ! Le Royaume des Bonbons nous attend.' },
        ],
      },
    ],
  },
  world2: {
    id: 'world2',
    title: 'Le Royaume des Bonbons',
    shots: [
      {
        theme: 'candy',
        mood: 'day',
        pan: 1,
        lumi: true,
        actors: [{ key: 'hero', x: 0.35, enter: 'left', h: 460 }],
        lines: [
          { who: 'hero', text: 'Tout est en sucre ! Même les nuages sentent la barbe à papa.' },
          { who: 'lumi', text: 'Attention, le sucre glacé fait glisser. Et le Gâteau Grognon déteste partager…' },
        ],
      },
    ],
  },
  world2_end: {
    id: 'world2_end',
    title: 'Une part pour chacun',
    shots: [
      {
        theme: 'candy',
        mood: 'dusk',
        lumi: true,
        fx: 'dawn',
        actors: [
          { key: 'boss_happy.candy', x: 0.72, enter: 'fade', h: 320, flip: true },
          { key: 'hero', x: 0.3, enter: 'left', h: 460 },
        ],
        lines: [
          { who: 'boss', text: 'Une part pour toi, une part pour moi… c’est meilleur à deux !' },
          { who: 'lumi', text: 'Deuxième cristal rallumé ! La nuit tombe sur le Bois des Champignons…' },
        ],
      },
    ],
  },
  world3: {
    id: 'world3',
    title: 'Le Bois des Champignons Lumineux',
    shots: [
      {
        theme: 'enchanted',
        mood: 'night',
        pan: 1,
        lumi: true,
        actors: [{ key: 'hero', x: 0.35, enter: 'left', h: 460 }],
        lines: [
          { who: 'hero', text: 'Les champignons s’allument comme des lanternes !' },
          { who: 'lumi', text: 'Les feuilles sont fragiles ici : ne reste pas trop longtemps dessus.' },
        ],
      },
    ],
  },
  world3_end: {
    id: 'world3_end',
    title: 'Le rire du Vieux Chêne',
    shots: [
      {
        theme: 'enchanted',
        mood: 'night',
        lumi: true,
        fx: 'crystals',
        actors: [
          { key: 'boss_happy.enchanted', x: 0.72, enter: 'fade', h: 380, flip: true },
          { key: 'hero', x: 0.3, enter: 'left', h: 460 },
        ],
        lines: [
          { who: 'boss', text: 'Ho ho ho ! Ça chatouille ! Merci, petits Gardiens.' },
          { who: 'boss', text: 'Le voile gris vient du Lac des Cristaux. La Sentinelle des Abysses le garde.' },
          { who: 'lumi', text: 'Trois cristaux brillent déjà. La suite de l’aventure se prépare…' },
        ],
      },
    ],
  },
};

CUTSCENES.world4 = {
  id: 'world4',
  title: 'Le Lac des Cristaux',
  music: 'music_story',
  shots: [
    {
      theme: 'crystal',
      mood: 'night',
      pan: 1,
      lumi: true,
      fx: 'crystals',
      actors: [{ key: 'hero', x: 0.35, enter: 'left', h: 460 }],
      lines: [
        { who: 'hero', text: 'Waouh… une cathédrale entière en cristal, sous le lac !' },
        { who: 'lumi', text: 'C’est ici que le voile gris est né. La Sentinelle des Abysses en garde un morceau.' },
        { who: 'hero', text: 'Alors on va l’aider à s’en débarrasser, comme les autres !' },
      ],
    },
  ],
};
CUTSCENES.world4_end = {
  id: 'world4_end',
  title: 'Le lac respire',
  music: 'music_story',
  shots: [
    {
      theme: 'crystal',
      mood: 'night',
      lumi: true,
      fx: 'dawn',
      actors: [
        { key: 'boss_happy.crystal', x: 0.72, enter: 'fade', h: 340, flip: true },
        { key: 'hero', x: 0.3, enter: 'left', h: 460 },
      ],
      lines: [
        { who: 'boss', text: 'Je gardais ce voile pour que personne ne se blesse… mais il me rendait triste.' },
        { who: 'hero', text: 'Maintenant le lac peut briller de nouveau !' },
        { who: 'lumi', text: 'Le voile s’est envolé vers les Îles Célestes. Accrochez-vous à vos chapeaux !' },
      ],
    },
  ],
};

export const CUTSCENE_ORDER = ['intro', 'world1_end', 'world2', 'world2_end', 'world3', 'world3_end', 'world4', 'world4_end'];

export const SPEAKERS: Record<string, { name: string; color: string }> = {
  soumaya: { name: 'Soumaya', color: '#ffd36b' },
  hajar: { name: 'Hajar', color: '#8fe36b' },
  zakaria: { name: 'Zakaria', color: '#ff9a5c' },
  lumi: { name: 'Lumi', color: '#9fe8ff' },
  narrator: { name: '', color: '#ffe9b0' },
  boss: { name: '', color: '#ffb36b' },
};
