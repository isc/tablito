import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SessionScreen from '../screens/SessionScreen';
import type { ConjSessionItem } from '../types';
import { CONJ_FAST_BASE_MS } from '../types';
import type { ConjJudgement } from '../lib/conjugationComposer';
import { INPUT_MODE_STORAGE_KEY } from '../hooks/useInputMode';
import { conjStrings as t } from '../i18n/conjugation';
import { letterFromWord } from '../lib/parseSpelledLetters';
import { FEEDBACK_DISMISS_MS } from '../components/FeedbackOverlay';
import { advance, tapLetters, tapValidate, text, typeLetters } from './helpers/dom';
import { conjItem } from './helpers/conjItems';
import { patchBufferSource, type PatchedBufferSource } from './helpers/audio';

// Mode vocal épelé de la conjugaison (specs §15.10), monté dans le vrai
// <SessionScreen /> avec une reconnaissance vocale simulée. Ce qui est vérifié
// ici, c'est le FLUX complet : ce que l'enfant dit, ce que l'écran affiche, ce
// qui part (ou ne part pas) au Leitner.
//
// Le dictionnaire de prononciation servi est le vrai (public/phonetic/fr.txt, cf.
// setup.ts) : l'appariement phonémique est la raison d'être du mode, le simuler
// ne prouverait rien.

let onAndroid = false;
vi.mock('../lib/install', () => ({ isAndroid: () => onAndroid }));

// L'écran de séance lit le support de la reconnaissance vocale AU CHARGEMENT du
// module (`STT_SUPPORTED`), et le mode de saisie est lui aussi un état de module
// (useInputMode). Les installer dans un `beforeEach` serait trop tard : c'est
// donc `vi.hoisted`, qui court avant les imports du fichier de test.
const { spy } = vi.hoisted(() => {
  const spy = { instance: null as InstanceType<typeof Recognition> | null, starts: 0, aborts: 0 };

  class Recognition {
    lang = '';
    interimResults = false;
    continuous = false;
    maxAlternatives = 0;
    onstart: (() => void) | null = null;
    onresult: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onend: (() => void) | null = null;

    start(): void {
      spy.starts += 1;
      spy.instance = this;
      this.onstart?.();
    }

    abort(): void {
      spy.aborts += 1;
    }
  }

  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Recognition;
  // Clé dupliquée de `INPUT_MODE_STORAGE_KEY` (inaccessible depuis un bloc
  // hoisté, qui court avant les imports) — un test la compare à la vraie.
  localStorage.setItem('multiplix-input-mode', 'voice');

  return { spy };
});

/** Une hypothèse de transcription, plus d'éventuelles alternatives. */
function emit(transcript: string, isFinal: boolean, alternatives: string[] = []): void {
  const alts = [transcript, ...alternatives];
  const result: Record<string | number, unknown> = { isFinal, length: alts.length };
  alts.forEach((a, i) => {
    result[i] = { transcript: a, confidence: 1 };
  });
  act(() => {
    spy.instance?.onresult?.({ resultIndex: 0, results: [result] });
  });
}

const say = (transcript: string, alternatives?: string[]) => emit(transcript, true, alternatives);
const saying = (transcript: string) => emit(transcript, false);

function renderSession(
  questions: ConjSessionItem[],
  onConjAnswer: (...args: unknown[]) => void = () => {},
) {
  return render(
    <SessionScreen
      questions={questions}
      onComplete={() => {}}
      onAnswer={() => {}}
      onConjAnswer={onConjAnswer as never}
    />,
  );
}

/** Le dictionnaire est chargé par fetch : on laisse les microtâches se résoudre. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const slate = () => document.querySelector('.letterpad-display-input')?.textContent ?? '';

/** Durée simulée de la lecture de l'énoncé. */
const TTS_MS = 500;
/**
 * Fenêtre pendant laquelle le composant jette tout ce qu'il entend, pour ne pas
 * confondre l'écho de la synthèse avec une réponse (POST_TTS_GRACE_MS, non
 * exportée : un module de composant n'exporte que son composant).
 */
