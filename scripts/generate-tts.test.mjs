// @vitest-environment node
//
// Environnement node obligatoire : le script appelle esbuild, dont l'API Node
// refuse de démarrer sous jsdom (son `TextEncoder` produit des Uint8Array d'un
// autre realm, et esbuild vérifie cet invariant au chargement).
//
// Couverture des clés TTS de la conjugaison.
//
// La matière est muette si un `conj-<clé>-<rang>.mp3` manque : `useTTS` avale le
// 404 sans bruit (fetch → `res.ok` faux → pas de son), donc rien ne signale
// l'oubli — ni au build, ni à l'exécution, ni au test d'intégration. C'est
// exactement ce qui est arrivé à la matière avant ce fichier.
//
// Le script lit la source de vérité (src/lib/conjugationFacts.ts) via esbuild
// plutôt que de recopier les 151 phrases. Ces tests verrouillent ce que ce choix
// laisse encore casser : que le chargement fonctionne toujours (une future
// dépendance runtime dans conjugationFacts.ts casserait la transformation
// fichier-à-fichier), que les clés générées soient bien celles que l'UI
// demande, et que rien de tout cela ne fuite dans la version anglaise.

import { describe, it, expect } from 'vitest';
import { buildEntriesFr, buildEntriesEn } from './generate-tts.mjs';
import {
  CONJ_FACT_DEFS,
  resolveConjQuestion,
} from '../src/lib/conjugationFacts.ts';

const fr = await buildEntriesFr();
const en = buildEntriesEn();
const frByKey = new Map(fr.map((e) => [e.key, e.text]));

// Ce que l'UI demandera réellement : la clé de CHAQUE couple (fait, porteuse),
// dérivée comme SessionScreen et ConjPlacementScreen la dérivent.
const asked = CONJ_FACT_DEFS.flatMap((def) =>
  def.carriers.map((_, i) => resolveConjQuestion(def, i)),
);

describe('entrées TTS de la conjugaison', () => {
  it('charge les phrases depuis conjugationFacts.ts', () => {
    // Garde-fou du mécanisme lui-même : si l'import esbuild échouait, `asked`
    // serait plein et la liste française vide de `conj-*`.
    expect(asked.length).toBeGreaterThan(100);
    expect(fr.filter((e) => e.key.startsWith('conj-')).length).toBe(asked.length);
  });

  it('couvre toutes les phrases porteuses de tous les faits', () => {
    const missing = asked.filter((v) => !frByKey.has(v.ttsKey)).map((v) => v.ttsKey);
    expect(missing).toEqual([]);
  });

  it('fait dire au MP3 exactement la phrase affichée', () => {
    // Un MP3 qui diverge de l'écran est pire que pas de MP3 du tout.
    const diverging = asked
      .filter((v) => frByKey.get(v.ttsKey) !== v.sentence)
      .map((v) => v.ttsKey);
    expect(diverging).toEqual([]);
  });

  it("n'oublie aucun fait de l'inventaire", () => {
    const covered = new Set(
      fr.filter((e) => e.key.startsWith('conj-')).map((e) => e.key.replace(/-\d+$/, '')),
    );
    const uncovered = CONJ_FACT_DEFS.map((d) => `conj-${d.key}`).filter((k) => !covered.has(k));
    expect(uncovered).toEqual([]);
  });

  it('ne génère rien en anglais — la matière y est masquée', () => {
    expect(en.filter((e) => e.key.startsWith('conj-'))).toEqual([]);
  });
});

describe('entrées TTS, toutes matières', () => {
  it('ne contient pas deux textes pour une même clé', () => {
    // Un doublon est silencieux : le script génère le premier, saute le second
    // (le fichier existe déjà), et la moitié de l'app entend le mauvais texte.
    for (const [lang, entries] of [['fr', fr], ['en', en]]) {
      const seen = new Map();
      const clashes = [];
      for (const { key, text } of entries) {
        if (seen.has(key) && seen.get(key) !== text) clashes.push(`${lang}:${key}`);
        seen.set(key, text);
      }
      expect(clashes).toEqual([]);
    }
  });

  it('ne produit ni texte vide ni clé impropre à un nom de fichier', () => {
    for (const entries of [fr, en]) {
      for (const { key, text } of entries) {
        expect(key).toMatch(/^[a-z0-9-]+$/);
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
