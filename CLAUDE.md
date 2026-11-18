# PyArcade — conventions du projet

Site d'arcade pour apprendre Python (niveau TP de L1), 100 % statique. Spécification complète : `PROMPT_PyArcade.md`.

## Commandes

```bash
npm run dev              # serveur de dev (Vite) — http://localhost:5173
npm run build            # tsc + build statique dans dist/
npm run test             # Vitest (logique TS + runner Python)
npm run verify-content   # vérifie TOUS les niveaux (obligatoire, lancé en CI)
npm run verify-content -- w3 -v   # seulement les ids contenant "w3", verbeux
npm run e2e              # Playwright (parcours critiques, nécessite le réseau pour Pyodide)
```

`verify-content` utilise `.venv/bin/python` s'il existe (avec `matplotlib`), sinon `python3`.
Créer l'environnement : `python3 -m venv .venv && .venv/bin/pip install matplotlib pyyaml`.

## Arborescence

```
content/
  worlds.yaml            # ordre des mondes, boss de chaque monde (ids)
  data/                  # fichiers de données (listes de mots, CSV inventés)
  w0/ … w12/             # un fichier YAML par niveau : <id>.yaml
  wordle/                # parcours express Wordle
  bosses/                # boss (guidé / jumeau / examen)
  secret/                # monde secret
src/
  content/schema.ts      # schéma zod d'un niveau (source de vérité)
  content/index.ts       # chargement + index des mondes, déverrouillage
  content/variants.ts    # variantes d'examen ({{NAME}}), assemblage des fichiers de boss
  python/runner.py       # runner Python PARTAGÉ (navigateur + verify-content)
  python/shims/          # canvas, rich_lite, readchar_lite, folium_lite
  engine/                # worker Pyodide, client avec timeout, API, traducteur d'erreurs
  games/                 # un composant par type de mini-jeu
  live/                  # jeux en direct propulsés par le code du joueur (Wordle, 2048…)
  pages/                 # écrans (accueil, carte, niveau, boss, profil, carnet…)
  store/                 # Zustand persisté + ProgressRepository (export/import)
  lib/                   # xp, badges, sons, dates, progression, notation d'examen
scripts/verify-content.ts + scripts/verify_runner.py
tests/ (Vitest)   e2e/ (Playwright)
```

## Ajouter un niveau (aucun code)

