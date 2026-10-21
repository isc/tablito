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
  sanitizeIrrClassVerbs,
} from '../lib/irregularVerbs';
import {
  composeIrrSession,
  irrKeysInterfere,
  irrQuestionConflict,
  isIrrAccepted,
  judgeIrrAnswer,
} from '../lib/irregularComposer';
import {
  irrAccumulate,
  irrFinalAnswer,
  irrHeardForms,
  irrParticipleUnheard,
  irrSpokenAnswer,
  irrSpokenWords,
} from '../lib/parseSpokenIrregular';
import { irrPlacementProbes, seedIrrFromPlacement } from '../lib/irregularPlacement';
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
    expect(entries).toContainEqual({ key: 'irr-go-all', text: 'go, went, gone.', forms: ['go', 'went', 'gone'] });
  });

  it('écrit pour la synthèse le son que l’orthographe ne dit pas', () => {
    // « read, read, read » s'entendait « red » trois fois.
    const entries = allIrrTtsEntries();
    expect(entries).toContainEqual({ key: 'irr-read', text: 'reed.' });
    expect(entries).toContainEqual({ key: 'irr-read-all', text: 'reed, red, red.', forms: ['read', 'read', 'read'] });
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

describe('vus en classe (specs §16.3)', () => {
  const intros = (irrClassVerbs: string[], states = {}) =>
    composeIrrSession({ irrFacts: factsWith(states), irrClassVerbs }, TODAY)
      .filter((q) => q.isIntroduction)
      .map((q) => q.fact.key);

  it('introduit d’abord les verbes de la classe, dans l’ordre coché', () => {
    expect(intros(['be', 'begin', 'choose', 'break'])).toEqual(['be', 'begin']);
    expect(intros(['choose', 'break'])).toEqual(['choose', 'break']);
  });

  it('passe aux verbes fréquents une fois ceux de la classe introduits', () => {
    expect(intros(['begin'], { begin: { box: 2, due: false } })).toEqual(['be', 'have']);
    expect(intros(['be', 'begin'], { be: { box: 2, due: false } })).toEqual(['begin', 'have']);
  });

  it('garde l’espacement des verbes en interférence', () => {
    // bring et buy se confondent : buy attend 48 h, un verbe fréquent passe.
    expect(intros(['bring', 'buy'])).toEqual(['bring', 'be']);
  });

  it('sonde d’abord les verbes de la classe au placement', () => {
    const probes = irrPlacementProbes(['choose', 'be', 'break']);
    expect(probes.slice(0, 4)).toEqual(['choose', 'be', 'break', 'have']);
    expect(probes).toHaveLength(10);
    expect(new Set(probes).size).toBe(10);
  });

  it('assainit la liste d’un profil importé', () => {
    expect(sanitizeIrrClassVerbs(['be', 'zzz', 3, 'be', 'go'])).toEqual(['be', 'go']);
    expect(sanitizeIrrClassVerbs('be')).toEqual([]);
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

describe('réponse dite, appariement au son (specs §16.6)', () => {
  const answer = (said: string, key: string) => {
    const def = requireIrrVerbDef(key);
    return irrSpokenAnswer(irrSpokenWords(said, def), def);
  };

  it('rattrape les réécritures de la reconnaissance en phrase', () => {
    expect(answer('go when gone', 'go')).toEqual(['went', 'gone']);
    expect(answer('go went gun', 'go')).toEqual(['went', 'gone']);
    expect(answer('sing sang song', 'sing')).toEqual(['sang', 'sung']);
    expect(answer('teach thought taught', 'teach')).toEqual(['thought', 'taught']);
    // Vécu sur Android : « been » transcrit « being », recalé en « bring ».
    expect(answer('be was were being', 'be')).toEqual(['was', 'were', 'been']);
    expect(answer('know knew noon', 'know')).toEqual(['knew', 'known']);
  });

  it('ne transforme jamais une forme dite telle quelle', () => {
    // « thought » pour « bring » : une vraie erreur, qui reste une erreur.
    expect(answer('bring thought thought', 'bring')).toEqual(['thought', 'thought']);
    expect(answer('go goed goed', 'go')).toEqual(['goed', 'goed']);
    expect(answer('sing sung sang', 'sing')).toEqual(['sung', 'sang']);
  });
});

/** Les énoncés successifs d'une même question, comme IrrVoiceInput. */
function heardAfter(key: string, ...finals: string[]) {
  const def = requireIrrVerbDef(key);
  const words = finals.reduce<string[]>((said, f) => irrAccumulate(said, f, def), []);
  return { def, words };
}

/** La réponse retenue à la fin du dernier énoncé. */
function finalAnswer(key: string, ...finals: string[]) {
  const { def, words } = heardAfter(key, ...finals);
  return irrFinalAnswer(words, def);
}

// Transcriptions réelles d'un Pixel (journal vocal du 20/10/2026) : Android ne
// renvoie qu'une hypothèse, avale les répétitions et coupe les énoncés.
describe('réponse dite, transcriptions Android (specs §16.6)', () => {
  it('une récitation qui repart de l’infinitif remplace les bribes d’avant', () => {
    expect(finalAnswer('take', 'take to Taken', 'take toot taken')).toEqual(['took', 'taken']);
    expect(heardAfter('begin', 'Begin Again', 'begin began').words).toEqual(['begin', 'began']);
  });

  it('un infinitif qui est aussi une réponse complète encore une réponse en deux fois', () => {
    expect(finalAnswer('come', 'come came', 'come')).toEqual(['came', 'come']);
    expect(finalAnswer('put', 'put', 'put put')).toEqual(['put', 'put']);
  });

  it('un énoncé sans aucun mot ne change rien', () => {
    const def = requireIrrVerbDef('go');
    const said = ['go', 'went'];
    expect(irrAccumulate(said, 'um', def)).toBe(said);
  });

  it('complète une répétition avalée quand elle donne la bonne réponse', () => {
    expect(finalAnswer('tell', 'tell told')).toEqual(['told', 'told']);
    expect(finalAnswer('get', 'get god')).toEqual(['got', 'got']);
    expect(finalAnswer('hold', 'cold health')).toEqual(['held', 'held']);
  });

  it('ne complète jamais vers une réponse fausse, ni sur l’infinitif seul', () => {
    expect(finalAnswer('give', 'give gave')).toBeNull();
    expect(finalAnswer('tell', 'tell tall')).toBeNull();
    expect(finalAnswer('put', 'put')).toBeNull();
    expect(finalAnswer('tell', 'told')).toBeNull();
  });

  it('prend le premier mot d’une récitation complète pour l’infinitif, même mal entendu', () => {
    expect(finalAnswer('go', 'girl went gone')).toEqual(['went', 'gone']);
    // … et elle remplace les bribes d'avant, comme une récitation bien entendue.
    expect(finalAnswer('go', 'went', 'girl went gone')).toEqual(['went', 'gone']);
    expect(finalAnswer('be', 'bee wars were being')).toEqual(['was', 'were', 'been']);
  });

  it('participe en u entendu comme l’infinitif : compté pour le participe', () => {
    expect(finalAnswer('begin', 'begin began begin')).toEqual(['began', 'begun']);
    expect(finalAnswer('sing', 'sing sang sing')).toEqual(['sang', 'sung']);
    expect(finalAnswer('begin', 'began begin')).toEqual(['began', 'begun']);
    // Un prétérit faux reste jugé.
    expect(finalAnswer('begin', 'begin begin begin')).toEqual(['begin', 'begin']);
  });

  it('participe en u entendu comme le prétérit : la voix ne tranche pas', () => {
    const unheard = (key: string, said: string) => {
      const { def, words } = heardAfter(key, said);
      return irrParticipleUnheard(irrSpokenAnswer(words, def)!, def);
    };
    expect(unheard('begin', 'begin began began')).toEqual(['began']);
    expect(unheard('sing', 'sing sang sang')).toEqual(['sang']);
    // Un prétérit faux, ou un verbe hors i-a-u, reste jugé.
    expect(unheard('begin', 'begin begin begin')).toBeNull();
    expect(unheard('begin', 'begin begun began')).toBeNull();
    expect(unheard('give', 'give gave gave')).toBeNull();
  });
});

// Journal vocal du 21/10/2026, même Pixel : la reconnaissance garde les
// consonnes et invente le reste, ou prend le mot d'un autre verbe qui sonne
// pareil. Chaque énoncé ci-dessous a été dit juste.
describe('réponse dite, vérifiée contre la réponse attendue (specs §16.6)', () => {
  it('un mot inventé qui a les consonnes de la forme attendue compte pour elle', () => {
    expect(finalAnswer('stand', 'stand Stuart stood')).toEqual(['stood', 'stood']);
    expect(finalAnswer('write', 'right Road written')).toEqual(['wrote', 'written']);
    expect(finalAnswer('write', 'Red Road written')).toEqual(['wrote', 'written']);
    expect(finalAnswer('take', 'take tooth taken')).toEqual(['took', 'taken']);
    expect(finalAnswer('do', 'do deed done')).toEqual(['did', 'done']);
  });

  it('la forme d’un autre verbe qui sonne pareil compte pour la forme attendue', () => {
    expect(finalAnswer('write', 'right Road ridden')).toEqual(['wrote', 'written']);
    expect(finalAnswer('write', 'write rode ridden')).toEqual(['wrote', 'written']);
    expect(finalAnswer('ride', 'ride wrote written')).toEqual(['rode', 'ridden']);
    expect(finalAnswer('hide', 'hide hit hidden')).toEqual(['hid', 'hidden']);
  });

  it('une erreur dite reste une erreur', () => {
    // Formes du verbe interrogé, sur-régularisations, autre verbe qui ne sonne
    // pas pareil (la consonne initiale s'entend : « got » n'est pas « caught »).
    expect(finalAnswer('send', 'send send send')).toEqual(['send', 'send']);
    expect(finalAnswer('stand', 'stand standed standed')).toEqual(['standed', 'standed']);
    expect(finalAnswer('catch', 'catch got got')).toEqual(['got', 'got']);
    expect(finalAnswer('bring', 'bring bought bought')).toEqual(['bought', 'bought']);
    expect(finalAnswer('teach', 'teach thought taught')).toEqual(['thought', 'taught']);
  });

  it('une réponse incomplète attend la suite', () => {
    // « do, did, done » transcrit « do dead » : le participe est perdu.
    expect(finalAnswer('do', 'do dead')).toBeNull();
    const { def, words } = heardAfter('do', 'do dead');
    expect(irrHeardForms(words, def)).toEqual(['did']);
  });
});
