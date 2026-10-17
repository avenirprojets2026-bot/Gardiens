import type { PlatformDef } from '../physics/geom';
import { arc, col, GROUND_Y, row } from './kit';
import type { BarrierDef, BossDef, EnemyDef, LevelDef, Mood, Pt, PropDef, SpringDef, SwitchDef, TalkDef, UpdraftDef } from './types';

// Assemblage de niveaux par segments : on enchaîne des morceaux de parcours (sol, fossé avec
// plateformes, puits de bulles, pont de vent…) sans calculer les abscisses à la main.
// Chaque segment avance le curseur ; les niveaux restent ensuite validés par les tests
// d'atteignabilité (moteur physique réel, trois héros).

const G = GROUND_Y;

export interface Draft {
  x: number;
  grounds: LevelDef['grounds'];
  platforms: PlatformDef[];
  springs: SpringDef[];
  crystals: Pt[];
  stars: Pt[];
  hearts: Pt[];
  enemies: EnemyDef[];
  props: PropDef[];
  hints: LevelDef['hints'];
  checkpoints: Pt[];
  updrafts: UpdraftDef[];
  winds: NonNullable<LevelDef['winds']>;
  lowGravity: NonNullable<LevelDef['lowGravity']>;
  switches: SwitchDef[];
  barriers: BarrierDef[];
  secrets: NonNullable<LevelDef['secrets']>;
  chest: Pt | null;
  water: LevelDef['water'];
  propKeys: string[];
  propIndex: number;
}

export function draft(propKeys: string[]): Draft {
  return {
    x: -200, grounds: [], platforms: [], springs: [], crystals: [], stars: [], hearts: [], enemies: [], props: [], hints: [],
    checkpoints: [], updrafts: [], winds: [], lowGravity: [], switches: [], barriers: [], secrets: [], chest: null, water: [],
    propKeys, propIndex: 0,
  };
}

/** Décor suivant de la liste du monde (variété automatique). */
function decorate(d: Draft, x: number, y = G, scale = 0.32) {
  const key = d.propKeys[d.propIndex++ % d.propKeys.length];
  d.props.push({ key, x, y, scale: scale + ((d.propIndex * 7) % 5) * 0.015, flip: d.propIndex % 3 === 0 });
}

/** Sol plat ; décors tous les ~350 px ; options : ennemi, lanterne, arc de cristaux. */
export function flat(d: Draft, w: number, o: { y?: number; enemy?: EnemyDef['kind'] | 'none'; checkpoint?: boolean; crystals?: boolean; heart?: boolean; material?: LevelDef['grounds'][number]['material']; speed?: number } = {}) {
  const y = o.y ?? G;
  const x0 = d.x;
  d.grounds.push({ x: x0, w, y, material: o.material });
  for (let px = x0 + 160; px < x0 + w - 120; px += 330 + (d.propIndex % 3) * 40) decorate(d, px, y);
  if (o.crystals !== false && w > 500) d.crystals.push(...arc(x0 + w * 0.25, y - 90, Math.min(7, Math.floor(w / 140)), 70, 60));
  if (o.enemy && o.enemy !== 'none' && w >= 600) {
    const mid = x0 + w / 2;
    if (o.enemy === 'spitter') d.enemies.push({ kind: 'spitter', x: mid, minX: mid, maxX: mid, speed: 0 });
    else if (o.enemy === 'flyer') d.enemies.push({ kind: 'flyer', x: mid, y: y - 240, minX: mid - w * 0.3, maxX: mid + w * 0.3, speed: o.speed ?? 75 });
    else d.enemies.push({ kind: o.enemy, x: mid, minX: x0 + 120, maxX: x0 + w - 120, speed: o.speed ?? 60 });
  }
  if (o.checkpoint) d.checkpoints.push({ x: x0 + 180, y });
  if (o.heart) d.hearts.push({ x: x0 + w - 200, y: y - 60 });
  d.x += w;
}

