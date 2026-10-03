// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { BoxLevel, IrrFact } from '../types';
import {
  IRR_FAMILIES,
  allIrrTtsEntries,
  createInitialIrrFacts,
  irrRecitation,
  irrVerbDefs,
  irrVerbsOfFamily,
  requireIrrVerbDef,
} from '../lib/irregularVerbs';
import {
  composeIrrSession,
  irrKeysInterfere,
  irrQuestionConflict,
  isIrrAccepted,
  judgeIrrAnswer,
} from '../lib/irregularComposer';
import { irrHeardForms, irrSpokenAnswer, irrSpokenWords } from '../lib/parseSpokenIrregular';
import { seedIrrFromPlacement } from '../lib/irregularPlacement';
import { MAX_LENGTH } from '../components/LetterKeyboard';

const TODAY = '2026-10-03';

function factsWith(states: Record<string, { box: BoxLevel; due?: boolean; introducedAt?: string }>): IrrFact[] {
  return createInitialIrrFacts().map((f) => {
    const s = states[f.key];
    if (!s) return f;
    return {
      ...f,
      introduced: true,
      box: s.box,
      lastSeen: '2026-09-01',
      nextDue: s.due === false ? '2026-12-01' : '2026-09-02',
      ...(s.introducedAt ? { introducedAt: s.introducedAt } : {}),
    };
  });
}

describe('inventaire (specs §16.3)', () => {
  it('compte 64 verbes, exactement la grille 8×8, sans doublon', () => {
    const keys = irrVerbDefs().map((d) => d.key);
    expect(keys).toHaveLength(64);
    expect(new Set(keys).size).toBe(64);
  });

  it('range chaque verbe dans une famille connue, aucune famille vide', () => {
    for (const family of IRR_FAMILIES) expect(irrVerbsOfFamily(family).length).toBeGreaterThan(0);
  });

  it('commence par les plus fréquents', () => {
    expect(irrVerbDefs().slice(0, 4).map((d) => d.key)).toEqual(['be', 'have', 'do', 'go']);
  });

  it('tient dans le clavier : aucune forme ne dépasse la saisie maximale', () => {
    for (const def of irrVerbDefs()) {
      for (const form of [...def.preterite, ...def.participle]) {
        expect(form.length).toBeLessThanOrEqual(MAX_LENGTH);
      }
    }
  });

  it('affiche la récitation, doublets compris', () => {
    expect(irrRecitation(requireIrrVerbDef('go'))).toBe('go – went – gone');
    expect(irrRecitation(requireIrrVerbDef('be'))).toBe('be – was/were – been');
    expect(irrRecitation(requireIrrVerbDef('get'))).toBe('get – got – got/gotten');
  });

  it('a deux MP3 par verbe, dont la récitation complète', () => {
    const entries = allIrrTtsEntries();
    expect(entries).toHaveLength(128);
    expect(entries).toContainEqual({ key: 'irr-go', text: 'go.' });
    expect(entries).toContainEqual({ key: 'irr-go-all', text: 'go, went, gone.' });
  });
});

describe('jugement (specs §16.6)', () => {
  const go = requireIrrVerbDef('go');

  it('accepte les deux formes justes', () => {
    expect(judgeIrrAnswer(go, ['went', 'gone'])).toBe('correct');
    expect(judgeIrrAnswer(go, ['Went', ' gone '])).toBe('correct');
  });

  it('attend les deux prétérits de « be », dans n’importe quel ordre', () => {
    const be = requireIrrVerbDef('be');
    expect(judgeIrrAnswer(be, ['was', 'were', 'been'])).toBe('correct');
    expect(judgeIrrAnswer(be, ['were', 'was', 'been'])).toBe('correct');
    expect(judgeIrrAnswer(be, ['was', 'was', 'been'])).toBe('wrong');
  });

  it('accepte « gotten » comme « got » au participe de « get »', () => {
    const get = requireIrrVerbDef('get');
    expect(judgeIrrAnswer(get, ['got', 'got'])).toBe('correct');
    expect(judgeIrrAnswer(get, ['got', 'gotten'])).toBe('correct');
  });

  it('repère la sur-régularisation', () => {
    expect(judgeIrrAnswer(go, ['goed', 'goed'])).toBe('regularized');
    expect(judgeIrrAnswer(requireIrrVerbDef('buy'), ['buyed', 'bought'])).toBe('regularized');
  });

  it('repère l’inversion prétérit / participe', () => {
    expect(judgeIrrAnswer(requireIrrVerbDef('sing'), ['sung', 'sang'])).toBe('swapped');
    expect(judgeIrrAnswer(go, ['gone', 'went'])).toBe('swapped');
  });

  it('compte « brang » comme une erreur (mauvaise famille)', () => {
    expect(judgeIrrAnswer(requireIrrVerbDef('bring'), ['brang', 'brung'])).toBe('wrong');
  });

  it('tolère une coquille au clavier sur un mot long, jamais un autre verbe', () => {
    const teach = requireIrrVerbDef('teach');
    expect(judgeIrrAnswer(teach, ['tuaght', 'taught'])).toBe('almost');
    expect(judgeIrrAnswer(requireIrrVerbDef('bring'), ['brougt', 'brought'])).toBe('almost');
    // « bought » est à une lettre de « brought », mais c'est le passé de buy.
    expect(judgeIrrAnswer(requireIrrVerbDef('bring'), ['bought', 'bought'])).toBe('wrong');
    // Sous 5 lettres, une lettre change le mot.
    expect(judgeIrrAnswer(requireIrrVerbDef('sit'), ['set', 'sat'])).toBe('wrong');
    // Pas de coquille à la voix : la reconnaissance orthographie elle-même.
    expect(judgeIrrAnswer(teach, ['tuaght', 'taught'], 'voice')).toBe('wrong');
    expect(isIrrAccepted('almost')).toBe(true);
  });
});

