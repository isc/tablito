# Multiplix

App d'apprentissage des tables de multiplication (PWA, sans backend).

## Stack

- Approche **nobuild** : ESM natif côté navigateur via import maps.
  Pas de bundler. Voir `BASE=/multiplix/ npm run build`.
- **Preact 10** vendoré dans `vendor/preact/` (fichiers ESM publiés tels
  quels sur npm, copiés par `npm run vendor`). Le code applicatif
  importe `react`/`react-dom` — l'import map (prod + dev + vitest)
  redirige vers `preact/compat`.
- **TypeScript** vérifié par `tsc -b` (noEmit). esbuild fait la
  transformation .tsx → .js (à la volée en dev, en pré-build pour
  prod). Aucune autre étape de transpilation.
- **Service Worker** maison (`scripts/sw.js`, ~50 lignes) : précache
  shell + lazy-cache média + navigation fallback offline.
- localStorage pour la persistance (pas de backend).
- Déploiement : GitHub Pages via GitHub Actions (`BASE=/multiplix/`).
- Node minimum : 22.12+ (CI utilise Node 22).

## Structure

- `src/lib/` — logique métier (Leitner, sélection de questions, similarité, badges, stockage)
- `src/components/` — composants UI réutilisables
- `src/screens/` — écrans de l'app
- `src/hooks/` — hooks custom (son, timer, streak, confetti)
- `scripts/` — tooling (dev server, build, preview, vendor, SW templates)
- `vendor/preact/` — Preact ESM vendoré (régénéré par `npm run vendor`)
- `index.html` — entry avec import map
- `specs-multiplix.md` — spécifications fonctionnelles complètes
- `TODO.md` — évolutions techniques envisagées (pistes non tranchées)

## Commandes principales

- `npm run dev` — dev server (port 5174, transformation à la volée)
- `npm run build` — produit `dist/` statique (tsc -b + scripts/build.mjs)
- `npm run preview` — sert `dist/` en local (port 5175)
- `npm run vendor` — re-vendore Preact depuis `node_modules/`
- `npm test` — vitest (alias `react` → `preact/compat`)

## Guide utilisateur

Un guide HTML avec captures d'écran est généré par `npm run user-guide` (script `scripts/generate-user-guide.mjs`) et déployé à `/multiplix/guide/`.

## Changelog in-app

`src/lib/changelog.ts` alimente la page « Nouveautés » de l'espace parent. Le seuil est élevé : une entrée doit valoir le coup pour le parent qui ouvre la page. On y met les **vraies nouveautés fonctionnelles** (nouvelle feature, changement de comportement notable, bug fixe que le parent avait remarqué). On n'y met PAS les fixes d'UX mineurs (polish, scroll, espacement, typo), les refactos, le CI, le lint, ni les changements purement techniques. Au moindre doute : ne pas ajouter.

## Génération des MP3 TTS

Les voix sont pré-générées via `scripts/generate-tts.mjs` (Mistral Voxtral) et checked-in dans `public/audio/tts/`. Le script est idempotent : il ne régénère que les fichiers manquants.

**Quand ajouter un MP3** : ajouter une entrée dans `scripts/generate-tts.mjs` avec une nouvelle `key` et le `text` correspondant, puis générer.

**Comment générer** (la clé API n'est jamais en clair dans le repo) :

- **Depuis une session avec la clé en env local** : `node scripts/generate-tts.mjs` puis `git add public/audio/tts && git commit && git push`.
- **Depuis CI / session remote sans la clé** : déclencher le workflow dédié qui utilise le secret repo `MISTRAL_API_KEY` et commit les MP3s sur `main` :
  ```bash
  gh workflow run generate-tts.yml
  gh run watch  # suivre l'exécution
  git pull      # récupérer le commit assets(tts) créé par le workflow
  ```
  Le workflow est défini dans `.github/workflows/generate-tts.yml` et déclenchable manuellement (`workflow_dispatch`).
