// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { conjFastThresholdMs, CONJ_FAST_BASE_MS, CONJ_FAST_PER_CHAR_MS } from '../types';
import {
  CONJ_FACT_DEFS,
  CONJ_GROUP1_VERBS,
  CONJ_IRREGULAR_VERBS,
  CONJ_PERSONS,
  allConjCarrierSentences,
  applyEuphony,
  conjFactDef,
  conjFactsOfTense,
  conjFactsOfVerb,
  conjSubject,
  createInitialConjFacts,
  isPhoneticallyClose,
  regularStem,
  resolveConjQuestion,
} from '../lib/conjugationFacts';

// Forme complète produite par un fait, pour une porteuse donnée.
function formOf(key: string, carrierIndex = 0): string {
  const def = conjFactDef(key);
  if (!def) throw new Error(`clé inconnue : ${key}`);
  return resolveConjQuestion(def, carrierIndex).form;
}

// Toutes les formes produites par un fait, toutes porteuses confondues.
function formsOf(key: string): string[] {
  const def = conjFactDef(key);
  if (!def) throw new Error(`clé inconnue : ${key}`);
  return def.carriers.map((_, i) => resolveConjQuestion(def, i).form);
}

describe('inventaire — la structure de la spec §3.3', () => {
  it('compte exactement 63 faits', () => {
    expect(CONJ_FACT_DEFS).toHaveLength(63);
  });

  it('respecte la répartition par bloc', () => {
    const counts = {
      presentG1: CONJ_FACT_DEFS.filter((d) => d.tense === 'present' && d.kind === 'ending').length,
      presentIrr: CONJ_FACT_DEFS.filter((d) => d.tense === 'present' && d.kind === 'irregular')
        .length,
      imparfait: conjFactsOfTense([...CONJ_FACT_DEFS], 'imparfait').length,
      futur: conjFactsOfTense([...CONJ_FACT_DEFS], 'futur').length,
    };
    expect(counts).toEqual({ presentG1: 6, presentIrr: 38, imparfait: 7, futur: 12 });
  });

  it('a 6 terminaisons + 1 radical à l’imparfait, 6 + 6 au futur', () => {
    const imp = conjFactsOfTense([...CONJ_FACT_DEFS], 'imparfait');
    expect(imp.filter((d) => d.kind === 'ending')).toHaveLength(6);
    expect(imp.filter((d) => d.kind === 'stem').map((d) => d.stem)).toEqual(['ét']);

    const fut = conjFactsOfTense([...CONJ_FACT_DEFS], 'futur');
    expect(fut.filter((d) => d.kind === 'ending')).toHaveLength(6);
    expect(fut.filter((d) => d.kind === 'stem').map((d) => d.stem)).toEqual([
      'ser',
      'aur',
      'ir',
      'fer',
      'viendr',
      'verr',
    ]);
  });

  it('couvre les 7 irréguliers, 6 personnes chacun, avec 4 fusions je/tu', () => {
    for (const verb of CONJ_IRREGULAR_VERBS) {
      const defs = conjFactsOfVerb([...CONJ_FACT_DEFS], verb).filter(
        (d) => d.tense === 'present',
      );
      const covered = defs.flatMap((d) => d.persons);
      expect([...covered].sort()).toEqual([...CONJ_PERSONS].sort());
    }
    const fused = CONJ_FACT_DEFS.filter((d) => d.persons.length === 2);
    expect(fused.map((d) => d.form)).toEqual(['fais', 'dis', 'viens', 'vois']);
  });

  it('a des clés uniques et stables', () => {
    const keys = CONJ_FACT_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    // Aucun accent ni espace : les clés servent aussi de noms de fichiers TTS.
    for (const key of keys) expect(key).toMatch(/^[a-z0-9_-]+$/);
  });

  it('donne 2 à 3 phrases porteuses par fait, avec un marqueur temporel', () => {
    for (const def of CONJ_FACT_DEFS) {
      expect(def.carriers.length).toBeGreaterThanOrEqual(2);
      expect(def.carriers.length).toBeLessThanOrEqual(3);
      for (const carrier of def.carriers) {
        expect(carrier.before).toMatch(/,$/);
        expect(carrier.after.length).toBeGreaterThan(0);
      }
    }
  });

  it('borne le volume TTS (une clé unique par texte, ~200 MP3)', () => {
    // Un énoncé par porteuse (151) + la phrase complète de l'intro, porteuse 0
    // seulement (63) : le budget annoncé par la spec (« environ 200 »).
    const sentences = allConjCarrierSentences();
    expect(new Set(sentences.map((s) => s.key)).size).toBe(sentences.length);
    expect(sentences.length).toBeLessThanOrEqual(220);
    for (const { key, text } of sentences) {
      // Énoncé : « Demain, nous… chanter » — l'infinitif clôt la phrase.
      // Phrase complète : ponctuée, forme conjuguée comprise.
      expect(text).toMatch(key.endsWith('-p') ? /^[A-ZÀ-Ý].*[.!?]$/u : /^[A-ZÀ-Ý].*… \p{L}+$/u);
    }
  });

  it('n’utilise que les 8 verbes support pour les terminaisons', () => {
    for (const def of CONJ_FACT_DEFS) {
      if (def.kind !== 'ending') continue;
      for (const carrier of def.carriers) {
        expect(CONJ_GROUP1_VERBS).toContain(carrier.verb);
      }
    }
  });

  it('crée 63 faits en boîte 1, non introduits', () => {
    const facts = createInitialConjFacts();
    expect(facts).toHaveLength(63);
    expect(facts.every((f) => f.box === 1 && !f.introduced && f.history.length === 0)).toBe(true);
    expect(new Set(facts.map((f) => f.key)).size).toBe(63);
  });
});

