// Sauvegarde locale (localStorage), 3 profils, migration depuis les formats du prototype.
// Le module est indépendant de Phaser pour être testé unitairement.

export type HeroId = 'soumaya' | 'hajar' | 'zakaria';
export type Difficulty = 'facile' | 'normal' | 'expert';
export type Quality = 'auto' | 'bas' | 'moyen' | 'haut';

export interface Settings {
  music: number;
  sfx: number;
  ambience: number;
  quality: Quality;
  showPerf: boolean;
  touchControls: 'auto' | 'on' | 'off';
  /** Moins de secousses d'écran et de flashs. */
  reducedMotion: boolean;
  /** Taille des boutons tactiles (1 = normal). */
  touchScale: number;
}

export interface LevelRecord {
  completed: boolean;
  stars: boolean[];
  crystals: number;
  bestTime: number | null;
  chest: boolean;
  /** Héros ayant terminé ce niveau (pour les récompenses de galerie). */
  heroes?: HeroId[];
}

export interface Profile {
  name: string;
  hero: HeroId;
  difficulty: Difficulty;
  levels: Record<string, LevelRecord>;
  totalCrystals: number;
  unlocked: string[];
  seenCutscenes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SaveData {
  version: 3;
  activeProfile: number;
  profiles: (Profile | null)[];
  settings: Settings;
}

export interface LevelResult {
  stars: boolean[];
  crystals: number;
  time: number;
  chest: boolean;
  hero?: HeroId;
}

export const SAVE_KEY = 'gardiens.save';

export const DEFAULT_SETTINGS: Settings = {
  music: 0.7,
  sfx: 0.9,
  ambience: 0.6,
  quality: 'auto',
  showPerf: false,
  touchControls: 'auto',
  reducedMotion: false,
  touchScale: 1,
};

export function newProfile(name: string, hero: HeroId = 'soumaya', difficulty: Difficulty = 'normal'): Profile {
  const now = Date.now();
  return {
    name,
    hero,
    difficulty,
    levels: {},
    totalCrystals: 0,
    unlocked: ['1-1'],
    seenCutscenes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultSave(): SaveData {
  return { version: 3, activeProfile: 0, profiles: [newProfile('Joueur 1'), null, null], settings: { ...DEFAULT_SETTINGS } };
}

const HEROES: HeroId[] = ['soumaya', 'hajar', 'zakaria'];
const DIFFS: Difficulty[] = ['facile', 'normal', 'expert'];

function sanitizeProfile(raw: unknown, index: number): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Profile>;
  const base = newProfile(typeof p.name === 'string' ? p.name : `Joueur ${index + 1}`);
  const levels: Record<string, LevelRecord> = {};
  for (const [id, r] of Object.entries(p.levels ?? {})) {
    if (!r || typeof r !== 'object') continue;
    const rec = r as Partial<LevelRecord>;
    levels[id] = {
      completed: !!rec.completed,
      stars: [0, 1, 2].map((i) => !!rec.stars?.[i]),
      crystals: Number.isFinite(rec.crystals) ? Math.max(0, rec.crystals as number) : 0,
      bestTime: Number.isFinite(rec.bestTime) ? (rec.bestTime as number) : null,
      chest: !!rec.chest,
      heroes: Array.isArray(rec.heroes) ? rec.heroes.filter((h): h is HeroId => HEROES.includes(h as HeroId)) : [],
    };
  }
  const unlocked = Array.isArray(p.unlocked) ? p.unlocked.filter((x): x is string => typeof x === 'string') : [];
  if (!unlocked.includes('1-1')) unlocked.unshift('1-1');
  return {
    ...base,
    hero: HEROES.includes(p.hero as HeroId) ? (p.hero as HeroId) : 'soumaya',
    difficulty: DIFFS.includes(p.difficulty as Difficulty) ? (p.difficulty as Difficulty) : 'normal',
    levels,
    totalCrystals: Object.values(levels).reduce((s, r) => s + r.crystals, 0),
    unlocked,
    seenCutscenes: Array.isArray(p.seenCutscenes) ? p.seenCutscenes.filter((x) => typeof x === 'string') : [],
    createdAt: Number.isFinite(p.createdAt) ? (p.createdAt as number) : base.createdAt,
    updatedAt: Number.isFinite(p.updatedAt) ? (p.updatedAt as number) : base.updatedAt,
  };
}

/** Convertit n'importe quelle donnée lue (v1, v2, v3, corrompue) en sauvegarde v3 valide. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave();
  let d = raw as Record<string, unknown>;
  if (d.version === 1) {
    d = {
      version: 2,
      activeProfile: 0,
      profiles: [{ ...newProfile((d.name as string) ?? 'Joueur 1'), levels: d.levels ?? {}, totalCrystals: d.crystals ?? 0 }, null, null],
      settings: d.settings ?? {},
    };
  }
  if ((d.version !== 2 && d.version !== 3) || !Array.isArray(d.profiles)) return defaultSave();
  const profiles = (d.profiles as unknown[]).slice(0, 3).map(sanitizeProfile);
  while (profiles.length < 3) profiles.push(null);
  const settings = { ...DEFAULT_SETTINGS, ...((d.settings as Partial<Settings>) ?? {}) };
  for (const k of ['music', 'sfx', 'ambience'] as const) settings[k] = Math.max(0, Math.min(1, Number(settings[k]) || 0));
  settings.touchScale = Math.max(0.8, Math.min(1.4, Number(settings.touchScale) || 1));
  let active = Number(d.activeProfile) | 0;
  if (active < 0 || active > 2) active = 0;
  return { version: 3, activeProfile: active, profiles, settings };
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function detectStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    s.setItem('__t', '1');
    s.removeItem('__t');
    return s;
  } catch {
    return null;
  }
}

export class SaveStore {
  data: SaveData;

  constructor(private storage: KeyValueStorage | null = detectStorage()) {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      return raw ? migrate(JSON.parse(raw)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  /** Renvoie false si le stockage est indisponible (navigation privée, quota). */
  save(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  get persistent(): boolean {
    return !!this.storage;
  }

  get profile(): Profile {
    let p = this.data.profiles[this.data.activeProfile];
    if (!p) {
      p = newProfile(`Joueur ${this.data.activeProfile + 1}`);
      this.data.profiles[this.data.activeProfile] = p;
    }
    return p;
  }

  selectProfile(i: number): void {
    this.data.activeProfile = Math.max(0, Math.min(2, i));
    void this.profile;
    this.save();
  }

  resetProfile(i: number): void {
    this.data.profiles[i] = newProfile(`Joueur ${i + 1}`);
    this.save();
  }

  isUnlocked(levelId: string): boolean {
    return this.profile.unlocked.includes(levelId);
  }

  unlock(levelId: string): void {
    if (!this.profile.unlocked.includes(levelId)) this.profile.unlocked.push(levelId);
  }

  markCutscene(id: string): void {
    if (!this.profile.seenCutscenes.includes(id)) {
      this.profile.seenCutscenes.push(id);
      this.save();
    }
  }

  /** Fusionne un résultat avec le meilleur précédent, débloque le niveau suivant, sauvegarde. */
  recordLevel(levelId: string, res: LevelResult, next?: string | null): LevelRecord {
    const p = this.profile;
    const prev = p.levels[levelId];
    const heroes = new Set(prev?.heroes ?? []);
    if (res.hero) heroes.add(res.hero);
    const rec: LevelRecord = {
      completed: true,
      stars: [0, 1, 2].map((i) => !!res.stars[i] || !!prev?.stars[i]),
      crystals: Math.max(res.crystals, prev?.crystals ?? 0),
      bestTime: prev?.bestTime == null ? res.time : Math.min(prev.bestTime, res.time),
      chest: res.chest || !!prev?.chest,
      heroes: [...heroes],
    };
    p.totalCrystals += Math.max(0, rec.crystals - (prev?.crystals ?? 0));
    p.levels[levelId] = rec;
    if (next) this.unlock(next);
    p.updatedAt = Date.now();
    this.save();
    return rec;
  }

  get starCount(): number {
    return Object.values(this.profile.levels).reduce((s, r) => s + r.stars.filter(Boolean).length, 0);
  }
}

export const saves = new SaveStore();
