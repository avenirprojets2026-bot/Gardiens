# Notes techniques et état du projet

## Décision technique

Le dépôt ne contenait **ni projet Godot ni archives ZIP** : seulement le build compilé d'un prototype
**Phaser 4** (bundle minifié de 108 Ko, sans sources), avec 129 illustrations peintes de bonne qualité
(héros animés, décors des mondes 1 à 3, boss) et 29 pistes audio. L'original intact est conservé dans le tag
git `prototype-phaser-original`.

Choix : **rester sur Phaser 4 + TypeScript + Vite**, et reconstruire des sources propres.

- Le web est la cible n°1 (Samsung Internet sur Android) : Phaser y est natif, le jeu fait ~440 Ko gzip de
  code et se charge vite. Godot 4 en Web pèse ~40 Mo, demande SharedArrayBuffer/COOP-COEP et reste fragile
  sur les navigateurs mobiles ; Unity Web est lourd sur téléphone ; Unreal n'a pas d'export web.
- L'art existant est en 2D peinte : un moteur 2D le sert parfaitement ; un passage en 3D obligerait à tout refaire.
- Les mécaniques du prototype (physique fine, caméra, boss) étaient bonnes : elles ont été retranscrites
  fidèlement, modularisées et testées.
- Windows/Android : le jeu est une PWA installable. Un emballage natif (Capacitor pour Android,
  Electron/Tauri pour Windows) est possible sans changer le code ; **non produit ici** (pas de SDK Android
  ni de Windows dans l'environnement).

## Ce qui a été réécrit (depuis le bundle minifié)

Tout le code : sauvegarde (compatible avec les sauvegardes du prototype), audio, qualité adaptative,
physique, caméra, entrées, 9 niveaux, 2 types de boss, toutes les scènes.

## Lot 1 — implémenté

| Domaine | Contenu | Statut |
| --- | --- | --- |
| Architecture | 40 modules TS séparés (physique, ennemis, boss, niveaux, UI, audio…) | fait |
| Héros | 3 héros différenciés : double saut + vol plané + Nova chargée (Soumaya) ; vitesse + saut mural + fleur (Hajar) ; super-bond assisté + éclat solaire (Zakaria) | fait, testé |
| Ennemis | scarabée (patrouille), fonceur (alerte « ! » puis charge), feu follet (vol, plongée), champignon cracheur (tir en cloche) | fait, testé |
| Boss | Roi Ronchon / Gâteau Grognon (charge, étourdi, ondes de choc en phase 2), Vieux Chêne (glands avec ombres, racines, bâillement) ; arène, musique de boss, télégraphes | fait, testé |
| Mécaniques | plateformes mobiles, flottantes, fragiles, ressorts, glace, eau, courants d'air, interrupteurs-cristaux, ponts cachés, barrières, passages secrets, coffres, lanternes | fait |
| Narration | cinématique d'introduction, fins de monde, répliques en jeu (Lumi la luciole), toutes passables | fait |
| Interface | accueil animé, sélection animée des héros, carte des 10 mondes, HUD (jauge de pouvoir, barre du boss), pause, victoire, défaite encourageante, réglages (volumes, qualité, tactile, taille des boutons, secousses réduites, profils), galerie de récompenses et cinématiques | fait |
| Audio | 13 nouveaux effets + `music_story` + `music_boss` composés et synthétisés (originaux) | fait |
| Mobile | boutons tactiles multipoint, plein écran + paysage, pause auto en arrière-plan, message « tourne ton téléphone » | testé en émulation |

## Tests

- `npm test` : 333 tests unitaires (sauvegarde/migration, physique, plateformes, ennemis, boss, intégrité des
  données) et **contrôle d'atteignabilité** : chaque niveau est simulé avec le vrai moteur physique pour les
  trois héros (le contrôle détecte bien un fossé infranchissable).
- Sauvegarde de l'original : commit `1b37b37` (le tag `prototype-phaser-original` n'a pas pu être poussé).
- `npm run test:e2e` : 14/14 réussis (dernières exécutions). Chromium (rendu logiciel SwiftShader) sur le build de production — menus, clavier,
  9 niveaux (lanternes, boss, victoire, sauvegarde), défaite, émulation Samsung Internet (tactile), galerie, réglages.

## Non testé / limites connues

- **Aucun test sur un vrai téléphone** : seule l'émulation Chromium (UA Samsung Internet, écran tactile) a été
  utilisée. À vérifier sur l'appareil : son au premier toucher, plein écran, performances réelles.
- Les tests navigateur tournent en rendu logiciel : les FPS mesurés ne sont pas représentatifs.
- **Mondes 4 à 10 : les 21 niveaux sont conçus, codés et validés** (atteignabilité pour les 3 héros, boss
  à motifs testés), avec leurs mécaniques (éclipses, vent, faible gravité, obscurité, énigmes) et leurs
  cinématiques, fin de l'aventure comprise. **Ils restent « en construction » sur la carte tant que leurs
  illustrations peintes manquent** (le jeu vérifie la présence de `bgd_sky.<thème>`) : la génération d'images
  est prévue (accord donné, cahier des charges dans `tools/art/brief.json`, intégration automatique par
  `tools/art/process.py`), mais le réseau de l'environnement bloque `upload.higgsfield.ai` et
  `d2ol7oe51mr4n9.cloudfront.net`.
- Écrans larges (téléphones 19,5:9) : la vue s’élargit jusqu’à 1600 px logiques, sans bandes noires.
- Captures réelles du jeu exécuté : dossier `docs-captures/`.
- **Nouveaux designs des héros (sorcière, fée, chevalier) : choisis, pas encore réalisés**, pour la même raison.
- Exports Windows / Android natifs : non produits.
