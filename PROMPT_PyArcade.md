# PROMPT POUR CLAUDE CODE — « PyArcade » : apprendre Python en jouant

> Copie ce fichier à la racine d'un dossier vide, puis lance Claude Code et écris :
> **« Lis PROMPT_PyArcade.md et construis le projet en suivant ses phases. »**

---

## 0. Ta mission

Tu es un développeur full‑stack senior et un concepteur pédagogique. Construis **PyArcade**, un site web d'arcade où l'on apprend à programmer en **Python** à travers des centaines de mini‑jeux courts, de difficulté progressive, et assez prenants pour qu'on ait envie de faire « encore un niveau ».

**Objectif final mesurable :** quelqu'un qui a validé tout le site doit pouvoir réussir seul, en temps limité, un TP universitaire de niveau L1 de ce type (cours *Algorithms and Software Concepts*, programme AIDAMS CentraleSupélec/ESSEC) :

| # | Projet de référence | Ce qu'il exige vraiment |
|---|---|---|
| 1 | **421 (jeu de dés)** | petites fonctions, booléens, `if/elif`, tuples (plusieurs valeurs renvoyées), `random`, tri de 3 valeurs, astuce « une valeur numérique par combinaison » au lieu d'un nid de `if`, piège des flottants (`1.632` qui affiche `1.6320000000000001`), boucle de jeu en 2 phases |
| 2 | **Simulation de tennis** | `random() < p` pour un événement de probabilité p, conditions booléennes subtiles (« le jeu n'est pas fini tant que… », avantage à 2 points), boucles `while` pilotées par une condition, fonctions imbriquées point → jeu → set → match, paramètres par défaut, simulation Monte Carlo, courbes `matplotlib` |
| 3 | **Suite de Recamán** | listes, test d'appartenance `in`, construire une suite terme à terme, `abs`, premier doublon, premier entier manquant, compter des présences, coût de `in` sur une liste (vs `set`) |
| 4 | **Carte du U‑Bahn de Berlin** | lire un CSV **à la main** (`open`, `split`, `strip`, conversion de types) puis avec le module `csv`, dictionnaire de dictionnaires, calcul d'un centre (moyennes), dessin de points/lignes sur une carte, assembler de petites fonctions en programme complet |
| 5 | **Épidémie SIR** | grille = liste de listes de dicts `{"state": "S", "sick_days": 0}`, `grid[y][x]`, compréhensions imbriquées (et le piège `[[0]*n]*n`), voisins (4 directions) avec gestion des bords, calculer l'état suivant **à partir de l'ancienne grille**, compter, historiques, courbes, vaccination et seuil d'immunité collective |
| 6 | **Boids (nuée)** | vecteurs = tuples `(x, y)`, fonctions vectorielles (`v_add`, `v_sub`, `v_mul`, `v_len`, `v_dist`, `steer`…), parcourir/agréger des listes de vecteurs, dict pour une entité, 3 règles (séparation, alignement, cohésion), un prédateur, boucle d'animation |
| 7 | **2048 (projet final)** | programmation **fonctionnelle sans classes**, état du jeu dans un dict (`grid`, `score`, `game_over`, `size`), `merge_line_left`, transposition et inversion de grille pour réutiliser une seule fonction dans 4 directions, `can_move`, architecture **MVC** (modèle pur / vue `rich` / contrôleur `readchar`), boucle de jeu |
| 8 | **⭐ WORDLE — PRIORITÉ, l'étudiant est évalué dessus** | chaînes (indexation, parcours, `lower`/`upper`, `strip`, `len`, `in`), lire un fichier de mots, filtrer par longueur, `random.choice`, valider une proposition (bonne longueur, lettres seulement, mot du dictionnaire, déjà proposé), **évaluer une proposition en gérant correctement les lettres en double** (algorithme en 2 passes avec un dict de compteurs), boucle de 6 essais avec conditions de victoire/défaite, état du jeu dans un dict, affichage coloré en console (`rich`), état du clavier (meilleure couleur connue par lettre), statistiques (parties, % victoires, série, histogramme des essais), bonus : mode difficile, solveur qui filtre les mots compatibles |

Signatures réelles rencontrées dans ces TP (à utiliser comme cibles pour les boss, cf. §5) :
`roll_die, throw_dice, sort_dice(a,b,c), are_421, are_three_of_a_kind, are_two_aces, are_straight, combination_value, combination_chips, combination_name, play_turn_phase1…` —
`win_point(level_a, level_b), win_game(…, advantage=True), win_set(…), win_match(level_a, level_b, nb_sets, …)` —
`next_term(previous, step, sequence), recaman(n), check_differences, first_duplicate, first_missing, count_present` —
`read_stations(file_path), read_connexions(file_path), compute_center(stations), add_marker, add_edge, create_complete_map` —
`create_grid, infect(grid,x,y), count_sick_neighbors, catches_infection, next_cell, step, count_state, run_epidemic, create_vaccinated_grid, epidemic_reach` —
`v_mul, v_len2, v_len, v_add, v_sub, v_dist, vsum, steer, random_vector, create_boid, neighbors, separation, alignment, cohesion, update, move, nearest_target, flee_hunter` —
`create_game_state(size=4), get_empty_cells, add_random_tile, merge_line_left, transpose_grid, reverse_grid_rows, move_left/right/up/down, can_move, update_game_over, play_move, game_loop`.

Pour le **Wordle**, le sujet officiel n'est pas encore connu. Utilise ce découpage plausible, dans le même style que les autres TP, et prévois qu'il soit facile à adapter si l'étudiant fournit le vrai sujet :
`load_words(file_path, length=5)`, `choose_secret(words)`, `normalize(word)` (minuscules, sans espaces ni accents), `is_valid_guess(guess, words, length=5)` (renvoie `(bool, message)`), `count_letters(word)` (dict lettre → nombre, écrit à la main avant de découvrir `collections.Counter`), `evaluate_guess(guess, secret)` → liste de `"green"/"yellow"/"grey"` (ou `"G"/"Y"/"-"`), `is_won(feedback)`, `create_game_state(secret, max_attempts=6)`, `play_guess(state, guess)`, `update_keyboard(keyboard, guess, feedback)`, `render_guess(guess, feedback)`, `render_board(state)`, `game_loop()`, `update_stats(stats, won, nb_attempts)`, et en bonus `filter_candidates(words, guess, feedback)` et `best_guess(candidates)`.

⚠️ **Droits d'auteur :** n'utilise jamais le texte de ces TP mot pour mot. Écris tes propres énoncés, ton propre récit et tes propres tests. Seules la *structure* (fonctions à compléter, signatures imposées, vérifications) et la *difficulté* doivent être les mêmes.

**Le format d'examen à reproduire partout :** on donne la signature, la docstring et des exemples `# -> attendu`. L'étudiant remplace `pass`. Chaque fonction se teste seule, puis les fonctions s'assemblent en un programme qui marche. Le site doit rendre ce format **naturel**.

---

## 1. Stack technique (décisions déjà prises, ne pas rediscuter)

- **Front :** Vite + React + TypeScript + Tailwind CSS. Routing : React Router. État : Zustand (persisté).
- **Exécution Python dans le navigateur :** **Pyodide** dans un **Web Worker** (aucun serveur d'exécution).
  - Timeout configurable (par défaut 3 s par test, 10 s pour les simulations) ; si une boucle infinie dépasse le délai → `worker.terminate()`, relance automatique et message clair : « Ta boucle ne s'arrête jamais : vérifie la condition de ton `while`. »
  - Pré‑charger Pyodide pendant l'écran d'accueil, avec une barre de progression ludique.
  - Paquets Pyodide : `matplotlib` (rendu PNG/SVG affiché dans la page) et `numpy` seulement si nécessaire.
- **Éditeur :** CodeMirror 6 (coloration Python, indentation auto à 4 espaces, raccourci `Ctrl/Cmd+Entrée` = lancer les tests). Thèmes d'éditeur à débloquer (cf. §6).
- **Persistance :** `localStorage` (via Zustand persist) + **export/import JSON** de la progression. Pas de backend, pas de compte en V1. Prévoir une interface `ProgressRepository` pour brancher Supabase plus tard.
- **Contenu :** tous les niveaux sont des **fichiers de données** (YAML ou MDX + frontmatter) dans `/content`, validés par un schéma **zod**. Ajouter un niveau ne doit demander aucun code.
- **Tests du projet :** Vitest (logique), Playwright (parcours critiques), et surtout le script `npm run verify-content` (cf. §7).
- **Déploiement :** site 100 % statique (GitHub Pages ou Vercel). Ajoute la config.
- **Langue :** interface en **français** avec un bouton FR/EN. Le **code, les noms de fonctions et les docstrings sont en anglais**, comme dans le cours, pour que l'étudiant soit à l'aise avec le vocabulaire de l'examen.
- Responsive : les jeux sans éditeur (QCM, prédire la sortie, Parsons…) doivent bien marcher sur mobile ; les jeux avec éditeur sont pensés pour un ordinateur, mais restent utilisables sur tablette.

---

## 2. Le moteur d'exercices (le cœur)

### 2.1 Schéma d'un niveau (`/content/<monde>/<id>.yaml`)
```yaml
id: w3-l07
world: 3
type: code_fill          # cf. §3
title: "Le compte à rebours"
concepts: [while, condition_arret, compteur]
difficulty: 2            # 1 à 5
estimated_minutes: 4
xp: 30
story: "…"               # 1–3 phrases maximum, ton fun
statement_md: "…"
starter_code: |
  def countdown(n):
      """Return the list [n, n-1, ..., 1] using a while loop."""
      pass
tests:                   # tests visibles (exemples) + tests cachés
  visible:
    - call: "countdown(3)"
      expected: "[3, 2, 1]"
  hidden:
    - call: "countdown(0)"
      expected: "[]"
  random_seed: 42        # si l'exercice utilise random
  statistical:           # pour les simulations : tolérance
    - expr: "sum(win_point(60,40) for _ in range(20000))/20000"
      approx: 0.6
      tol: 0.02
constraints:             # vérifiées avec le module ast de Python
  required: [While]
  forbidden: [For, ClassDef, "call:sum"]
  max_lines: 12
hints:                   # 3 niveaux, de plus en plus précis
  - "Concept : …"
  - "Pseudo‑code : …"
  - "Début de code : …"
solution: |
  …
explanation_md: "…"      # montré après réussite : pourquoi ça marche + variante
exam_tip: "…"            # « Ce que le correcteur attend ici »
```

### 2.2 Le test runner (Python, dans le worker)
- Exécute le code de l'étudiant dans un namespace isolé, puis chaque test ; renvoie pour chaque test : réussi/échoué, valeur obtenue vs attendue, stdout, exception.
- Comparaison intelligente : flottants avec tolérance (`math.isclose`), listes et tuples, dicts, `None`. Message spécial si la fonction **affiche** au lieu de **renvoyer** (`print` vs `return`) : c'est l'erreur n° 1 des débutants.
- **Traducteur de traceback :** convertit les erreurs Python en explications courtes en français, avec la ligne surlignée dans l'éditeur. Exemples : `IndexError` → « Tu as lu la case n° 4 d'une liste qui n'a que 4 cases (indices 0 à 3). » ; `TypeError: 'NoneType'…` → « Une de tes fonctions ne renvoie rien (`return` oublié ?). » ; `UnboundLocalError`, `KeyError`, `ValueError: invalid literal for int()` (lecture de CSV), `RecursionError`, `ZeroDivisionError`, `IndentationError`.
- Vérification des contraintes par **AST** (construction obligatoire ou interdite, nombre de lignes, « pas de classes » pour le style fonctionnel du 2048, « ne modifie pas la grille d'origine »).
- **Détection d'effet de bord :** le runner peut vérifier qu'une fonction « pure » n'a pas modifié ses arguments (copie profonde avant/après l'appel).
- Pour l'aléatoire : `random.seed` fixé pour les tests déterministes ; tests statistiques avec tolérance pour les simulations (comme dans le TP tennis).

### 2.3 Shims pédagogiques (bibliothèques du cours qui ne tournent pas dans le navigateur)
Crée des modules Python légers, exposés dans Pyodide, qui imitent la partie utile de l'API réelle et dessinent dans la page :
- `rich_lite` (Console, Table, styles de cases) → rendu HTML d'une grille pour le 2048 ;
- `readchar_lite` → touches du clavier envoyées par la page (flèches / ZQSD / WASD) ;
- `canvas` (API minimale façon pygame : `clear`, `polygon`, `circle`, `line`, boucle `on_frame`) → `<canvas>` HTML pour les boids et l'épidémie ;
- `folium_lite` (`Map`, `CircleMarker`, `PolyLine`, `.add_to(m)`) → rendu **Leaflet** pour la carte de métro.
Dans l'énoncé, indique toujours le vrai nom de la bibliothèque et explique en une ligne la différence avec la version du site, pour que l'étudiant sache écrire le vrai code le jour de l'examen.

---

## 3. Les types de mini‑jeux (varier sans cesse : c'est ce qui rend le site prenant)

Chaque monde mélange **au moins 6 types**. Ne jamais enchaîner plus de 2 niveaux du même type.

1. **Code Fill** — remplacer `pass` (le format de l'examen). Tests visibles et tests cachés.
2. **Devine la sortie** — lire un code court et taper exactement ce qu'il affiche. Version chronométrée « Speed Read ». Indispensable pour l'examen écrit.
3. **Chasse au bug** — un code presque juste : trouve et corrige le bug. Plusieurs bugs = plusieurs vies. Utilise les pièges classiques du §8.
4. **Puzzle de Parsons** — remettre les lignes mélangées dans l'ordre **et** à la bonne indentation (glisser‑déposer, flèches ← → pour indenter). Lignes « leurres » aux niveaux avancés.
5. **Trace‑moi ça** — remplir le tableau des valeurs des variables à chaque tour de boucle. Mode « pas à pas » animé une fois validé.
6. **Table de vérité** — écrire LA condition booléenne qui donne exactement le tableau True/False demandé (entraînement aux conditions subtiles du tennis : avantage, « pas encore fini »). Bonus si l'expression est simplifiée (De Morgan).
7. **Robot de grille** — déplacer un robot sur une grille avec `move()`, `turn_left()`, boucles et conditions (`if wall_ahead()`). Visuel, pour les tout premiers mondes ; prépare la notion de coordonnées `grid[y][x]`.
8. **Écris le test** — on te donne 4 implémentations, dont 3 fausses ; écris les `assert` qui éliminent les fausses sans éliminer la bonne. Apprend à penser aux cas limites.
9. **Code Golf** — la solution la plus courte qui passe les tests (3e étoile = sous le seuil de caractères). Fait découvrir les compréhensions, `sum`, `max(…, key=…)`, etc.
10. **Course contre la montre / Gros volume** — le même problème avec une entrée de 10⁵ éléments : une solution naïve dépasse le délai. Fait sentir pourquoi `in` sur un `set` est plus rapide que sur une liste (Recamán), ou pourquoi il ne faut pas recalculer en boucle.
11. **Refactor** — remplacer un enchaînement de `if/elif` par une table, un dict ou une formule (comme l'astuce « valeur = jetons + décimale de départage » du 421), sans casser les tests.
12. **Assemble la machine** — plusieurs fonctions déjà écrites (certaines par toi dans les niveaux précédents) à brancher dans le bon ordre pour obtenir un programme complet (boucle de jeu, `main`).
13. **QCM éclair** — 10 questions en 60 s sur les types, le slicing, la mutabilité, la portée des variables. Combo ×2, ×3…
14. **Simulation à régler** — l'étudiant écrit la règle (ex. `next_cell`), puis joue avec des curseurs (probabilité d'infection, part de vaccinés, poids de la cohésion) et voit l'effet en direct, avec une petite question d'observation (« À partir de quel taux de vaccination l'épidémie ne décolle plus ? »).
15. **Mode copie (sans exécution)** — écrire la fonction **sans pouvoir la lancer**, une seule soumission, comme sur un DS papier. XP doublée.

---

## 4. Le parcours : 13 mondes + boss

Carte du monde façon Duolingo/Mario (chemin sinueux, nœuds, boss en fin de monde). Chaque monde = **12 à 18 niveaux** de 2 à 8 min, d'abord des **mini‑leçons interactives de moins de 2 minutes**, puis des exercices d'aide de moins en moins présente. Chaque monde se termine par un **Boss** (§5) qui ne se débloque qu'avec un nombre minimum d'étoiles.

| Monde | Thème | Contenu clé | Boss |
|---|---|---|---|
| 0 | **Premiers pas** | `print`, variables, `int/float/str/bool`, opérateurs, `//`, `%`, `**`, `input`, f‑strings | — (tutoriel) |
| 1 | **Booléens & conditions** | comparaisons, `and/or/not`, priorité des opérateurs, `if/elif/else`, De Morgan, valeurs « vraies » et « fausses » | « Le videur de boîte » |
| 2 | **Fonctions** | `def`, `return` vs `print`, paramètres, paramètres par défaut, renvoyer un tuple, docstrings, fonctions pures, portée des variables, composer des fonctions | — |
| 3 | **Hasard** | `random()`, `randint` (bornes **incluses**), `choice`, `uniform`, `random() < p`, graine, fréquence observée vs probabilité | **🎲 Boss 421** |
| 4 | **Boucles** | `while` piloté par une condition, `for`/`range`, accumulateurs, compteurs, `break`, boucles imbriquées, simuler N fois (Monte Carlo) | **🎾 Boss Tennis** |
| 5 | **Listes** | indexation, indices négatifs, slicing, `append`, `in`, `len`, parcours avec indice et `enumerate`, chercher/compter/min/max à la main, `sorted` vs `.sort()`, compréhensions | **♾️ Boss Recamán** |
| 6 | **Tuples & vecteurs** | déballage, immuabilité, fonctions vectorielles, normes et distances, `math.sqrt`, moyenne de vecteurs | **🐦 Boss Boids** |
| 7 | **Grilles (listes de listes)** | créer une grille **sans** le piège d'aliasing, `grid[y][x]`, parcours en double boucle, voisins avec gestion des bords (et le piège des indices négatifs qui « bouclent »), transposer, inverser, copier vs copier en profondeur | — |
| 8 | **Dictionnaires** | dict comme enregistrement, dicts imbriqués, compter avec un dict, liste de dicts, dict de dicts, `.get`, `.items()`, état de jeu sous forme de dict | **🦠 Boss Épidémie** |
| 9 | **Chaînes & fichiers** | parcourir une chaîne, indices, `lower/upper`, `isalpha`, `split`, `strip`, `join`, `replace`, compter des lettres avec un dict, conversion de types, `open`/`with`, lire un fichier de mots puis un CSV à la main et avec `csv` (`reader`, `DictReader`), en‑tête, lignes vides | **🟩 Boss Wordle** puis **🚇 Boss Métro** (ville différente, ex. Paris ou Strasbourg, avec un faux jeu de données) |
| 10 | **Algorithmes classiques** | recherche, premier/dernier qui vérifie une condition, doublons, premier manquant, tri à la main (sélection/insertion), complexité intuitive, `set` | — |
| 11 | **Visualiser des données** | `matplotlib` : `plot`, plusieurs courbes, légende, axes, `imshow` d'une grille, histogrammes ; interpréter une courbe | — |
| 12 | **Architecture & projet** | style fonctionnel sans classes, état dans un dict, modèle pur / vue / contrôleur (MVC), boucle de jeu, découper un problème en fonctions testables, lire un énoncé long | **🟧 Boss Final 2048** |

**Monde secret (débloqué après le 2048) :** récursivité, classes et POO, `set`/`dict` avancés, algorithmes de graphes (BFS sur le réseau de métro pour trouver le plus court trajet), IA qui joue au 2048. C'est du bonus, au‑delà du niveau des TP.

---

## 5. Les Boss = de vrais TP, en version jeu

Un boss reprend **exactement le format** d'un TP de référence : une suite de 8 à 15 fonctions aux signatures imposées, chacune avec ses vérifications, de plus en plus difficiles, chacune réutilisant les précédentes.

**Mécanique de combat :** le boss a une barre de vie, et chaque fonction validée lui retire des PV avec une animation. Une erreur de test fait perdre un cœur (3 cœurs, ils se rechargent avec le temps ou en refaisant un niveau de révision).

**La récompense qui rend accro :** quand toutes les fonctions sont validées, **le site lance le vrai jeu, propulsé par TON code**. Ton `merge_line_left` fait tourner le 2048 auquel tu joues ; tes règles de boids font voler la nuée ; ta fonction `next_cell` propage l'épidémie sur le canvas ; ton `read_stations` dessine la carte. Affiche‑le en grand : « ⚡ Ce jeu tourne avec tes 14 fonctions. »

Pour chaque boss, crée **3 versions** :
1. **Boss guidé** : la structure du TP, avec indices.
2. **Boss jumeau** : un **projet nouveau mais de même structure**, pour vérifier qu'on sait transférer. Exemples :
   - 421 → Yams/Yahtzee simplifié ou Pig (jeu de dés) ;
   - Tennis → match de ping‑pong (11 points, 2 d'écart) ou tirs au but ;
   - Recamán → suite de Syracuse/Collatz, suite « Look‑and‑say », crible d'Ératosthène ;
   - Métro de Berlin → réseau de tram de Strasbourg ou de vélos en libre‑service (CSV inventés) ;
   - Épidémie → feu de forêt (automate cellulaire) ou Jeu de la vie de Conway ;
   - Boids → particules et gravité, ou banc de poissons avec un requin ;
   - 2048 → Snake ou Puissance 4 en style fonctionnel + MVC ;
   - Wordle → Mastermind (couleurs : même algorithme bien placé/mal placé), Motus (première lettre donnée, mots de 6 à 9 lettres), Pendu, et Wordle à longueur variable ou « Quordle » (4 mots en même temps).

### 5.1 Boss Wordle (prioritaire)
- **Parcours express Wordle :** accessible **dès le début** depuis l'accueil (sans débloquer les mondes), environ 15 à 20 niveaux. Il reprend uniquement les prérequis : chaînes, boucles `for` sur une chaîne et avec indices, listes, dict de compteurs, lecture de fichier, `random.choice`, `while` avec compteur d'essais. Puis il mène au Boss Wordle. Afficher une jauge « Prêt pour l'évaluation Wordle : 0 → 100 % ».
- **Mini‑jeux dédiés aux lettres en double**, le point où tout le monde se trompe : « Devine la couleur » (on donne `secret` et `guess`, l'étudiant colorie les cases à la main, par ex. `secret="apple"`, `guess="paper"` ; `secret="abbey"`, `guess="babes"` ; `secret="crane"`, `guess="eerie"`), Chasse au bug sur une version naïve en une seule passe qui colore trop de lettres en jaune, et un Écris le test qui doit démasquer cette version naïve.
- **Tests cachés obligatoires pour `evaluate_guess` :** lettres en double dans le secret, dans la proposition, dans les deux ; une lettre à la fois bien placée et présente ailleurs ; mot identique ; aucune lettre commune ; majuscules en entrée.
- **Jeu en direct :** à la fin, un vrai Wordle jouable (grille 6×5, clavier virtuel coloré, animation de retournement des cases), propulsé par les fonctions de l'étudiant. Puis une version console avec `rich_lite`, identique à ce qui sera attendu en Python pur.
- **Bonus débloqués :** mode difficile (réutiliser les indices trouvés), statistiques persistées et histogramme `matplotlib`, solveur qui propose le meilleur mot, et un « Wordle du jour » sur le site (même mot pour tout le monde, graine = date).
- **Boss examen Wordle :** sujet complet en 90 min, sans indices, noté sur 20 avec un barème. Il doit pouvoir être rejoué avec des variantes (longueur des mots, nombre d'essais, sortie en symboles au lieu de couleurs) pour ne pas apprendre une seule version par cœur.
3. **Boss examen** : chronométré (60 à 120 min), **sans indices**, mode copie optionnel, note sur 20 avec un barème détaillé par fonction (correction, cas limites, lisibilité, respect de la signature).

**Examen final « Diplôme PyArcade » :** un projet tiré au hasard parmi les jumeaux non encore faits, en conditions réelles. Le réussir débloque un certificat imprimable et le monde secret.

---

## 6. Rendre le jeu addictif (mais sain)

**Boucle de base :** niveau court → retour immédiat (vert/rouge, son, confettis) → récompense → bouton **« Niveau suivant »** déjà mis en avant (passage automatique en 3 s, annulable). Le prochain objectif doit toujours être visible.

- **XP et niveaux de joueur** avec des titres qui montent : *Script Kiddie → Débogueur → Pythonista → Algorithmicien → Architecte → Grand Maître du `pass`*.
- **Étoiles par niveau (1 à 3) :** ⭐ réussi · ⭐⭐ sans indice · ⭐⭐⭐ sans indice et du premier coup (ou sous le temps ou le nombre de caractères visé). Afficher les étoiles manquantes donne envie de refaire.
- **Série (streak) quotidienne** 🔥 avec 1 « gel de série » gagnable par semaine, et un calendrier façon GitHub des jours actifs.
- **Défi du jour :** un niveau spécial, le même pour tout le monde ce jour‑là (graine = date), qui rapporte XP ×2.
- **Quêtes hebdomadaires :** « Résous 5 Chasses au bug », « 3 niveaux en mode copie », « Bats ton propre record en Speed Read ».
- **Pièces 🪙 :** gagnées en jouant, dépensées en indices (indice 1 = 5, indice 2 = 15, indice 3 = 40) ou en cosmétiques. Jamais d'argent réel.
- **Cosmétiques à débloquer :** thèmes d'éditeur (Dracula, Matrix, Terminal rétro, Synthwave), skins de robot, sons, avatars, titres. Un **coffre mystère** à la fin de chaque monde.
- **Succès / badges** (une cinquantaine), dont des secrets : « Off‑by‑one » (avoir fait 10 fois l'erreur puis l'avoir corrigée), « Zéro `pass` » (boss sans erreur), « Noctambule », « Golfeur », « Herd Immunity » (trouver le seuil de vaccination), « 2048 atteint avec ton propre code », « Le flottant m'a eu », « Maître des doublons » (15 cas de lettres en double réussis), « En 2 » (Wordle trouvé en 2 essais avec ton propre code).
- **Combos** dans les QCM éclair et Speed Read : multiplicateur, compte à rebours, sons qui montent.
- **Fantôme :** en mode chrono, une barre « fantôme » montre ton meilleur temps précédent. Bats‑toi toi‑même.
- **Classement local et profils** sur la même machine (plusieurs prénoms), utile pour jouer à plusieurs. Prévoir l'interface pour un classement en ligne plus tard.
- **Jauge de maîtrise par concept :** un graphique radar (conditions, boucles, listes, dicts, grilles, fichiers, fonctions, hasard, débogage) dont les branches montent. Cliquer sur une branche faible lance un entraînement ciblé.
- **Révisions espacées :** les concepts sur lesquels on a échoué reviennent sous forme de mini‑niveaux 1, 3, 7 et 14 jours plus tard (« 🔁 3 révisions t'attendent, 2 min »). C'est ce qui ancre les connaissances.
- **« Presque fini » :** les barres de progression du monde et du boss restent toujours visibles. Le cerveau veut les compléter.
- **Jeux bonus débloqués** (à rejouer sans fin) : le 2048, le 421 contre l'ordinateur, la nuée de boids, tous propulsés par le code du joueur.
- **Garde‑fous :** après 45 min d'affilée, une petite fenêtre propose une pause, que l'on peut fermer. Pas de notifications culpabilisantes ni de mécanique payante.

---

## 7. Pédagogie : règles de conception du contenu

1. **Une seule nouvelle idée par niveau.** Les niveaux 1 à 3 d'un concept sont très guidés, puis l'aide diminue jusqu'au niveau « nu » (format examen).
2. **Exemple avant exercice :** chaque concept démarre par un exemple commenté et modifiable (« change ce 3 en 10 et relance »).
3. **Après chaque réussite :** une fiche concept courte (à garder dans un **Carnet** consultable), la solution de référence comparée à celle de l'étudiant, et un **« Conseil d'examen »** (ce que le correcteur attend : respecter la signature, ne pas `print` dans une fonction qui doit `return`, garder la docstring, ne pas modifier les paramètres…).
4. **Les erreurs sont du contenu :** chaque piège du §8 a au moins une Chasse au bug et une question Devine la sortie.
5. **Mélange (interleaving) :** à partir du monde 4, 20 % des niveaux de chaque monde reprennent d'anciens concepts.
6. **Lire de longs énoncés :** dans les mondes 10 à 12, les énoncés imitent ceux des TP (contexte, règles, tableau, signatures, exemples) pour entraîner à extraire l'information utile.
7. **Mode révision DS :** une page qui génère un **sujet blanc** de 5 à 8 exercices tirés des concepts choisis, chronométré, avec un corrigé détaillé.
8. **Volume visé en V1 complète :** au moins 200 niveaux (dont le parcours express Wordle), 8 boss guidés, 8 boss jumeaux, 8 boss examen, un examen final.
9. **Script `npm run verify-content` (obligatoire, lancé en CI) :** pour CHAQUE niveau, il vérifie que (a) le YAML respecte le schéma, (b) la `solution` passe 100 % des tests, (c) le `starter_code` échoue au moins à un test, (d) les contraintes AST sont respectées par la solution, (e) les tests statistiques passent 20 fois de suite avec des graines différentes. Un niveau qui échoue bloque le build.

---

## 8. Pièges classiques à intégrer (Chasse au bug, Devine la sortie, Conseils d'examen)

- `print` au lieu de `return`, ou un `return` oublié dans une branche → `None`.
- Décalage d'une case avec `range(n)` / `range(1, n+1)`, `len(l) - 1`.
- `=` au lieu de `==`, `is` au lieu de `==`.
- `randint(1, 6)` inclut le 6 ; `random()` ne renvoie jamais 1.
- Égalité de flottants : `0.1 + 0.2 == 0.3` est `False`, `1.632` qui devient `1.6320000000000001`. Utiliser `round` ou `math.isclose`.
- `[[0]*n]*n` → toutes les lignes sont **le même objet**.
- `grid[x][y]` au lieu de `grid[y][x]` ; voisin `grid[y-1][x]` quand `y = 0` → indice `-1` qui lit **la dernière ligne** sans aucune erreur.
- Mettre à jour une grille **sur place** pendant qu'on calcule l'étape suivante (l'épidémie doit lire l'ancienne grille).
- Modifier une liste pendant qu'on la parcourt.
- Paramètre par défaut mutable (`def f(l=[])`).
- Copie superficielle vs copie profonde d'une grille.
- Lecture de CSV : `\n` en fin de ligne, en‑tête lu comme une donnée, `"52.52"` resté une chaîne, ligne vide finale.
- Masquer un nom intégré (`list = …`, `sum = 0`, `max = …`).
- Condition de `while` jamais fausse (boucle infinie) ; condition d'arrêt mal écrite pour l'avantage au tennis.
- Division entière `//` vs `/` ; `%` sur des négatifs.
- Fonction censée être pure qui modifie l'état reçu en paramètre (2048).
- Comparaison de tuples (ordre lexicographique) : piège ou astuce selon les cas.
- **Wordle :** évaluer en une seule passe (une lettre comptée « jaune » alors que toutes ses occurrences sont déjà utilisées) ; oublier de décompter les lettres vertes **avant** de chercher les jaunes ; comparer `"Crane"` à `"crane"` sans normaliser la casse ; `"crane\n"` lu depuis le fichier sans `strip` ; accepter une proposition de mauvaise longueur ; boucle qui continue après une victoire ; compteur d'essais décalé de 1 ; modifier le mot secret (les chaînes sont immuables, mais une liste de lettres ne l'est pas).

---

## 9. Écrans à livrer

1. **Accueil :** titre animé, bouton « Jouer », reprise du dernier niveau, série du jour, défi du jour, révisions en attente.
2. **Carte des mondes :** chemin à défiler, nœuds avec étoiles, cadenas, boss, coffres.
3. **Écran de niveau :** à gauche, l'énoncé (récit, consignes, exemples, bouton d'indice) ; à droite, l'éditeur et la console ; en bas, les tests (pastilles vert/rouge, cliquer pour voir le détail attendu vs obtenu). Pour les jeux sans éditeur, une interface dédiée à chaque type (§3).
4. **Écran de boss :** barre de vie, liste des fonctions à valider (cochées au fur et à mesure), puis le **jeu en direct** propulsé par le code du joueur.
5. **Profil :** niveau, XP, radar de maîtrise, badges, calendrier, statistiques (temps passé, erreurs les plus fréquentes), export/import de la progression.
6. **Carnet :** toutes les fiches concept débloquées, avec recherche ; exportable en PDF (impression du navigateur) pour réviser avant un DS.
7. **Mode révision DS** et **Examen final.**
8. **Bac à sable :** un éditeur Python libre avec les shims (canvas, matplotlib, carte).
9. **Réglages :** son, animations réduites, thème clair/sombre, langue, taille de police, mode daltonien pour les pastilles.

**Direction artistique :** arcade néo‑rétro, propre et lisible (pas criard). Une police à chasse fixe nette pour le code (JetBrains Mono) et une police d'affichage à caractère pour les titres. Micro‑animations avec Framer Motion, confettis à la réussite, sons courts générés (Web Audio, aucun fichier lourd). Respecte `prefers-reduced-motion`. Contraste AA minimum.

---

## 10. Phases de construction (avance dans cet ordre et fais valider à chaque fin de phase)

**Phase 0 — Plan.** Lis tout ce fichier. Crée un `CLAUDE.md` avec les conventions du projet, l'arborescence et la commande pour vérifier le contenu. Propose‑moi l'arborescence et le schéma zod, puis attends mon OK.

**Phase 1 — Moteur (MVP jouable).** Pyodide dans un worker avec timeout, éditeur, test runner avec comparaisons intelligentes et traducteur de traceback, contraintes AST, schéma de contenu, `verify-content`, persistance, XP et étoiles. Contenu : monde 0 complet + 5 niveaux du monde 1, avec au moins 5 types de jeux différents (Code Fill, Devine la sortie, Chasse au bug, Parsons, QCM éclair).
✅ Critère : je peux jouer 15 niveaux d'affilée sans bug, et `npm run verify-content` passe.

**Phase 1 bis — 🟩 Wordle en priorité (l'étudiant est évalué dessus bientôt).** Parcours express Wordle complet (§5.1), avec ses mini‑jeux, son boss guidé, son jeu en direct, son boss examen et le jumeau Mastermind. Construis aussi le shim `rich_lite` dès cette phase. Fichier de mots : une liste anglaise de mots de 5 lettres, libre de droits, générée ou intégrée dans `/content/data/words_en_5.txt`, plus une liste française sans accents en option.
✅ Critère : un débutant qui a fini le monde 0 peut aller du parcours express jusqu'au Wordle jouable, et `evaluate_guess` est testé sur au moins 15 cas de lettres en double.

**Phase 2 — Gamification.** Carte des mondes, séries, défi du jour, pièces et indices, badges, coffres, sons, confettis, profil avec radar, révisions espacées, carnet.

**Phase 3 — Contenu mondes 1 à 6 + boss 421, Tennis, Recamán, Boids** (guidé + jumeau + examen), shim `canvas`, rendu `matplotlib`.

**Phase 4 — Mondes 7 à 12 + boss Épidémie, Métro, 2048** et shims `rich_lite`, `readchar_lite`, `folium_lite` (Leaflet). Types de jeux restants (Trace‑moi ça, Table de vérité, Robot, Écris le test, Golf, Gros volume, Refactor, Assemble, Simulation à régler, Mode copie).

**Phase 5 — Examens.** Mode révision DS, examen final, certificat, monde secret, tests Playwright des parcours clés, optimisation (taille du bundle, chargement différé de Pyodide), déploiement.

À chaque phase : lance les tests, corrige, puis donne‑moi un résumé court (ce qui marche, ce qui reste, comment tester en local avec `npm run dev`).

---

## 11. Règles de travail pour toi (Claude Code)

- Fais des commits petits et clairs à chaque étape qui fonctionne.
- N'invente pas de faux tests qui passent toujours : chaque niveau doit vraiment vérifier le comportement attendu, cas limites compris (liste vide, grille 1×1, `n = 0`, bords de grille, égalité de score…).
- Écris les solutions de référence dans le **style attendu à l'examen** (simple, lisible, fonctionnel, sans astuces obscures), sauf pour le Code Golf.
- Si une décision n'est pas couverte par ce document, choisis l'option la plus simple qui sert l'objectif (« savoir résoudre un TP de ce niveau seul »), note‑la dans `CLAUDE.md`, et continue.
- Avant de dire qu'une phase est terminée : lance `npm run build`, `npm run test` et `npm run verify-content`, et joue toi‑même (avec Playwright) au moins un niveau de chaque type ajouté.
