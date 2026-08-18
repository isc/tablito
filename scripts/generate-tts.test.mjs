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
import { conjFactDefs, resolveConjQuestion } from '../src/lib/conjugationFacts.ts';
import { conjStrings } from '../src/i18n/conjugation.ts';

const DEFS = conjFactDefs();

const fr = await buildEntriesFr();
const en = buildEntriesEn();
const frByKey = new Map(fr.map((e) => [e.key, e.text]));

// Ce que l'UI demandera réellement : la clé de CHAQUE couple (fait, porteuse),
// dérivée comme SessionScreen et ConjPlacementScreen la dérivent.
const asked = DEFS.flatMap((def) =>
  def.carriers.map((_, i) => resolveConjQuestion(def, i)),
);

// Clés `conj-*` DÉRIVÉES de l'inventaire (une par porteuse, plus la phrase
// complète de la porteuse 0), reconnaissables à leur rang de porteuse final.
// Les relances statiques du mode vocal (`conj-voice-*`) n'en font pas partie et
// sont vérifiées à part.
const conjCarrierKeys = fr.filter((e) => /^conj-.+-\d+(-p)?$/.test(e.key));

describe('entrées TTS de la conjugaison', () => {
  it('charge les phrases depuis conjugationFacts.ts', () => {
    // Garde-fou du mécanisme lui-même : si l'import esbuild échouait, `asked`
    // serait plein et la liste française vide de `conj-*`.
    expect(asked.length).toBeGreaterThan(100);
    // Un énoncé par porteuse, plus une phrase complète par fait (l'intro).
    expect(conjCarrierKeys.length).toBe(asked.length + DEFS.length);
  });

  it('couvre l’énoncé de toutes les porteuses, et la phrase complète de l’intro', () => {
    const missing = asked
      .flatMap((v) => [v.promptTtsKey, v.sentenceTtsKey])
      .filter((k) => k !== null && !frByKey.has(k));
    expect(missing).toEqual([]);
    // La phrase complète n'existe que pour la porteuse 0 : c'est la seule
    // qu'une introduction utilise (cf. composeConjSession).
    expect(asked.filter((v) => v.sentenceTtsKey).length).toBe(DEFS.length);
  });

  it('fait dire au MP3 exactement ce que l’écran demande', () => {
    // Un MP3 qui diverge de l'écran est pire que pas de MP3 du tout — et
    // l'énoncé de la question ne doit JAMAIS contenir la forme conjuguée,
    // sinon il dicte la réponse au moment où on la demande.
    const diverging = asked
      .filter((v) => frByKey.get(v.promptTtsKey) !== v.prompt)
      .map((v) => v.promptTtsKey);
    expect(diverging).toEqual([]);

    const divergingIntro = asked
      .filter((v) => v.sentenceTtsKey && frByKey.get(v.sentenceTtsKey) !== v.sentence)
      .map((v) => v.sentenceTtsKey);
    expect(divergingIntro).toEqual([]);

    // L'énoncé s'arrête à l'infinitif, jamais sur la forme conjuguée.
    const leaking = asked
      .filter((v) => !v.prompt.endsWith(`… ${v.verb}`))
      .map((v) => v.promptTtsKey);
    expect(leaking).toEqual([]);
  });

  it('parle les deux relances du mode vocal épelé, dans les mots de l’écran', () => {
    // Muettes, elles laisseraient un enfant qui épelle sans savoir qu'on ne
    // l'a pas entendu — en vocal, il n'a pas forcément les yeux sur l'écran.
    // Et un MP3 qui diverge du texte affiché est pire que pas de MP3 : les
    // deux textes viennent donc du module de strings, ce test le vérifie.
    expect(frByKey.get('conj-voice-spell')).toBe(conjStrings.voiceSpellNow);
    expect(frByKey.get('conj-voice-again')).toContain(conjStrings.voiceNotHeard);
  });

  it("n'oublie aucun fait de l'inventaire", () => {
    const covered = new Set(conjCarrierKeys.map((e) => e.key.replace(/-\d+(-p)?$/, '')));
    const uncovered = DEFS.map((d) => `conj-${d.key}`).filter((k) => !covered.has(k));
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