/** Fossé franchi par une suite de plateformes (fixes, à éclipses, mobiles ou fragiles). */
export function gap(d: Draft, n: number, o: { kind?: PlatformDef['kind']; style?: 'fixed' | 'blink' | 'move' | 'fall'; dy?: number[]; spacing?: number; y?: number } = {}) {
  const spacing = o.spacing ?? 230;
  const y = o.y ?? 480;
  for (let i = 0; i < n; i++) {
    const px = d.x + 70 + i * spacing;
    const py = y + (o.dy?.[i % o.dy.length] ?? 0);
    const p: PlatformDef = { kind: o.kind ?? 'small', x: px, y: py, w: 150 };
    if (o.style === 'blink') p.blink = { on: 2.4, off: 1.1, phase: i * 0.8 };
    if (o.style === 'move') p.move = { dx: i % 2 ? 0 : 120, dy: i % 2 ? -100 : 0, period: 3.6 + (i % 3) * 0.4, phase: i };
    if (o.style === 'fall') p.fall = true;
    d.platforms.push(p);
    d.crystals.push({ x: px + 75, y: py - 60 });
  }
  d.x += 70 + n * spacing - (spacing - 150) + 70;
}

/** Puits de bulles/vent ascendant menant à une corniche haute avec une étoile. */
export function shaft(d: Draft, o: { star?: boolean; height?: number } = {}) {
  const x0 = d.x;
  const h = o.height ?? 760;
  d.grounds.push({ x: x0, w: 520, y: G });
  d.updrafts.push({ x: x0 + 150, y: G - h, w: 220, h, power: 2600 });
  d.crystals.push(...col(x0 + 260, G - 160, 5, 100));
  d.platforms.push({ kind: 'med', x: x0 + 400, y: G - h + 120, w: 200 });
  if (o.star) d.stars.push({ x: x0 + 500, y: G - h + 20 });
  else d.crystals.push(...row(x0 + 430, G - h + 70, 3, 60));
  decorate(d, x0 + 60);
  d.x += 520;
}

/** Ressort qui propulse vers une plateforme haute (récompense optionnelle). */
export function launch(d: Draft, o: { star?: boolean; chest?: boolean; power?: number } = {}) {
  const x0 = d.x;
  d.grounds.push({ x: x0, w: 700, y: G });
  d.springs.push({ x: x0 + 200, y: G, power: o.power ?? 1400 });
  d.crystals.push(...col(x0 + 200, G - 180, 3));
  d.platforms.push({ kind: 'big', x: x0 + 330, y: 180, w: 330 });
  d.crystals.push(...row(x0 + 370, 130, 4, 80));
  if (o.star) d.stars.push({ x: x0 + 495, y: 40 });
  if (o.chest) d.chest = { x: x0 + 495, y: 180 };
  decorate(d, x0 + 600);
  d.x += 700;
}

/** Pont de vent : on traverse un grand vide porté par une rafale (et des nuages qui clignent). */
export function windBridge(d: Draft, w: number, force: number) {
  const x0 = d.x;
  d.winds.push({ x: x0, y: 0, w, h: G + 40, force });
  // Vent de dos : nuages espacés de 300 px en escalier ; vent de face : 240 px, à plat.
  const headwind = force < 0;
  const n = Math.max(2, Math.ceil((w - 160) / (headwind ? 240 : 300)));
  // Le dernier nuage touche presque le sol suivant (pas de chute contre le bord).
  const step = (w - 80 - 150 - 10) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const px = x0 + 80 + i * step;
    const py = headwind ? 480 : 470 - (i % 2) * 70;
    d.platforms.push({ kind: 'cloud', x: px, y: py, w: 150, ...(headwind ? {} : { blink: { on: 2.6, off: 1.0, phase: i * 0.9 } }) });
    d.crystals.push({ x: px + 75, y: py - 70 });
  }
  d.x += w;
}

/** Champ de faible pesanteur : grands sauts au-dessus d'un vide parsemé de plateformes. */
export function lowGrav(d: Draft, w: number) {
  const x0 = d.x;
  d.lowGravity.push({ x: x0 - 100, y: -600, w: w + 200, h: G + 700, scale: 0.45 });
  for (let i = 0; i < Math.floor(w / 300); i++) {
    const px = x0 + 60 + i * 300;
    d.platforms.push({ kind: 'small', x: px, y: 440 - ((i * 97) % 3) * 90, w: 150 });
    d.crystals.push(...arc(px, 360 - ((i * 97) % 3) * 90, 3, 60, 40));
  }
  d.x += w;
}

