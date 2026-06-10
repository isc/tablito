# TODO — Tablito

Suivi léger des évolutions techniques envisagées mais non encore tranchées.

## Composition de séance

- **Bonus reviews sans entrelacement** — les révisions bonus ajoutées en fin de séance (quand peu de faits sont dus) ne passent pas par l'algo d'entrelacement. Deux bonus consécutifs peuvent donc être de la même table. Impact limité (ne se produit qu'en début d'apprentissage, quand peu de faits sont introduits). Priorité faible.
  - Pointeur : `src/lib/sessionComposer.ts`

## Algorithme d'introduction

- **Strictesse de `shouldIntroduceNew`** — la condition actuelle exige que **tous** les faits introduits soient en boîte ≥ 2 pour qu'un nouveau fait soit introduit. Avantage : pas de surcharge cognitive. Inconvénient : une erreur d'inattention sur un fait bien connu bloque les introductions tant qu'il n'est pas repromu. Priorité moyenne.
  - Pistes : n'exiger la boîte ≥ 2 que sur les faits introduits dans les N dernières séances, ou exiger 90 % plutôt que 100 %.
  - Pointeur : `src/lib/sessionComposer.ts` (fonction `shouldIntroduceNew`)

## Mode vocal

- **Seuils Leitner en mode vocal** — l'UI feedback passe à 2 s / 3 s en mode vocal (au lieu de 3 s / 5 s), mais la promotion Leitner reste sur 5 s. À réviser après observation sur voix d'enfant réelle. Priorité faible.
  - Pointeur : `src/screens/SessionScreen.tsx`

- **Support offline strict du mode vocal** — `SpeechRecognition` (Chrome) nécessite une connexion. Si on veut un mode vocal hors-ligne, évaluer un moteur local (Whisper.cpp WASM, Vosk français compact). Attention au coût en taille de bundle. Priorité faible.