describe('conjugaisons — chaque forme irrégulière, une par une', () => {
  it('conjugue être au présent', () => {
    expect(formOf('pres-etre-je')).toBe('suis');
    expect(formOf('pres-etre-tu')).toBe('es');
    expect(formOf('pres-etre-il')).toBe('est');
    expect(formOf('pres-etre-nous')).toBe('sommes');
    expect(formOf('pres-etre-vous')).toBe('êtes');
    expect(formOf('pres-etre-ils')).toBe('sont');
  });

  it('conjugue avoir au présent', () => {
    expect(formOf('pres-avoir-je')).toBe('ai');
    expect(formOf('pres-avoir-tu')).toBe('as');
    expect(formOf('pres-avoir-il')).toBe('a');
    expect(formOf('pres-avoir-nous')).toBe('avons');
    expect(formOf('pres-avoir-vous')).toBe('avez');
    expect(formOf('pres-avoir-ils')).toBe('ont');
  });

  it('conjugue aller au présent', () => {
    expect(formOf('pres-aller-je')).toBe('vais');
    expect(formOf('pres-aller-tu')).toBe('vas');
    expect(formOf('pres-aller-il')).toBe('va');
    expect(formOf('pres-aller-nous')).toBe('allons');
    expect(formOf('pres-aller-vous')).toBe('allez');
    expect(formOf('pres-aller-ils')).toBe('vont');
  });

  it('conjugue faire au présent (je/tu fusionnés)', () => {
    expect(formsOf('pres-faire-jetu')).toEqual(['fais', 'fais']);
    expect(conjFactDef('pres-faire-jetu')?.carriers.map((c) => c.person)).toEqual(['je', 'tu']);
    expect(formOf('pres-faire-il')).toBe('fait');
    expect(formOf('pres-faire-nous')).toBe('faisons');
    expect(formOf('pres-faire-vous')).toBe('faites');
    expect(formOf('pres-faire-ils')).toBe('font');
  });

  it('conjugue dire au présent', () => {
    expect(formOf('pres-dire-jetu')).toBe('dis');
    expect(formOf('pres-dire-il')).toBe('dit');
    expect(formOf('pres-dire-nous')).toBe('disons');
    expect(formOf('pres-dire-vous')).toBe('dites');
    expect(formOf('pres-dire-ils')).toBe('disent');
  });

  it('conjugue venir au présent', () => {
    expect(formOf('pres-venir-jetu')).toBe('viens');
    expect(formOf('pres-venir-il')).toBe('vient');
    expect(formOf('pres-venir-nous')).toBe('venons');
    expect(formOf('pres-venir-vous')).toBe('venez');
    expect(formOf('pres-venir-ils')).toBe('viennent');
  });

  it('conjugue voir au présent', () => {
    expect(formOf('pres-voir-jetu')).toBe('vois');
    expect(formOf('pres-voir-il')).toBe('voit');
    expect(formOf('pres-voir-nous')).toBe('voyons');
    expect(formOf('pres-voir-vous')).toBe('voyez');
    expect(formOf('pres-voir-ils')).toBe('voient');
  });

  it('conjugue être à l’imparfait sur le radical ét-', () => {
    expect(formsOf('imp-etre')).toEqual(['étais', 'étions', 'étaient']);
  });

  it('conjugue les six radicaux irréguliers du futur', () => {
    expect(formsOf('fut-etre')).toEqual(['serai', 'serons', 'seront']);
    expect(formsOf('fut-avoir')).toEqual(['aurai', 'auras', 'auront']);
    expect(formsOf('fut-aller')).toEqual(['irai', 'irons', 'irez']);
    expect(formsOf('fut-faire')).toEqual(['ferai', 'ferons', 'feront']);
    expect(formsOf('fut-venir')).toEqual(['viendrai', 'viendras', 'viendront']);
    expect(formsOf('fut-voir')).toEqual(['verrai', 'verrons', 'verrez']);
  });
});