const ECHO_WINDOW_MS = 1_300;
/**
 * Silence au-delà duquel une épellation incomplète est redemandée
 * (SPELLING_PAUSE_MS, non exportée pour la même raison).
 */
const SPELLING_PAUSE_MS = 3_500;

/**
 * L'énoncé finit d'être lu, et la fenêtre d'écho se referme. En DEUX temps
 * volontairement : avec des timers factices, les effets React ne sont vidés
 * qu'à la fin de chaque `advance`, donc tout faire d'un coup horodaterait la fin
 * de la lecture à l'instant du dernier tick — et la fenêtre d'écho ne se
 * refermerait jamais.
 */
function promptEnds(): void {
  advance(TTS_MS);
  advance(ECHO_WINDOW_MS);
}

// Le faux BufferSource de setup.ts ne termine jamais sa lecture : `isSpeaking`
// resterait vrai pour toujours, et le composant jetterait tout ce qu'il entend
// comme un écho de la synthèse. On lui donne donc une fin.
let audio: PatchedBufferSource;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  spy.instance = null;
  spy.starts = 0;
  spy.aborts = 0;
  onAndroid = false;
  audio = patchBufferSource({ endAfterMs: TTS_MS });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  audio.restore();
});

it('le mode vocal est bien celui du réglage partagé avec les maths', () => {
  // Garde-fou de la clé recopiée dans le bloc hoisté ci-dessus : si elle
  // changeait, tout ce fichier testerait silencieusement le mode clavier.
  expect(localStorage.getItem(INPUT_MODE_STORAGE_KEY)).toBe('voice');
});

describe('Épeler une réponse à voix haute (specs §15.10)', () => {
  it('la forme dite puis épelée est jugée comme une saisie clavier', async () => {
    const onConjAnswer = vi.fn();
    // « En ce moment, nous man|geons des crêpes. » — la réponse est « geons ».
    renderSession([conjItem('pres-g1-nous', 0)], onConjAnswer);
    await settle();
    // La consigne dit l'ordre : la forme, PUIS l'épellation.
    expect(text()).toContain(t.voiceSpellEnding);

    // Fin de la lecture de l'énoncé, puis l'enfant répond.
    promptEnds();
    say('mangeons gé eux o haine esse');

    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(judgement.verdict).toBe('correct');
    expect(fast).toBe(true);
    // Écho visuel : l'ardoise porte ce qui a été entendu.
    expect(slate()).toBe('geons');
  });

  it('la forme entière s’épelle quand c’est elle qui est demandée', async () => {
    const onConjAnswer = vi.fn();
    // « Aujourd'hui, nous sommes huit à table. » — forme irrégulière insécable.
    renderSession([conjItem('pres-etre-nous', 0)], onConjAnswer);
    await settle();
    expect(text()).toContain(t.voiceSpellWhole);

    promptEnds();
    say('sommes esse o emme emme e esse');

    const [, judgement] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement];
    expect(judgement.verdict).toBe('correct');
  });

  it('les homophones du STT sont inoffensifs : « haine », « thé », « ENT »', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-ils', 0)], onConjAnswer);
    await settle();
    promptEnds();
    // « En ce moment, ils jou|ent aux billes. » — épellation transcrite en mots.
    say('ils jouent eu haine thé');

    const [, judgement] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement];
    expect(judgement.verdict).toBe('correct');
    expect(slate()).toBe('ent');
  });

  it('la meilleure hypothèse du recognizer est retenue, pas forcément la première', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-ils', 0)], onConjAnswer);
    await settle();
    promptEnds();
    // La principale est du bruit, une alternative porte l'épellation.
    say('en tout cas', ['jouent e n t']);

    const [, judgement] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement];
    expect(judgement.verdict).toBe('correct');
  });

  it('l’écho visuel se remplit pendant que l’enfant parle', async () => {
    renderSession([conjItem('pres-g1-nous', 1)]);
    await settle();
    promptEnds();

    saying('chantons o');
    expect(slate()).toBe('o');
    saying('chantons o haine');
    expect(slate()).toBe('on');
  });
});

