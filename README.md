# 🐍 PyArcade — apprendre Python en jouant

Un site d'arcade 100 % statique : plus de 230 mini-niveaux (15 types de jeux), 26 boss qui reprennent la structure
de vrais TP de L1 (421, Tennis, Recamán, Boids, Épidémie, Métro, 2048 et, en priorité, **Wordle**), et des jeux
qui tournent **avec le code du joueur**. Python s'exécute dans le navigateur (Pyodide, dans un Web Worker).

```bash
npm install
npm run dev              # http://localhost:5173
npm run verify-content   # vérifie tous les niveaux (Python 3.14 + matplotlib : voir CLAUDE.md)
npm run test             # tests unitaires (Vitest)
npm run e2e              # parcours critiques (Playwright, réseau requis pour Pyodide)
npm run build            # site statique dans dist/
```

Ajouter un niveau = ajouter un fichier YAML dans `content/` (schéma : `src/content/schema.ts`). Conventions et
décisions techniques : [CLAUDE.md](CLAUDE.md). Déploiement : GitHub Pages (workflow `.github/workflows/ci.yml`) ou Vercel (`vercel.json`).

Les énoncés sont originaux ; les données du métro et des vélos sont inventées ; la liste de mots anglais vient du
dictionnaire Webster de 1934 (domaine public), complétée par des mots courants.
