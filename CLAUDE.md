# Tablito

App d'apprentissage des tables de multiplication (PWA, sans backend).

## Stack

- Approche **nobuild** : ESM natif côté navigateur via import maps.
  Pas de bundler. Voir `BASE=/ npm run build`.
- **Landing statique** : `index.html` contient directement le markup
  HTML de la page d'accueil + un inline script qui boot l'app Preact
  via `import('/src/main.tsx')` au clic ou si l'utilisateur est déjà
  passé la landing (PWA installée, profil en localStorage, ou skip
  flag). Aucun module JS de l'app chargé tant que l'utilisateur n'a
  pas interagi — un visiteur qui repart paie 0 KB de JS app.
- **Preact 10** vendoré dans `vendor/preact/` (fichiers ESM publiés tels
  quels sur npm, copiés par `npm run vendor`). Le code applicatif
  importe `react`/`react-dom` — l'import map (prod + dev + vitest)
  redirige vers `preact/compat`.
- **TypeScript** vérifié par `tsc -b` (noEmit). esbuild fait la
  transformation .tsx → .js (à la volée en dev, en pré-build pour
  prod). Aucune autre étape de transpilation.
- **Lazy-loading** : les écrans secondaires (Progress, Badges, Rules,
  ParentDashboard, Privacy, Changelog) sont chargés via `lazy()` +
  `Suspense`. Les écrans du parcours principal (Welcome, RulesIntro,
  Home, Session, Recap) restent eager pour préserver la fluidité de
  la boucle quotidienne et la synchronicité des tests d'intégration.
- **CSS concaténé** : les ~30 fichiers `.css` sources sont mergés en
  un seul `dist/styles.css` au build (1 requête HTTP au lieu de 30).
  En dev, le serveur sert chaque fichier individuellement. Le split
  source = convention d'auteur, le browser voit toujours 1 fichier.
- **Fontes self-hostées** dans `public/fonts/` (régénérées par
  `npm run vendor:fonts` depuis Google Fonts, subset latin).
  Précachées par le SW → 0 réseau dès la 2e visite, identité visuelle
  conservée offline.
- **Service Worker** maison (`scripts/sw.js`) : précache shell +
  lazy-cache média + **cache-first** sur les navigations (cold launch
  instantané). Pas de `skipWaiting()` automatique : un nouveau SW
  reste en `waiting` jusqu'à ce que la page envoie `SKIP_WAITING` via
  `pwa-register.js`/`setBusy` quand `App` est sur un écran "safe"
  (`home` uniquement). Évite tout reload mid-séance.
