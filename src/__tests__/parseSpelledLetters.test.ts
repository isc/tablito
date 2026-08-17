import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { LETTER_NAMES, SPELLING_FILLERS } from '../lib/letterNames';
import { parseSpelledLetters, letterFromWord, matchesSpokenForm } from '../lib/parseSpelledLetters';
import { parsePhoneticDict } from '../lib/phoneticDict';
import { conjFactDefs, resolveConjQuestion } from '../lib/conjugationFacts';

// Appariement de l'épellation en espace phonémique (specs §15.10).
//
// Les tests tournent sur le VRAI dictionnaire élagué (public/phonetic/fr.txt,
// généré par scripts/generate-phonetic-dict.mjs) : c'est lui qui fait tout le
// travail de robustesse, un faux dictionnaire ne prouverait rien. Ce que ces
// tests protègent, c'est l'invariant central du mode — on ne compare jamais un
// transcript à la cible en orthographe, donc « haine » vaut n et « thé » vaut t.

const dict = parsePhoneticDict(readFileSync('public/phonetic/fr.txt', 'utf8'));

const parse = (transcript: string, expectedForm = 'chantent', ignoreForm = false) =>
  parseSpelledLetters(transcript, { expectedForm, dict, ignoreForm });

describe('table des noms de lettres (src/lib/letterNames.ts)', () => {
  it('ne fait jamais servir un même nom à deux lettres', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const def of LETTER_NAMES) {
      for (const name of def.names) {
        const norm = name.toLowerCase().replace(/’/g, "'");
        if (seen.has(norm) && seen.get(norm) !== def.letter) {
          clashes.push(`${norm} → ${seen.get(norm)} / ${def.letter}`);
        }
        seen.set(norm, def.letter);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('ne fait jamais servir une même prononciation à deux lettres', () => {
    // Sinon l'étage phonémique devrait deviner, et le mode épellerait au hasard.
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const def of LETTER_NAMES) {
      for (const p of def.phonemes) {
        if (seen.has(p) && seen.get(p) !== def.letter) {
          clashes.push(`/${p}/ → ${seen.get(p)} / ${def.letter}`);
        }
        seen.set(p, def.letter);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('ne compte aucun mot de remplissage comme nom de lettre', () => {
    // « voilà », « c'est tout » : dits en fin d'épellation, jamais épelés.
    const collisions = SPELLING_FILLERS.filter((f) => letterFromWord(f, dict) !== null);
    expect(collisions).toEqual([]);
  });

  it('couvre toutes les lettres nécessaires aux réponses de l’inventaire', () => {
    // Une lettre manquante rendrait un fait entier inaccessible en vocal, sans
    // aucun message d'erreur : l'épellation serait juste « mal entendue ».
    const covered = new Set(LETTER_NAMES.map((d) => d.letter));
    const needed = new Set<string>();
    for (const def of conjFactDefs()) {
      def.carriers.forEach((_, i) => {
        for (const ch of resolveConjQuestion(def, i).expected) needed.add(ch);
      });
    }
    expect([...needed].filter((l) => !covered.has(l))).toEqual([]);
  });

  it('reconnaît chaque lettre par chacun de ses noms', () => {
    // Les noms d'un seul mot passent par l'appariement mot à mot, les noms
    // composés (« i grec ») par les n-grammes : les deux chemins sont couverts.
    const failing = LETTER_NAMES.flatMap((def) =>
      def.names
        .filter((name) =>
          name.includes(' ')
            ? parse(name, 'sont').answer !== def.letter
            : letterFromWord(name, dict) !== def.letter,
        )
        .map((name) => `${name} ≠ ${def.letter}`),
    );
    expect(failing).toEqual([]);
  });
});

describe('épellation reconnue (specs §15.10)', () => {
  it('verbe régulier : la forme dite puis la terminaison épelée', () => {
    // Le geste de la spec : « chantent : e, n, t ».
    const r = parse('chantent e n t');
    expect(r.status).toBe('letters');
    expect(r.saidForm).toBe(true);
    expect(r.answer).toBe('ent');
  });

  it('accepte l’homophonie de la forme dite — c’est une qualité, pas un défaut', () => {
    // « chante », « chantes » et « chantent » sont le même son : la
    // discrimination orthographique se joue dans l'épellation, pas là.
    expect(parse('chante e n t').answer).toBe('ent');
    expect(parse('chantes e n t').saidForm).toBe(true);
  });

  it('lit les noms de lettres que le STT écrit en mots', () => {
    // Le cas nominal du risque technique : « esse » pour s, « haine » pour n.
    expect(parse('esse', 'sont').answer).toBe('s');
    expect(parse('haine té', 'sont').answer).toBe('nt');
    expect(parse('o haine esse', 'serons').answer).toBe('ons');
  });

  it('projette en phonèmes les homophones que la table maison n’a pas prévus', () => {
    // « aines », « aces », « tés » ne figurent nulle part dans letterNames.ts :
    // ils n'appareillent QUE par leurs phonèmes (/ɛn/, /ɛs/, /te/). C'est
    // l'invariant du mode — on ne compare jamais en orthographe, donc une
    // transcription homophone imprévue est inoffensive par construction.
    const names = LETTER_NAMES.flatMap((d) => d.names);
    expect(names).not.toContain('aines');
    expect(names).not.toContain('aces');
    expect(names).not.toContain('tés');
    expect(parse('aines', 'sont').answer).toBe('n');
    expect(parse('aces', 'sont').answer).toBe('s');
    expect(parse('eu aines tés', 'chantent').answer).toBe('ent');
  });

  it('lit une suite de capitales épelée d’un trait', () => {
    expect(parse('ENT').answer).toBe('ent');
    expect(parse('chantent E N T').answer).toBe('ent');
  });

  it('lit une épellation ponctuée ou tiretée', () => {
    expect(parse('e.n.t').answer).toBe('ent');
    expect(parse('e-n-t').answer).toBe('ent');
    expect(parse('e, n, t').answer).toBe('ent');
  });

  it('lit les noms composés sans les découper en lettres', () => {
    // « i grec » donnerait i + un mot perdu si les n-grammes n'étaient pas
    // essayés avant les mots isolés.
    expect(parse('vé o i grec o haine esse', 'voyons').answer).toBe('voyons');
    expect(parse('double vé', 'sont').answer).toBe('w');
  });

  it('lit l’accent, dit en clair ou porté par la lettre', () => {
    expect(parse('é té a i esse', 'étais').answer).toBe('étais');
    expect(parse('e accent aigu té a i esse', 'étais').answer).toBe('étais');
    expect(parse('e accent circonflexe té e esse', 'êtes').answer).toBe('êtes');
  });

  it('ignore tout ce qui précède la première lettre', () => {
    // Préambule libre : la phrase répétée, un pronom, un mot en trop. L'enfant
    // ne parle pas comme un formulaire.
    expect(parse('demain nous chanterons o haine esse', 'chanterons').answer).toBe('ons');
    expect(parse('ils chantent e n t').answer).toBe('ent');
  });

  it('lit « euh » comme la lettre e, pas comme une hésitation', () => {
    // Arbitrage assumé (cf. letterNames.ts) : e est la lettre la plus épelée du
    // périmètre (-e, -es, -ez, -ent), et la perdre chaque fois que le STT écrit
    // « euh » coûterait bien plus cher qu'un e en trop après une hésitation.
    expect(parse('euh haine té').answer).toBe('ent');
  });

  it('ignore les marqueurs de fin d’épellation', () => {
    expect(parse('chantent e n t voilà').status).toBe('letters');
    expect(parse('chantent e n t voilà').answer).toBe('ent');
  });
});

describe('confiance dans la reconstruction (specs §15.10)', () => {
  it('un mot incompris APRÈS la première lettre invalide la reconstruction', () => {
    // On a probablement perdu une lettre en route : soumettre « et » pour
    // « ent » ferait redescendre une boîte pour une faute du micro.
    const r = parse('e n bidule t');
    expect(r.status).toBe('unheard');
  });

  it('un transcript sans aucune lettre n’est pas une réponse', () => {
    expect(parse('je ne sais pas').status).toBe('unheard');
    expect(parse('').status).toBe('unheard');
  });

  it('la forme dite sans épellation demande simplement d’épeler', () => {
    const r = parse('chantent');
    expect(r.status).toBe('form-only');
    expect(r.letters).toEqual([]);
  });

  it('une forme d’une seule lettre finit par être épelée (second passage)', () => {
    // « Aujourd'hui, il a un nouveau vélo » : la forme attendue est « a », donc
    // l'enfant qui épelle dit exactement la forme. Au premier passage on croit
    // qu'elle a seulement énoncé la forme ; au second, on ne l'écarte plus.
    expect(parse('a', 'a').status).toBe('form-only');
    const r = parse('a', 'a', true);
    expect(r.status).toBe('letters');
    expect(r.answer).toBe('a');
  });

  it('la forme n’est écartée qu’en préambule, jamais au milieu de l’épellation', () => {
    // Sinon, épeler « es » (« tu es ») perdrait le e : « es » sonne comme la
    // forme, mais après une lettre c'est le nom de la lettre s.
    const r = parse('es e esse', 'es');
    expect(r.answer).toBe('es');
  });
});

describe('appariement de la forme dite (specs §15.10)', () => {
  it('reconnaît la forme par ses phonèmes, homophones compris', () => {
    expect(matchesSpokenForm('chante', 'chantent', dict)).toBe(true);
    expect(matchesSpokenForm('chantes', 'chantent', dict)).toBe(true);
    expect(matchesSpokenForm('mangeons', 'mangeons', dict)).toBe(true);
  });

  it('ne confond pas deux formes qui ne sonnent pas pareil', () => {
    expect(matchesSpokenForm('chanterons', 'chantons', dict)).toBe(false);
    expect(matchesSpokenForm('bonjour', 'sommes', dict)).toBe(false);
  });

  it('tient sans dictionnaire, en moins fin', () => {
    // Chargement en échec : le mode dégrade (étages orthographiques) au lieu de
    // casser. L'épellation en lettres nommées passe toujours.
    const r = parseSpelledLetters('chantent esse', { expectedForm: 'chantent', dict: null });
    expect(r.answer).toBe('s');
    expect(r.saidForm).toBe(true);
  });
});