1. Créer `content/<monde>/<id>.yaml` (le nom du fichier = l'id). Schéma : `src/content/schema.ts`.
2. `npm run verify-content -- <id> -v` : la solution doit passer 100 % des tests, le `starter_code`
   doit en rater au moins un, les contraintes AST doivent être respectées par la solution,
   les tests statistiques doivent passer 20 fois avec des graines différentes.
3. Ordre dans le monde : champ `order`, sinon tri naturel des ids (`w3-l02` < `w3-l10`).

Formats de test : `call` + `expected` (expression Python), `output` (stdout exact), `script: true`
(programme entier, avec `stdin`), `raises`, `pure: true` (la fonction ne doit pas modifier ses arguments),
`setup` (code exécuté avant l'appel). Contraintes : noms de nœuds AST (`While`, `For`, `If`, `ClassDef`,
`ListComp`, `Comprehension`, `Recursion`…), `call:sum`, `method:sort`, `import:collections`, `name:Counter`,
`max_lines`, `max_chars`, `max_count`, `scope` (fonction).

## Conventions

- Interface en français (bouton FR/EN : `useTr()(fr, en)`), **code, noms de fonctions et docstrings en anglais**.
- Énoncés originaux : ne jamais recopier le texte des TP de référence.
- Solutions de référence dans le style attendu à l'examen (simple, lisible, sans astuce), sauf Code Golf.
- Les tests vérifient vraiment le comportement, cas limites compris (vide, 0, bords, égalités).
- Un niveau = une idée nouvelle ; ne pas enchaîner plus de 2 niveaux du même type dans un monde.
- Commits petits et clairs ; `npm run build && npm run test && npm run verify-content` avant de clore une phase.

## Décisions prises (non couvertes par la spec)

- **Python** : Pyodide 314.0.8 (Python 3.14) chargé depuis le CDN jsDelivr dans un Web Worker module.
  `verify-content` exécute le **même** `runner.py` avec CPython local (3.14 aussi) : pas de Pyodide côté Node.
- **Timeout** : chaque test est un message séparé au worker ; au-delà du délai (3 s / test, 10 s pour un
  programme ou une simulation), `worker.terminate()` puis relance automatique. Après 2 timeouts, les tests
  suivants sont marqués « non lancés ». Côté CPython, `signal.setitimer`.
- **input() / readkey() interactifs** : le programme est **rejoué depuis le début** avec la liste des saisies
  (même graine aléatoire) ; quand il attend une nouvelle saisie, le runner lève `NeedInput`/`NeedKey`.
  Ainsi Python reste synchrone dans le worker sans SharedArrayBuffer (compatible GitHub Pages).
- **Tests et `input()`** : dans les tests, le texte affiché par `input(prompt)` n'est pas compté dans la sortie.
- **Routage** : `HashRouter` + `base: './'` → fonctionne sur n'importe quel hébergeur statique.
- **Déverrouillage** : un monde numéroté s'ouvre quand tous les niveaux (hors boss) du précédent sont faits ;
  le parcours Wordle est ouvert dès le début ; les boss jumeaux/examen s'ouvrent après le boss guidé du même
  projet. Réglage « Tout débloquer » pour sauter ce qu'on maîtrise.
- **Étoiles** : 1 = réussi, 2 = sans indice, 3 = sans indice et du premier coup (Golf : sous le par ;
  Speed Read : sous le temps ; QCM : 60/80/100 % ; Table de vérité : expression courte si `simple_len`).
- **Cœurs** (boss) : 3, communs à tous les boss, 1 cœur perdu quand une fonction *déjà commencée* (plus un
  simple `pass`) échoue ; +1 cœur toutes les 10 min ou en réussissant un niveau de révision.
- **Barème des examens** : par fonction, 70 % tests (visibles + cachés), 15 % signature exacte,
  15 % lisibilité (docstring gardée, pas de `print` parasite, longueur raisonnable). Total ramené à 20.
- **iCloud** : `node_modules`, `dist` et `.venv` portent l'attribut `com.apple.fileprovider.ignore#P`
  (non synchronisés).
- Shims : `rich_lite`, `readchar_lite`, `canvas` (≈ pygame), `folium_lite` (rendu Leaflet). L'énoncé donne
  toujours le vrai nom de la bibliothèque et la différence en une ligne.
- **Listes de mots** : `words_en_5.txt` = mots de 5 lettres du dictionnaire Webster (domaine public, fourni par
  macOS) ∪ liste de mots courants écrite à la main ; `secrets_en_5.txt` = mots courants seulement (pour le mot
  secret) ; `words_fr_*.txt` = mots français courants sans accents, écrits à la main.
- **verify-content** : jobs passés à Python par fichier temporaire (pas de pipe stdin). Pour le `starter_code`, on
  s'arrête au premier test raté (timeout court) ; une contrainte AST violée compte comme un échec (Golf, Refactor).
  Les niveaux qui utilisent `random` sont rejoués avec 3 autres états aléatoires pour détecter les tests instables.
- **Comparaison** : les nombres numpy (`np.int64`…) sont acceptés comme des `int`/`float` Python.
- **Boss** : timeout de 10 s par test (projets plus lourds). Les jumeaux et examens s'ouvrent après le boss guidé
  du même projet (`project: "wordle:mastermind"` → racine `wordle`). Un boss peut figurer dans plusieurs mondes
  (le boss Wordle est dans le parcours express et dans le monde 9).
- **Examen final** : un boss jumeau non battu tiré au hasard, ouvert en mode examen (`?final=1`, 90 min, sans
  indice). Les notes sont toujours ramenées sur 20 (proportionnellement aux points du barème). ≥ 10/20 → certificat
  + monde secret.
- **Sujet blanc** (Mode révision DS) : 5 à 8 niveaux `code_fill`/`bug_hunt`/`copy`/`refactor`/`predict_output`
  (difficulté ≥ 2) tirés des mondes choisis, au plus un tiers de « Devine la sortie ».
- **Données inventées** : métro de « Néo-Strasbourg » (`metro_*.csv`), vélos (`velo_stations.csv`).
- **Police d'affichage** (Pixelify Sans) : ligatures désactivées (le « fi » est cassé dans la fonte).
- `npm run build` ne lance pas Python (Vercel n'a pas matplotlib) ; la CI lance `verify-content` avant le build
  (`npm run build:ci` fait les deux en local).

## Contenu (état actuel)

235 niveaux dont 26 boss : mondes 0 à 12, parcours express Wordle (21 niveaux + 4 boss), monde secret (8 niveaux).
Boss : videur (monde 1) ; 421 + Yams + examen ; Tennis + ping-pong + examen ; Recamán + Syracuse + examen ;
Boids + gravité + examen ; Épidémie + Jeu de la vie + feu de forêt ; Wordle + Mastermind + Motus + examen à
variantes ; Métro + vélos + examen CSV « à la française » ; 2048 + Snake + examen 4×4/5×5.
