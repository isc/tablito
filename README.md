# Tablito

App d'apprentissage des tables de multiplication pour enfants, basée sur la recherche en sciences cognitives.

**https://tablito.app/**

## Fonctionnalités

- **Répétition espacée** — Système de Leitner à 5 boîtes, intervalles adaptés au niveau de chaque fait
- **Anti-interférence** — Faits similaires (ex: 6×7 et 7×6) séparés dans le temps
- **Entrelacement** — Mélange de tables à chaque séance
- **Compréhension d'abord** — Grille de points avant la mémorisation
- **Test de placement** — Adapte le point de départ aux connaissances de l'enfant
- **Badges et streaks** — Motivation par la progression
- **Installation PWA** — Fonctionne hors-ligne, sans compte

## Guide utilisateur

Captures d'écran de chaque écran de l'app : **https://tablito.app/guide/**

## Stack

Approche **nobuild** : ESM natif côté navigateur via import maps, Preact 10 vendoré, esbuild pour la transformation `.tsx → .js` (à la volée en dev, en pré-build pour la prod). Pas de bundler, pas de framework de routing, pas de backend. Les détails et la justification de chaque choix pédagogique sont dans les [spécifications fonctionnelles](https://tablito.app/specs/) (source : [`public/specs/index.html`](public/specs/index.html)).

## Licence

[MIT](LICENSE)