describe('réponse attendue et segmentation (§4.2, §4.5)', () => {
  it('ne fait taper que la terminaison quand le radical est régulier', () => {
    const view = resolveConjQuestion(conjFactDef('pres-g1-tu')!, 0);
    expect(view.endingOnly).toBe(true);
    expect(view.displayedStem).toBe('regard');
    expect(view.expected).toBe('es');
    expect(view.form).toBe('regardes');
  });

  it('fait taper la forme entière pour une forme irrégulière', () => {
    const view = resolveConjQuestion(conjFactDef('pres-etre-nous')!, 0);
    expect(view.endingOnly).toBe(false);
    expect(view.displayedStem).toBe('');
    expect(view.expected).toBe('sommes');
    // Insécable : la « terminaison » est vide, c'est tout l'intérêt (§3.2).
    expect(view.segment).toEqual(['sommes', '']);
  });

  it('fait taper la forme entière pour un radical irrégulier, et la segmente', () => {
    const view = resolveConjQuestion(conjFactDef('fut-etre')!, 1);
    expect(view.expected).toBe('serons');
    expect(view.segment).toEqual(['ser', 'ons']);
  });

  it('gère le piège man+geons et sa disparition devant i', () => {
    expect(applyEuphony('mang', 'ons')).toEqual(['man', 'geons']);
    expect(applyEuphony('mang', 'ais')).toEqual(['man', 'geais']);
    expect(applyEuphony('mang', 'ions')).toEqual(['mang', 'ions']);
    expect(applyEuphony('lanc', 'ons')).toEqual(['lan', 'çons']);
    expect(applyEuphony('chant', 'ons')).toEqual(['chant', 'ons']);

    const nous = resolveConjQuestion(conjFactDef('pres-g1-nous')!, 0);
    expect(nous.verb).toBe('manger');
    expect(nous.displayedStem).toBe('man');
    expect(nous.expected).toBe('geons');
    expect(nous.form).toBe('mangeons');

    const imparfaitNous = resolveConjQuestion(conjFactDef('imp-nous')!, 0);
    expect(imparfaitNous.form).toBe('mangions');
    const imparfaitIls = resolveConjQuestion(conjFactDef('imp-ils')!, 2);
    expect(imparfaitIls.form).toBe('mangeaient');
    // Au futur le radical est l'infinitif : aucune euphonie à appliquer.
    expect(resolveConjQuestion(conjFactDef('fut-nous')!, 0).form).toBe('mangerons');
  });

  it('dérive le radical régulier selon le temps', () => {
    expect(regularStem('chanter', 'present')).toBe('chant');
    expect(regularStem('chanter', 'imparfait')).toBe('chant');
    expect(regularStem('chanter', 'futur')).toBe('chanter');
    // Verbes en -re : le e saute au futur (§3.2).
    expect(regularStem('dire', 'futur')).toBe('dir');
  });

  it('élide le pronom je devant une voyelle', () => {
    expect(conjSubject('je', 'chante')).toBe('je ');
    expect(conjSubject('je', 'ai')).toBe('j’');
    expect(conjSubject('nous', 'sommes')).toBe('nous ');
    expect(resolveConjQuestion(conjFactDef('imp-etre')!, 0).sentence).toBe('Hier, j’étais malade.');
  });

  it('assemble la phrase porteuse complète', () => {
    const view = resolveConjQuestion(conjFactDef('fut-je')!, 0);
    expect(view.sentence).toBe('Demain, je chanterai à la fête.');
    expect(view.lead).toBe('Demain, je ');
    expect(view.tail).toBe(' à la fête.');
    // La phrase complète n'est lue qu'à l'introduction (§5.2 étape 1).
    expect(view.sentenceTtsKey).toBe('conj-fut-je-0-p');
  });

  it('n’énonce JAMAIS la forme demandée : l’audio de la question dit l’infinitif', () => {
    // « Bientôt, nous… être » — pas « Bientôt, nous serons prêts », qui
    // dicterait la réponse au moment même où on la demande (§4.1).
    const view = resolveConjQuestion(conjFactDef('fut-etre')!, 1);
    expect(view.prompt).toBe('Bientôt, nous… être');
    expect(view.prompt).not.toContain(view.form);
    expect(view.promptTtsKey).toBe('conj-fut-etre-1');
    // Hors porteuse 0, aucune phrase complète n'est pré-générée.
    expect(view.sentenceTtsKey).toBeNull();
  });

  it('boucle sur les porteuses quand l’index déborde', () => {
    const def = conjFactDef('pres-etre-je')!;
    expect(resolveConjQuestion(def, 2).sentence).toBe(resolveConjQuestion(def, 0).sentence);
  });
});