- **i18n (fr/en)** : langue d'interface **globale** (pas par profil),
  persistée dans `localStorage` sous `multiplix-lang`, défaut = langue du
  navigateur. Cœur dans `src/i18n/lang.ts` (`useLang`, `useStrings` pour React ;
  `getLang`/`pickStrings` pour le code hors-React comme `lib/badges`,
  `lib/strategies`, `lib/changelog`) ; le `LangProvider` est dans
  `src/i18n/LangProvider.tsx`. Chaque domaine a son
  module de strings (`src/i18n/*.ts`) exposant un hook `useXStrings()` basé sur
  une table `{ fr, en }` typée. La landing statique de `index.html` est
  bilingue via des `<span data-lang>` togglés par CSS sur `html[lang]` (langue
  fixée avant le 1er paint par l'inline script du `<head>`). Voix : MP3 par
  langue sous `public/audio/tts/<lang>/` (cf. `useTTS`), reconnaissance vocale
  et parsing des nombres parlés branchés sur la langue (`lib/parseSpokenNumber`).
  Les specs publiques et le guide utilisateur restent FR pour l'instant.
- localStorage pour la persistance (pas de backend).
- Déploiement : GitHub Pages via GitHub Actions (`BASE=/`).
- Node minimum : 22.12+ (CI utilise Node 22).

## Structure

- `src/lib/` — logique métier (Leitner, sélection de questions, similarité, badges, stockage)
- `src/components/` — composants UI réutilisables
- `src/screens/` — écrans de l'app (pas de `LandingScreen` : la landing vit dans `index.html`)
- `src/hooks/` — hooks custom (son, timer, streak, confetti)
- `src/static-landing.css` — styles du markup statique de la landing dans `index.html`
- `scripts/` — tooling (dev server, build, preview, vendor, SW templates, vendor-fonts, perf-audit, perf-compare)
- `vendor/preact/` — Preact ESM vendoré (régénéré par `npm run vendor`)
- `public/fonts/` — fontes self-hostées (régénéré par `npm run vendor:fonts`)
- `index.html` — entry avec import map ET la landing statique + bootstrap script inline
- `public/specs/index.html` — spécifications fonctionnelles complètes (déployées en `/specs/` via le `copyTree(PUBLIC, OUT)` du build, dans le thème du site). HTML écrit à la main : éditable directement, plus de `specs-multiplix.md`.
- `TODO.md` — évolutions techniques envisagées (pistes non tranchées)

## Commandes principales

- `npm run dev` — dev server (port 5174, transformation à la volée)
- `npm run build` — produit `dist/` statique (tsc -b + scripts/build.mjs)
- `npm run preview` — sert `dist/` en local (port 5175)
- `npm run vendor` — re-vendore Preact depuis `node_modules/`
- `npm run vendor:fonts` — re-télécharge les fontes Google (latin) dans `public/fonts/`
- `npm run perf:audit` — audit perf en place (Playwright + CDP : timing, Web Vitals, coverage JS/CSS)
- `npm run perf:compare <baseline-ref> [candidate-ref=HEAD]` — compare 2 git refs (Lighthouse + warm-SW)
- `npm test` — vitest (alias `react` → `preact/compat`)

## Guide utilisateur

Un guide HTML avec captures d'écran est généré par `npm run user-guide` (script `scripts/generate-user-guide.mjs`) et déployé à `/guide/`.

## Changelog in-app

`src/lib/changelog.ts` alimente la page « Nouveautés » de l'espace parent. Le seuil est élevé : une entrée doit valoir le coup pour le parent qui ouvre la page. On y met les **vraies nouveautés fonctionnelles** (nouvelle feature, changement de comportement notable, bug fixe que le parent avait remarqué). On n'y met PAS les fixes d'UX mineurs (polish, scroll, espacement, typo), les refactos, le CI, le lint, ni les changements purement techniques. Au moindre doute : ne pas ajouter.

## Génération des MP3 TTS

Les voix sont pré-générées via `scripts/generate-tts.mjs` (Mistral Voxtral) et checked-in dans `public/audio/tts/`. Le script est idempotent : il ne régénère que les fichiers manquants.

**Multilingue** : un sous-dossier par langue — `public/audio/tts/fr/` et `public/audio/tts/en/` (mêmes clés, chemin `audio/tts/<lang>/<key>.mp3` résolu par `useTTS` selon la langue). `generate-tts.mjs` génère les deux langues par défaut ; restreindre avec `TTS_LANGS=en`. La voix anglaise est surchargeable par `MISTRAL_VOICE_ID_EN` (sinon réutilise la voix par défaut, lisible en anglais).

**Quand ajouter un MP3** : ajouter une entrée dans `buildEntriesFr()` ET `buildEntriesEn()` de `scripts/generate-tts.mjs` avec la même `key`, puis générer.

**Comment générer** (la clé API n'est jamais en clair dans le repo) :

- **Depuis une session avec la clé en env local** : `node scripts/generate-tts.mjs` puis `git add public/audio/tts && git commit && git push`.
- **Depuis CI / session remote sans la clé** : déclencher le workflow dédié qui utilise le secret repo `MISTRAL_API_KEY` et commit les MP3s sur `main` :
  ```bash
  gh workflow run generate-tts.yml
  gh run watch  # suivre l'exécution
  git pull      # récupérer le commit assets(tts) créé par le workflow
  ```
  Le workflow est défini dans `.github/workflows/generate-tts.yml` et déclenchable manuellement (`workflow_dispatch`).
