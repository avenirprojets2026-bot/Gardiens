import { arena, barrierPuzzle, draft, finish, flat, gap, launch, lowGrav, secret, shaft, windBridge } from '../compose';
import type { LevelDef } from '../types';

// Mondes 5 à 10. Chaque monde introduit une mécanique, la développe, puis la combine
// avec les précédentes avant le gardien.

const SKY = ['s_chime', 's_cloudbush', 's_lantern', 's_pillar', 's_kite', 's_flowers'];
const OBS = ['o_telescope', 'o_sphere', 'o_palm', 'o_books', 'o_hourglass', 'o_lamp'];
const SHADOW = ['d_lantern', 'd_thorns', 'd_crystal', 'd_tree', 'd_gargoyle', 'd_flowers'];
const STARS = ['t_crystal', 't_globe', 't_pillar', 't_comet', 't_lantern', 't_fountain'];
const CITADEL = ['g_banner', 'g_armor', 'g_roses', 'g_fountain', 'g_statue', 'g_torch'];
const HEART = ['z_prism', 'z_flower', 'z_island', 'z_tree', 'z_fountain', 'z_lantern'];

// ------------------------------------------------------------------ Monde 5 — Les Îles Célestes
function w5_1(): LevelDef {
  const d = draft(SKY);
  flat(d, 1500, { enemy: 'beetle' });
  gap(d, 3, { kind: 'cloud', style: 'blink' });
  flat(d, 900, { checkpoint: true, enemy: 'flyer' });
  shaft(d, { star: true });
  windBridge(d, 1100, 900);
  flat(d, 1000, { checkpoint: true, enemy: 'charger' });
  launch(d, { star: true });
  gap(d, 2, { kind: 'cloud', style: 'move' });
  flat(d, 1400, { enemy: 'beetle', heart: true });
  return finish(d, {
    id: '5-1', name: 'Le Port des Nuages', world: 5, theme: 'sky', mood: 'day', next: '5-2', intro: 'world5',
    extraHints: [{ x: 1650, y: 330, text: 'Les nuages s’effacent un instant : saute quand ils sont pleins', icon: 'jump' }],
    talks: [{ x: 500, lines: [{ who: 'lumi', text: 'Tenez-vous bien, ici le vent souffle fort !' }, { who: 'hero', text: 'Je vais voler comme un oiseau !' }] }],
  });
}

function w5_2(): LevelDef {
  const d = draft(SKY);
  flat(d, 1200, { enemy: 'flyer' });
  windBridge(d, 1300, 1100);
  flat(d, 800, { checkpoint: true, enemy: 'spitter' });
  shaft(d, {});
  gap(d, 3, { kind: 'cloud', style: 'fall', dy: [0, -60, 0] });
  flat(d, 900, { checkpoint: true, enemy: 'charger' });
  barrierPuzzle(d, 'carillon', 'shoot');
  secret(d);
  windBridge(d, 1000, -350);
  flat(d, 1300, { enemy: 'flyer', heart: true });
  return finish(d, { id: '5-2', sky: 'sky_realm', name: 'Le Palais des Vents', world: 5, theme: 'sky', mood: 'dusk', next: '5-3' });
}

function w5_3(): LevelDef {
  const d = draft(SKY);
  flat(d, 1300, { enemy: 'beetle' });
  gap(d, 3, { kind: 'cloud', style: 'blink' });
  flat(d, 700, {});
  const b = arena(d, { kind: 'pattern', pattern: 'cloud', hp: 3, displayH: 280, name: 'Le Prince des Nuages', smile: 'Le Prince des Nuages fait pleuvoir des arcs-en-ciel !' });
  return finish(d, { id: '5-3', name: 'Le Trône des Nuages', world: 5, theme: 'sky', mood: 'day', next: '6-1', outro: 'world5_end' }, b);
}