describe('Un raté de reconnaissance n’est jamais une erreur (specs §15.10)', () => {
  it('un transcript incompréhensible ne part pas au jugement', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    say('je ne sais pas trop');

    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(text()).toContain(t.voiceNotHeard);
  });

  it('une lettre perdue en route ne part pas au jugement non plus', async () => {
    // Un mot incompris APRÈS la première lettre : la reconstruction est trouée,
    // et une réponse trouée serait comptée comme une erreur de conjugaison.
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    say('o brouhaha esse');

    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(text()).toContain(t.voiceNotHeard);
  });

  it('la forme dite sans épellation invite à épeler, sans rien juger', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    say('nous chantons');
    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(text()).toContain(t.voiceSpellNow);

    // L'invite est PARLÉE (« Maintenant, épelle ! ») : le temps qu'elle passe,
    // le micro reste sourd à son propre écho, comme pour l'énoncé.
    promptEnds();
    // L'épellation arrive ensuite : elle est jugée normalement.
    say('o haine esse');
    expect(onConjAnswer).toHaveBeenCalledTimes(1);
  });

  it('deux ratés sur la même question basculent au clavier', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    say('je ne sais pas trop');
    expect(document.querySelector('.conj-voice-mic')).not.toBeNull();

    // La re-demande est parlée elle aussi : on la laisse finir avant de parler
    // par-dessus, sinon c'est son écho qu'on entendrait.
    promptEnds();
    say('alors euh bof bof');
    // Micro rangé, message neutre, clavier disponible — et rien de jugé.
    expect(document.querySelector('.conj-voice-mic')).toBeNull();
    expect(text()).toContain(t.voiceFallbackToKeyboard);
    expect(document.querySelector('.letterpad-container')).not.toBeNull();
    expect(onConjAnswer).not.toHaveBeenCalled();

    // La réponse tapée, elle, est jugée — et jugée comme une réponse TAPÉE :
    // le seuil du clavier (base + coût par caractère) et le mode « keypad »
    // dans l'historique. C'est la surface qui a produit la réponse qui compte,
    // pas le réglage : sinon la bascule de secours pénaliserait l'enfant deux
    // fois, avec un seuil de vocal sur une réponse au clavier.
    advance(CONJ_FAST_BASE_MS + 2_000);
    tapLetters('ons');
    const [, judgement, fast, , inputMode] = onConjAnswer.mock.calls[0] as [
      unknown,
      ConjJudgement,
      boolean,
      number,
      string,
    ];
    expect(judgement.verdict).toBe('correct');
    expect(inputMode).toBe('keypad');
    // 5 s de base + 1 s par caractère de « ons » = 8 s : la frappe reste rapide.
    expect(fast).toBe(true);
  });

  it('une épellation coupée par une pause se recolle au lieu d’être jugée', async () => {
    // Le recognizer tourne en sessions mono-énoncé : une pause d'enfant au
    // milieu de « s, o, m, m, e, s » ferme la session et livre un final
    // PARTIEL. Le soumettre, c'est compter « so » comme une faute de
    // conjugaison alors que l'enfant a seulement repris son souffle.
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-etre-nous', 0)], onConjAnswer);
    await settle();
    promptEnds();

    say('sommes esse o');
    // Rien n'est parti : la reconstruction n'a pas la longueur attendue. Mais
    // ce qui est entendu s'affiche déjà, l'ardoise ne recule pas.
    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(slate()).toBe('so');

    // Elle reprend, et c'est la SOMME des deux finals qui est jugée.
    advance(1_500);
    say('emme emme e esse');
    expect(slate()).toBe('sommes');
    const [, judgement] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement];
    expect(judgement.verdict).toBe('correct');
  });

  it('une épellation restée incomplète est redemandée, jamais jugée', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-etre-nous', 0)], onConjAnswer);
    await settle();
    promptEnds();

    say('sommes esse o');
    // Le silence s'installe : la suite ne viendra pas.
    advance(SPELLING_PAUSE_MS);

    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(text()).toContain(t.voiceNotHeard);
    expect(slate()).toBe('');
  });

  it('l’écho de la synthèse est jeté, et ne compte pas comme un raté', async () => {
    // Les phrases porteuses contiennent « aux billes », « à l'école » : leurs
    // mots sonnent comme les lettres o et a, donc un écho haut-parleur→micro
    // pourrait fabriquer une réponse plausible. Rien ne doit passer.
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-ils', 0)], onConjAnswer);
    await settle();

    // Juste après la lecture de l'énoncé (fenêtre de grâce).
    say('en ce moment ils jouent aux billes');
    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(text()).not.toContain(t.voiceNotHeard);
    expect(slate()).toBe('');
  });

  it('répondre par-dessus l’énoncé n’aboutit jamais à un silence', async () => {
    // Une épellation PROPRE reçue dans la fenêtre d'écho, c'est presque
    // sûrement l'enfant qui a parlé par-dessus l'énoncé : l'écho d'une phrase
    // porteuse bute sur ses mots pleins. On la jette quand même — impossible de
    // distinguer les deux voix — mais il faut le lui DIRE, sinon elle attend
    // devant un écran qui n'a rien fait de sa réponse.
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();

    say('chantons o haine esse');

    expect(onConjAnswer).not.toHaveBeenCalled();
    expect(slate()).toBe('');
    expect(text()).toContain(t.voiceNotHeard);
  });
});