describe('proximité phonétique (cas « presque », §4.5)', () => {
  it('rapproche les graphies homophones d’un radical', () => {
    expect(isPhoneticallyClose('cer', 'ser')).toBe(true);
    expect(isPhoneticallyClose('voi', 'voy')).toBe(true);
    expect(isPhoneticallyClose('etes', 'êtes')).toBe(true);
    expect(isPhoneticallyClose('vienn', 'vien')).toBe(true);
  });

  it('ne rapproche pas deux radicaux qui ne se prononcent pas pareil', () => {
    expect(isPhoneticallyClose('saur', 'ser')).toBe(false);
    expect(isPhoneticallyClose('o', 'so')).toBe(false);
    expect(isPhoneticallyClose('fer', 'ir')).toBe(false);
  });
});

describe('seuil de rapidité (§4.5)', () => {
  it('croît avec la longueur de la réponse à taper', () => {
    expect(conjFastThresholdMs('ons')).toBe(CONJ_FAST_BASE_MS + 3 * CONJ_FAST_PER_CHAR_MS);
    expect(conjFastThresholdMs('viendront')).toBe(CONJ_FAST_BASE_MS + 9 * CONJ_FAST_PER_CHAR_MS);
    expect(conjFastThresholdMs('viendront')).toBeGreaterThan(conjFastThresholdMs('ons'));
  });

  it('retombe sur la base en vocal épelé (le coût moteur disparaît)', () => {
    expect(conjFastThresholdMs('viendront', 'voice')).toBe(CONJ_FAST_BASE_MS);
  });
});