// ------------------------------------------------------------------ Monde 6 — L'Observatoire Magique
function w6_1(): LevelDef {
  const d = draft(OBS);
  flat(d, 1400, { enemy: 'beetle', material: 'stone' });
  gap(d, 3, { kind: 'med', style: 'move' });
  flat(d, 900, { checkpoint: true, enemy: 'charger', material: 'stone' });
  barrierPuzzle(d, 'lunette', 'shoot');
  launch(d, { star: true });
  gap(d, 3, { style: 'move', dy: [0, -80, -40] });
  flat(d, 1200, { checkpoint: true, enemy: 'spitter', material: 'stone' });
  secret(d);
  flat(d, 1000, { enemy: 'flyer', heart: true, material: 'stone' });
  return finish(d, {
    id: '6-1', sky: 'sky_ember', name: 'Les Dunes Étoilées', world: 6, theme: 'observatory', mood: 'dusk', next: '6-2', intro: 'world6',
    talks: [{ x: 500, lines: [{ who: 'lumi', text: 'L’Observatoire ! Ses engrenages font tourner le ciel.' }, { who: 'hero', text: 'On dirait une horloge géante…' }] }],
  });
}

function w6_2(): LevelDef {
  const d = draft(OBS);
  flat(d, 1100, { enemy: 'flyer', material: 'stone' });
  barrierPuzzle(d, 'sphere', 'stomp');
  gap(d, 4, { kind: 'small', style: 'move', dy: [0, -60, -120, -60] });
  flat(d, 800, { checkpoint: true, enemy: 'charger', material: 'stone' });
  shaft(d, { star: true });
  gap(d, 3, { style: 'blink' });
  flat(d, 900, { checkpoint: true, enemy: 'spitter', material: 'stone' });
  barrierPuzzle(d, 'orrery', 'shoot');
  flat(d, 1200, { enemy: 'beetle', heart: true, material: 'stone' });
  return finish(d, { id: '6-2', name: 'Les Engrenages du Ciel', world: 6, theme: 'observatory', mood: 'night', next: '6-3' });
}

function w6_3(): LevelDef {
  const d = draft(OBS);
  flat(d, 1200, { enemy: 'beetle', material: 'stone' });
  gap(d, 3, { style: 'move' });
  flat(d, 700, { material: 'stone' });
  const b = arena(d, { kind: 'pattern', pattern: 'clock', hp: 3, displayH: 320, name: 'L’Horloger des Astres', smile: 'L’Horloger remet les étoiles à l’heure !' });
  return finish(d, { id: '6-3', name: 'La Grande Horloge', world: 6, theme: 'observatory', mood: 'night', next: '7-1', outro: 'world6_end' }, b);
}

// ------------------------------------------------------------------ Monde 7 — Le Royaume des Ombres
function w7_1(): LevelDef {
  const d = draft(SHADOW);
  flat(d, 1500, { enemy: 'beetle', checkpoint: false });
  gap(d, 3, { style: 'fixed', dy: [0, -50, 0] });
  flat(d, 1000, { checkpoint: true, enemy: 'flyer' });
  launch(d, { star: true });
  gap(d, 3, { style: 'fall' });
  flat(d, 1100, { checkpoint: true, enemy: 'charger' });
  secret(d);
  flat(d, 1300, { enemy: 'spitter', heart: true });
  return finish(d, {
    id: '7-1', name: 'Le Bois sans Lune', world: 7, theme: 'shadow', mood: 'night', next: '7-2', intro: 'world7', darkness: 0.7,
    extraHints: [{ x: 420, y: 330, text: 'Il fait tout noir : allume les lanternes, elles éclairent et protègent', icon: 'run' }],
    talks: [{ x: 700, lines: [{ who: 'hero', text: 'J’ai un peu peur du noir…' }, { who: 'lumi', text: 'Ta lumière est plus forte que l’ombre. Et je suis là !' }] }],
  });
}

function w7_2(): LevelDef {
  const d = draft(SHADOW);
  flat(d, 1100, { enemy: 'flyer' });
  barrierPuzzle(d, 'veilleuse', 'shoot');
  gap(d, 4, { style: 'blink', dy: [0, -60, -20, -80] });
  flat(d, 900, { checkpoint: true, enemy: 'charger' });
  shaft(d, { star: true });
  gap(d, 3, { style: 'move' });
  flat(d, 1000, { checkpoint: true, enemy: 'spitter' });
  flat(d, 1200, { enemy: 'flyer', heart: true, y: 500 });
  return finish(d, { id: '7-2', sky: 'sky_bridge', name: 'Les Ponts de Brume', world: 7, theme: 'shadow', mood: 'night', next: '7-3', darkness: 0.8 });
}