describe('Correction au clavier (specs §15.10)', () => {
  it('toucher le clavier coupe le micro et rend la validation à l’enfant', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    saying('chantons o haine');
    expect(slate()).toBe('on');

    const abortsBefore = spy.aborts;
    typeLetters('s');
    expect(spy.aborts).toBeGreaterThan(abortsBefore);
    expect(slate()).toBe('ons');
    expect(text()).toContain(t.voiceTookOver);

    // Plus aucune soumission automatique ne peut lui passer devant.
    say('o haine esse');
    expect(onConjAnswer).not.toHaveBeenCalled();

    tapValidate();
    const [, judgement, , , inputMode] = onConjAnswer.mock.calls[0] as [
      unknown,
      ConjJudgement,
      boolean,
      number,
      string,
    ];
    expect(judgement.verdict).toBe('correct');
    // Corrigée à la main : c'est une réponse au clavier, pas une épellation.
    expect(inputMode).toBe('keypad');
  });

  it('le clavier reste sous la main pendant l’écoute', async () => {
    renderSession([conjItem('pres-g1-nous', 1)]);
    await settle();
    expect(document.querySelector('.letterpad-container')).not.toBeNull();
    expect(document.querySelector('.conj-voice-mic')).not.toBeNull();
  });

  it('chaque touche du clavier a un nom de lettre connu', () => {
    // Le clavier et la table des noms de lettres décrivent le même périmètre,
    // dans deux fichiers. Une touche sans nom serait une lettre impossible à
    // épeler : l'enfant la dirait, on ne l'entendrait jamais.
    renderSession([conjItem('pres-g1-nous', 1)]);
    const keys = [...document.querySelectorAll('.letterpad-btn[aria-label]')]
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((label) => [...label].length === 1);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => letterFromWord(k) === null)).toEqual([]);
  });
});