/** Énigme : un interrupteur (piétiné ou touché par un pouvoir) ouvre une barrière de lumière. */
export function barrierPuzzle(d: Draft, id: string, mode: SwitchDef['mode']) {
  const x0 = d.x;
  d.grounds.push({ x: x0, w: 900, y: G });
  if (mode === 'stomp') {
    d.platforms.push({ kind: 'med', x: x0 + 150, y: 400, w: 200 });
    d.switches.push({ id, x: x0 + 250, y: 400, mode });
  } else d.switches.push({ id, x: x0 + 250, y: G, mode });
  d.barriers.push({ id, x: x0 + 640, y: G, h: 1400 });
  d.hints.push({ x: x0 + 300, y: mode === 'stomp' ? 260 : 380, text: mode === 'stomp' ? 'Saute sur l’interrupteur pour ouvrir la barrière' : 'Touche l’interrupteur avec ton pouvoir (X)', icon: mode === 'stomp' ? 'stomp' : 'power' });
  d.crystals.push(...row(x0 + 700, G - 80, 3, 60));
  decorate(d, x0 + 820);
  d.x += 900;
}

/** Passage secret sous un feuillage : un coffre et des cristaux. */
export function secret(d: Draft) {
  const x0 = d.x;
  d.grounds.push({ x: x0, w: 520, y: G });
  d.secrets.push({ x: x0 + 100, y: G - 230, w: 320, h: 230 });
  d.crystals.push(...row(x0 + 140, G - 70, 5, 60));
  if (!d.chest) d.chest = { x: x0 + 300, y: G };
  d.x += 520;
}

/** Arène de boss standard (porte refermée derrière le héros). */
export function arena(d: Draft, boss: Omit<BossDef, 'x' | 'y' | 'minX' | 'maxX'>) {
  const x0 = d.x;
  d.grounds.push({ x: x0, w: 2400, y: G });
  d.checkpoints.push({ x: x0 + 80, y: G });
  d.hearts.push({ x: x0 + 40, y: G - 60 });
  d.platforms.push({ kind: 'small', x: x0 + 700, y: 400, w: 160 }, { kind: 'small', x: x0 + 1600, y: 400, w: 160 });
  d.hints.push({ x: x0 + 150, y: 330, text: `${boss.name} ! Évite ses attaques, saute sur sa tête quand il se repose`, icon: 'stomp' });
  d.x += 2400;
  return {
    walls: [
      { x: x0 + 200, y: -800, w: 30, h: 1400 },
      { x: x0 + 2360, y: -800, w: 40, h: 1400 },
    ],
    boss: { ...boss, x: x0 + 1900, y: G, minX: x0 + 300, maxX: x0 + 2300 },
    goal: { x: x0 + 1300, y: G },
  };
}

export interface Meta {
  id: string;
  name: string;
  world: number;
  theme: string;
  mood?: Mood;
  next: string | null;
  intro?: string;
  outro?: string;
  darkness?: number;
  talks?: TalkDef[];
  extraHints?: LevelDef['hints'];
}

/** Termine le brouillon : arrivée après la dernière portion de sol, étoiles manquantes ajoutées. */
export function finish(d: Draft, m: Meta, bossPart?: ReturnType<typeof arena>): LevelDef {
  const lastGround = d.grounds[d.grounds.length - 1];
  const goal = bossPart?.goal ?? { x: lastGround.x + lastGround.w - 200, y: lastGround.y };
  // Toujours trois étoiles : complète avec des étoiles hautes au-dessus des plateformes.
  const tall = [...d.platforms].filter((p) => !p.requires).sort((a, b) => a.y - b.y);
  let i = 0;
  while (d.stars.length < 3 && i < tall.length) {
    const p = tall[i++];
    if (d.stars.some((s) => Math.abs(s.x - (p.x + p.w / 2)) < 400)) continue;
    d.stars.push({ x: p.x + p.w / 2, y: p.y - 130 });
  }
  return {
    id: m.id,
    name: m.name,
    world: m.world,
    theme: m.theme,
    mood: m.mood,
    next: m.next,
    intro: m.intro,
    outro: m.outro,
    darkness: m.darkness,
    width: lastGround.x + lastGround.w,
    killY: 980,
    spawn: { x: 160, y: d.grounds[0].y },
    grounds: d.grounds,
    platforms: d.platforms,
    springs: d.springs,
    water: d.water,
    crystals: d.crystals,
    stars: d.stars.slice(0, 3),
    hearts: d.hearts,
    chest: d.chest,
    checkpoints: d.checkpoints,
    enemies: d.enemies,
    props: d.props,
    hints: [...d.hints, ...(m.extraHints ?? [])],
    goal,
    updrafts: d.updrafts,
    winds: d.winds,
    lowGravity: d.lowGravity,
    switches: d.switches,
    barriers: d.barriers,
    secrets: d.secrets,
    talks: m.talks,
    walls: bossPart?.walls,
    boss: bossPart?.boss as BossDef | undefined,
  };
}