function w7_3(): LevelDef {
  const d = draft(SHADOW);
  flat(d, 1200, { enemy: 'beetle' });
  gap(d, 3, { style: 'fixed' });
  flat(d, 700, {});
  const b = arena(d, { kind: 'pattern', pattern: 'dragon', hp: 3, displayH: 300, name: 'Le Dragon d’Ombre', smile: 'Le Dragon d’Ombre n’avait peur que d’être seul !' });
  return finish(d, { id: '7-3', sky: 'sky_cave', name: 'Le Nid du Dragon', world: 7, theme: 'shadow', mood: 'night', next: '8-1', outro: 'world7_end', darkness: 0.5 }, b);
}

// ------------------------------------------------------------------ Monde 8 — Le Sanctuaire des Étoiles
function w8_1(): LevelDef {
  const d = draft(STARS);
  flat(d, 1300, { enemy: 'beetle', material: 'crystal' });
  lowGrav(d, 1500);
  flat(d, 900, { checkpoint: true, enemy: 'flyer', material: 'crystal' });
  shaft(d, { star: true });
  gap(d, 3, { style: 'blink' });
  flat(d, 900, { checkpoint: true, enemy: 'charger', material: 'crystal' });
  lowGrav(d, 1200);
  flat(d, 1200, { enemy: 'spitter', heart: true, material: 'crystal' });
  return finish(d, {
    id: '8-1', name: 'Le Jardin des Comètes', world: 8, theme: 'stars', mood: 'night', next: '8-2', intro: 'world8',
    extraHints: [{ x: 1500, y: 330, text: 'Ici on flotte : les sauts durent longtemps !', icon: 'jump' }],
  });
}

function w8_2(): LevelDef {
  const d = draft(STARS);
  flat(d, 1100, { enemy: 'flyer', material: 'crystal' });
  barrierPuzzle(d, 'constellation', 'shoot');
  lowGrav(d, 1500);
  flat(d, 800, { checkpoint: true, enemy: 'charger', material: 'crystal' });
  launch(d, { star: true, power: 1300 });
  gap(d, 3, { style: 'move' });
  flat(d, 900, { checkpoint: true, enemy: 'spitter', material: 'crystal' });
  secret(d);
  flat(d, 1100, { enemy: 'flyer', heart: true, material: 'crystal' });
  return finish(d, { id: '8-2', name: 'Les Anneaux de Lumière', world: 8, theme: 'stars', mood: 'night', next: '8-3' });
}

function w8_3(): LevelDef {
  const d = draft(STARS);
  flat(d, 1200, { enemy: 'beetle', material: 'crystal' });
  lowGrav(d, 900);
  flat(d, 700, { material: 'crystal' });
  const b = arena(d, { kind: 'pattern', pattern: 'watcher', hp: 3, displayH: 300, name: 'Le Veilleur des Étoiles', smile: 'Le Veilleur rallume toutes les constellations !' });
  return finish(d, { id: '8-3', name: 'Le Temple du Veilleur', world: 8, theme: 'stars', mood: 'night', next: '9-1', outro: 'world8_end' }, b);
}

// ------------------------------------------------------------------ Monde 9 — La Citadelle des Gardiens
function w9_1(): LevelDef {
  const d = draft(CITADEL);
  flat(d, 1300, { enemy: 'charger', material: 'stone' });
  barrierPuzzle(d, 'porte', 'stomp');
  gap(d, 3, { style: 'move' });
  flat(d, 900, { checkpoint: true, enemy: 'flyer', material: 'stone' });
  shaft(d, { star: true });
  windBridge(d, 900, 800);
  flat(d, 900, { checkpoint: true, enemy: 'spitter', material: 'stone' });
  launch(d, { star: true });
  gap(d, 3, { style: 'blink' });
  flat(d, 1100, { enemy: 'charger', heart: true, material: 'stone' });
  return finish(d, {
    id: '9-1', name: 'Les Remparts', world: 9, theme: 'citadel', mood: 'dusk', next: '9-2', intro: 'world9',
    talks: [{ x: 600, lines: [{ who: 'lumi', text: 'La Citadelle des anciens Gardiens ! Ils ont caché leurs pouvoirs ici.' }] }],
  });
}