describe('réponse dite (specs §16.6)', () => {
  const answer = (said: string, key: string) => {
    const def = requireIrrVerbDef(key);
    return irrSpokenAnswer(irrSpokenWords(said, def), def);
  };

  it('retire l’infinitif récité en tête', () => {
    expect(answer('go, went, gone', 'go')).toEqual(['went', 'gone']);
    expect(answer('went gone', 'go')).toEqual(['went', 'gone']);
    expect(answer('to go went gone', 'go')).toEqual(['went', 'gone']);
  });

  it('attend la seconde moitié d’une réponse dite en deux fois', () => {
    expect(answer('go went', 'go')).toBeNull();
    const def = requireIrrVerbDef('go');
    expect(irrHeardForms(irrSpokenWords('go went', def), def)).toEqual(['went']);
  });

  it('ne prend pas l’infinitif pour une réponse quand il est lui-même une forme', () => {
    expect(answer('put put put', 'put')).toEqual(['put', 'put']);
    expect(answer('put put', 'put')).toEqual(['put', 'put']);
    expect(answer('come came come', 'come')).toEqual(['came', 'come']);
  });

  it('ramène les homophones à la forme du verbe interrogé', () => {
    expect(answer('eat eight eaten', 'eat')).toEqual(['ate', 'eaten']);
    expect(answer('win one one', 'win')).toEqual(['won', 'won']);
    expect(answer('read red red', 'read')).toEqual(['read', 'read']);
    expect(answer("be was we're been", 'be')).toEqual(['was', 'were', 'been']);
    // « one » n'est lu « won » que pour « win ».
    expect(answer('one one', 'go')).toEqual(['one', 'one']);
  });
});

describe('composition (specs §16.4, §16.7)', () => {
  it('introduit les deux premiers verbes par fréquence', () => {
    const session = composeIrrSession({ irrFacts: createInitialIrrFacts() }, TODAY);
    expect(session.filter((q) => q.isIntroduction).map((q) => q.fact.key)).toEqual(['be', 'have']);
  });

  it('n’introduit jamais deux verbes en interférence à moins de 48 h', () => {
    expect(irrKeysInterfere('fall', 'feel')).toBe(true);
    expect(irrKeysInterfere('sing', 'ring')).toBe(false);
    // Tout ce qui précède « feel » est su ; « fall » vient d'être introduit.
    const before = irrVerbDefs().slice(0, 15).map((d) => d.key);
    const states: Record<string, { box: BoxLevel; due?: boolean; introducedAt?: string }> = {};
    for (const key of before) states[key] = { box: 4, due: false };
    states.fall = { box: 1, due: false, introducedAt: TODAY };
    const session = composeIrrSession({ irrFacts: factsWith(states) }, TODAY);
    expect(session.filter((q) => q.isIntroduction).map((q) => q.fact.key)).not.toContain('feel');
  });

  it('ne fait jamais se suivre deux verbes de la même famille', () => {
    const states: Record<string, { box: BoxLevel }> = {};
    for (const def of irrVerbDefs().slice(0, 30)) states[def.key] = { box: 2 };
    const session = composeIrrSession({ irrFacts: factsWith(states) }, TODAY);
    expect(session.length).toBeGreaterThanOrEqual(12);
    for (let i = 1; i < session.length; i++) {
      expect(irrQuestionConflict(session[i - 1], session[i])).toBe(false);
    }
  });

  it('garde hors de la séance deux verbes confusibles non consolidés', () => {
    const session = composeIrrSession(
      { irrFacts: factsWith({ fall: { box: 2 }, feel: { box: 2 }, go: { box: 2 } }) },
      TODAY,
    );
    const keys = session.map((q) => q.fact.key);
    expect(keys.includes('fall') && keys.includes('feel')).toBe(false);
  });
});

describe('placement (specs §16.8)', () => {
  it('ensemence seulement les verbes réussis, sans dominance', () => {
    const facts = createInitialIrrFacts();
    seedIrrFromPlacement(
      facts,
      [
        { key: 'go', correct: true, timeMs: 2000, inputMode: 'voice' },
        { key: 'do', correct: false, timeMs: 9000, inputMode: 'voice' },
      ],
      TODAY,
    );
    const byKey = new Map(facts.map((f) => [f.key, f]));
    expect(byKey.get('go')).toMatchObject({ introduced: true, box: 3 });
    expect(byKey.get('do')?.introduced).toBe(false);
    expect(facts.filter((f) => f.introduced)).toHaveLength(1);
  });
});