describe('Seuil de rapidité en vocal : la latence de rappel (specs §15.10)', () => {
  it('mesure le temps jusqu’au premier son, pas jusqu’à la fin de l’épellation', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    // Elle démarre vite (1 s), puis épelle longuement (20 s) : le rappel est
    // rapide, et c'est le rappel qu'on mesure. Au clavier, ce même temps total
    // aurait fait sauter l'étoile rayonnante.
    advance(1_000);
    saying('chantons');
    advance(20_000);
    say('chantons o haine esse');

    const [, , fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(fast).toBe(true);
  });

  it('une hésitation longue avant de répondre n’est pas « rapide »', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    advance(CONJ_FAST_BASE_MS + 1_000);
    saying('chantons');
    say('chantons o haine esse');

    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(judgement.verdict).toBe('correct');
    expect(fast).toBe(false);
  });

  it('la latence de rappel se mesure même par-dessus la fin de l’énoncé', async () => {
    // La fenêtre d'écho disqualifie le CONTENU d'un transcript, pas l'instant
    // où il arrive : l'enfant qui répond sur la fin de l'énoncé devra répéter,
    // mais son rappel a bien eu lieu là. Sans ça sa réponse tomberait sans
    // latence mesurée, donc jugée sur son temps total.
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();

    advance(TTS_MS); // l'énoncé finit ; la fenêtre d'écho court encore
    saying('chantons');
    // Le contenu, lui, est bien jeté : l'ardoise reste vide.
    expect(slate()).toBe('');

    advance(ECHO_WINDOW_MS);
    advance(20_000);
    say('chantons o haine esse');

    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(judgement.verdict).toBe('correct');
    expect(fast).toBe(true);
  });

  it('sans latence de rappel mesurée, c’est le seuil du CLAVIER qui s’applique', async () => {
    // Aucun interim (certains navigateurs n'en émettent pas) : on ne juge alors
    // que le temps TOTAL, épellation comprise. Le comparer à la base seule du
    // vocal rendrait « rapide » inatteignable — l'étoile rayonnante dépendrait
    // d'un aléa de reconnaissance.
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();

    // Au-delà de la base du vocal (5 s), en deçà du seuil clavier de « ons »
    // (5 s + 1 s par caractère = 8 s).
    advance(CONJ_FAST_BASE_MS + 500);
    say('chantons o haine esse');

    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(judgement.verdict).toBe('correct');
    expect(fast).toBe(true);
  });

  it('le mode de saisie remonte avec la réponse', async () => {
    const onConjAnswer = vi.fn();
    renderSession([conjItem('pres-g1-nous', 1)], onConjAnswer);
    await settle();
    promptEnds();
    say('chantons o haine esse');

    const [, , , , inputMode] = onConjAnswer.mock.calls[0] as [
      unknown,
      ConjJudgement,
      boolean,
      number,
      string,
    ];
    expect(inputMode).toBe('voice');
  });
});

describe('Politique micro (specs §15.10, §3.6bis)', () => {
  it('Android : micro fermé pendant la synthèse, rouvert après', async () => {
    onAndroid = true;
    renderSession([conjItem('pres-g1-nous', 1)]);
    await settle();
    // La lecture de l'énoncé a fermé le micro au montage (isSpeaking), la fin
    // de lecture le rouvre : c'est le bip de démarrage qui dit « à toi ».
    expect(spy.starts + spy.aborts).toBeGreaterThan(0);
  });

  it('l’écoute redémarre à la question suivante sans re-monter le composant', async () => {
    renderSession([conjItem('pres-g1-nous', 1), conjItem('fut-etre', 1)]);
    await settle();
    promptEnds();
    say('chantons o haine esse');
    // Le feedback accepté se referme tout seul (§5.3).
    advance(FEEDBACK_DISMISS_MS);

    // Question suivante : ardoise vide, consigne remise à zéro, micro toujours
    // le même (aucun abort/start supplémentaire n'est nécessaire).
    await settle();
    expect(slate()).toBe('');
    expect(text()).toContain(t.voiceSpellWhole);
  });
});
