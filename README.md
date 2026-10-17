# Les Gardiens des Mondes Magiques

Jeu de plateforme familial en 2,5D pour navigateur (ordinateur, tablette, téléphone — Samsung Internet compris).
Soumaya, Hajar et Zakaria parcourent dix mondes pour rallumer les éclats du Grand Cristal.

- **Jouer** : ouvrir `docs/index.html` via un serveur web (voir plus bas) ou publier le dossier `docs/`.
- **Technologie** : [Phaser 4.2](https://phaser.io) (WebGL), TypeScript, Vite. Tests : Vitest + Playwright.

## Démarrage rapide

```bash
npm install
npm run dev          # serveur de développement : http://localhost:5173
npm test             # tests unitaires (physique, sauvegarde, ennemis, boss, données, atteignabilité)
npm run build        # contrôle TypeScript + build de production dans docs/
npm run test:e2e     # tests navigateur (Chromium) sur le build : menus, niveaux, victoire, tactile…
```

Paramètres d'URL utiles : `?level=2-1` (niveau), `&hero=hajar`, `&autotest` (démarrage direct, pas de temps
fixe), `&debug` (boîtes de collision), `&nocine` (sans cinématiques), `&scene=Gallery`, `&res=1.5`.

## Héberger la version web

Le dossier `docs/` est autonome (chemins relatifs) : il suffit de le servir en statique.

- **GitHub Pages** : *Settings → Pages → Branch : la branche voulue, dossier `/docs`*.
- **Serveur local** : `npx http-server docs` puis ouvrir l'adresse affichée (le téléphone doit être sur le même Wi-Fi).
- Le jeu s'installe comme une application (manifeste + service worker) et fonctionne hors-ligne après la première visite.

## Commandes

| Action | Clavier | Manette | Tactile |
| --- | --- | --- | --- |
| Bouger | ← → / Q D / A D | stick, croix | ◀ ▶ (glisser d'une flèche à l'autre) |
| Sauter (maintenir = plus haut) | Espace / ↑ / Z / W | A / B | ⤒ |
| Pouvoir (maintenir pour charger, Soumaya) | X / Maj / E / K | X / Y / R1 | ★ |
| Pause | Échap / P | Start | II |
| Performances | F3 | | |

## Les héros

| Héros | Déplacement | Pouvoir (X) |
| --- | --- | --- |
| **Soumaya**, gardienne de la lumière (9 ans) | double saut, vol plané (maintenir le saut) | Étoile de lumière ; maintenir puis relâcher : Nova perçante |
| **Hajar**, exploratrice agile (7 ans) | la plus rapide, saut mural | Fleur géante sous ses pieds, même en l'air |
| **Zakaria**, gardien solaire (4 ans) | super-bond, sauts toujours assistés | Éclat solaire : onde qui apaise les ennemis + bouclier |

## Architecture

```
src/
  config.ts            constantes, options d'URL
  core/                sauvegarde (save.ts), audio, qualité adaptative, perf, textures d'effets, manifeste d'art
  physics/             corps du héros (body.ts), géométrie, plateformes animées — sans Phaser, testés
  game/                caméra de plateforme, entrées unifiées (clavier/manette/tactile)
  data/                héros, mondes, niveaux (levels/worldN.ts), histoire (cinématiques), récompenses
  enemies/             logique (logic.ts, testée) + rendu (view.ts)
  bosses/              logique des boss (charger, tree) + contrôleur de combat
  level/               décor en parallaxe, terrain, effets, rendu du héros, solides
  scenes/              Boot, Preload, Title, HeroSelect, WorldMap, Level, HUD, Overlay, Settings, Cutscene, Gallery
  ui/                  boutons, panneaux, bulles
public/assets/         illustrations peintes (art/ + manifest.json), sons et musiques (audio/ + manifest.json)
tools/                 audio-manifest.mjs, synth/ (création des sons et musiques originaux)
tests/unit             Vitest ; tests/e2e : Playwright
docs/                  build web prêt à publier
```

La simulation tourne à pas fixe (1/120 s) et le rendu est interpolé : le jeu se comporte de la même façon
à 30, 60 ou 120 images par seconde. La qualité graphique s'adapte toute seule au temps de rendu réel.

## Ajouter un niveau

1. Écrire un `LevelDef` dans `src/data/levels/worldN.ts` (sols, plateformes, ennemis, cristaux, étoiles…).
2. L'ajouter à `LEVELS` et à `WORLDS[n].levels` dans `src/data/worlds.ts`.
3. `npm test` vérifie automatiquement que les décors existent et que l'arrivée est atteignable
   **avec chacun des trois héros** (simulation avec le vrai moteur physique).

## Décors peints des mondes 4 à 10

Les fonds de ces mondes viennent d'illustrations fournies par l'autrice du projet. Pour les régénérer :
`python3 -I tools/art/backdrops.py <dossier_des_images>` (produit `sky_*.webp` et `near_*.webp` dans
`public/assets/art/` et met à jour le manifeste). Le décor d'un monde se choisit dans `src/data/themes.ts`
(`sky`, `near`) ou par niveau (`sky` dans la définition du niveau).

## Sons et musiques

Les musiques et ambiances des mondes 1 à 3 viennent du prototype. Les nouveaux effets (pouvoirs, interrupteurs,
boss…) et les musiques `music_story` / `music_boss` sont composés et synthétisés par `tools/synth/` (numpy +
ffmpeg) : originaux, libres de droits. `python3 tools/synth/make_music.py public/assets/audio` les régénère.

## État et limites

Voir [`NOTES.md`](NOTES.md) : ce qui est implémenté, testé, et ce qui reste à faire.