function w9_2(): LevelDef {
  const d = draft(CITADEL);
  flat(d, 1100, { enemy: 'flyer', material: 'stone' });
  gap(d, 3, { style: 'fall' });
  flat(d, 800, { checkpoint: true, enemy: 'charger', material: 'stone' });
  barrierPuzzle(d, 'blason', 'shoot');
  lowGrav(d, 1200);
  flat(d, 900, { checkpoint: true, enemy: 'spitter', material: 'stone' });
  secret(d);
  windBridge(d, 900, -350);
  flat(d, 1200, { enemy: 'flyer', heart: true, material: 'stone' });
  return finish(d, { id: '9-2', name: 'La Salle des Trophées', world: 9, theme: 'citadel', mood: 'night', next: '9-3', darkness: 0.4 });
}

function w9_3(): LevelDef {
  const d = draft(CITADEL);
  flat(d, 1200, { enemy: 'charger', material: 'stone' });
  gap(d, 3, { style: 'blink' });
  flat(d, 700, { material: 'stone' });
  const b = arena(d, { kind: 'pattern', pattern: 'statues', hp: 3, displayH: 330, name: 'Les Trois Statues', smile: 'Les Trois Statues vous confient leurs pouvoirs !' });
  return finish(d, { id: '9-3', name: 'La Cour des Statues', world: 9, theme: 'citadel', mood: 'dusk', next: '10-1', outro: 'world9_end' }, b);
}

// ------------------------------------------------------------------ Monde 10 — Le Cœur des Mondes
function w10_1(): LevelDef {
  const d = draft(HEART);
  flat(d, 1200, { enemy: 'beetle', material: 'crystal' });
  gap(d, 3, { style: 'blink' });
  flat(d, 800, { checkpoint: true, enemy: 'flyer', material: 'crystal' });
  windBridge(d, 900, 900);
  flat(d, 800, { checkpoint: true, enemy: 'charger', material: 'crystal' });
  lowGrav(d, 1200);
  flat(d, 800, { enemy: 'spitter', material: 'crystal' });
  shaft(d, { star: true });
  barrierPuzzle(d, 'prisme', 'shoot');
  flat(d, 1100, { enemy: 'flyer', heart: true, material: 'crystal' });
  return finish(d, {
    id: '10-1', name: 'Le Chemin des Neuf Mondes', world: 10, theme: 'heart', mood: 'night', next: '10-2', intro: 'world10',
  });
}

function w10_2(): LevelDef {
  const d = draft(HEART);
  flat(d, 1000, { enemy: 'charger', material: 'crystal' });
  gap(d, 4, { style: 'move', dy: [0, -60, -120, -60] });
  flat(d, 800, { checkpoint: true, enemy: 'flyer', material: 'crystal' });
  shaft(d, { star: true });
  gap(d, 3, { style: 'fall' });
  flat(d, 800, { checkpoint: true, enemy: 'spitter', material: 'crystal' });
  lowGrav(d, 1200);
  secret(d);
  flat(d, 1200, { enemy: 'charger', heart: true, material: 'crystal' });
  return finish(d, { id: '10-2', sky: 'sky_grove', name: 'L’Escalier de Lumière', world: 10, theme: 'heart', mood: 'night', next: '10-3', darkness: 0.35 });
}

function w10_3(): LevelDef {
  const d = draft(HEART);
  flat(d, 1300, { enemy: 'flyer', material: 'crystal' });
  gap(d, 3, { style: 'blink' });
  flat(d, 800, { material: 'crystal' });
  const b = arena(d, { kind: 'pattern', pattern: 'weaver', hp: 5, displayH: 340, name: 'La Fileuse d’Ombre', smile: 'La Fileuse d’Ombre tisse maintenant de la lumière !' });
  return finish(d, { id: '10-3', sky: 'sky_realm', name: 'Le Cœur des Mondes', world: 10, theme: 'heart', mood: 'night', next: null, outro: 'finale' }, b);
}

export const LATE_LEVELS: LevelDef[] = [
  w5_1(), w5_2(), w5_3(), w6_1(), w6_2(), w6_3(), w7_1(), w7_2(), w7_3(), w8_1(), w8_2(), w8_3(), w9_1(), w9_2(), w9_3(), w10_1(), w10_2(), w10_3(),
];
