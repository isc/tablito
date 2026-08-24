import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SessionScreen from '../screens/SessionScreen';
import { isConjAccepted, type ConjJudgement } from '../lib/conjugationComposer';
import { conjStrings as t } from '../i18n/conjugation';
import {
  advance,
  requireButton as findButton,
  tapValidate,
  text,
  typeLetters as tapLetters,
} from './helpers/dom';
import { conjItem } from './helpers/conjItems';
import { patchBufferSource } from './helpers/audio';

// Tests DOM de la matière conjugaison (spec Verbito) : rendu d'une question,
// mini-clavier à validation explicite, introduction en 5 étapes (§5.2) et les
// quatre cas de feedback (§5.3). On monte le vrai <SessionScreen /> avec une
// file de questions fabriquée à la main — l'écran est le point d'entrée de
// toute l'UI de la matière (clavier, forme segmentée, overlays).

// Compteur d'oscillateurs : `useSound` n'en crée QUE pour jouer un son. Zéro
// oscillateur après une erreur = « aucun son négatif » (§5.3), vérifié à la
// source plutôt que par un mock de hook.
let oscillators = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  oscillators = 0;
  const AC = globalThis.AudioContext as unknown as {
    prototype: { createOscillator: () => OscillatorNode };
  };
  vi.spyOn(AC.prototype, 'createOscillator').mockImplementation(function (this: AudioContext) {
    oscillators++;
    return {
      type: 'sine',
      frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    } as unknown as OscillatorNode;
  });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Question de conjugaison — rendu (spec §4.1, §4.2)', () => {
  it('verbe régulier : la phrase porteuse s’affiche, le radical est donné, seule la terminaison est à taper', () => {
    // « En ce moment, nous man|geons des crêpes. » — le piège -geons.
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 0)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );

    expect(text()).toContain('En ce moment,');
    expect(text()).toContain('nous');
    // Rappel de l'infinitif, jamais l'énoncé lui-même.
    expect(text()).toContain('(manger)');
    // Le radical est affiché (en couleur de radical), la terminaison est le blanc.
    expect(document.querySelector('.conj-form-stem')?.textContent).toBe('man');
    expect(document.querySelector('.conj-blank')).not.toBeNull();
    // Le radical est rappelé dans l'ardoise du clavier : l'enfant voit la forme
    // se construire sans confondre ce qu'il tape avec ce qui lui est offert.
    expect(document.querySelector('.letterpad-display-prefix')?.textContent).toBe('man');
  });

  it('forme irrégulière : aucun radical donné, la forme entière est à taper', () => {
    render(
      <SessionScreen
        questions={[conjItem('pres-etre-nous', 0)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );

    expect(text()).toContain('(être)');
    expect(document.querySelector('.conj-form-stem')?.textContent).toBe('');
    expect(document.querySelector('.letterpad-display-prefix')).toBeNull();
  });

  it('la phrase porteuse est lue à voix haute, et réécoutable à la demande', async () => {
    const urls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      return realFetch(input as RequestInfo, init);
    }) as typeof fetch;

    const audio = patchBufferSource();

    render(
      <SessionScreen
        questions={[conjItem('fut-aller', 0)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );
    // Laisse le préchargement + le décodage se résoudre (microtasks).
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve(); });

    // Clé TTS de la porteuse : `conj-<clé du fait>-<rang de la porteuse>`.
    expect(urls.some((u) => u.includes('conj-fut-aller-0.mp3'))).toBe(true);
    expect(audio.starts()).toBeGreaterThan(0);

    const before = audio.starts();
    fireEvent.click(document.querySelector<HTMLButtonElement>('.conj-replay-btn')!);
    expect(audio.starts()).toBe(before + 1);

    audio.restore();
    globalThis.fetch = realFetch;
  });
});

describe('Mini-clavier de lettres (spec §4.2)', () => {
  it('les lettres tapées s’affichent, l’effacement retire la dernière', () => {
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );

    tapLetters('ons');
    expect(document.querySelector('.letterpad-display-input')?.textContent).toBe('ons');

    fireEvent.click(document.querySelector<HTMLButtonElement>('.letterpad-btn-backspace')!);
    expect(document.querySelector('.letterpad-display-input')?.textContent).toBe('on');
  });

  it('validation EXPLICITE : rien n’est soumis tant que « Valider » n’est pas pressé', () => {
    const onConjAnswer = vi.fn();
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );

    // La réponse complète et juste est tapée : toujours aucune soumission —
    // contrairement au NumPad, la longueur attendue n'est pas prévisible.
    tapLetters('ons');
    expect(onConjAnswer).not.toHaveBeenCalled();

    tapValidate();
    expect(onConjAnswer).toHaveBeenCalledTimes(1);
  });

  it('« Valider » et « Effacer » restent inertes tant que rien n’est tapé', () => {
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );

    expect(document.querySelector<HTMLButtonElement>('.letterpad-btn-ok')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('.letterpad-btn-backspace')!.disabled).toBe(
      true,
    );
  });
});

describe('Feedback — les quatre cas (spec §5.3)', () => {
  it('correct et rapide : étoile rayonnante', () => {
    const onConjAnswer = vi.fn();
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );

    tapLetters('ons');
    tapValidate();

    expect(document.querySelector('.feedback-star-rays')).not.toBeNull();
    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(judgement.verdict).toBe('correct');
    expect(fast).toBe(true);
  });

  it('correct mais lent : « Bravo ! », étoile sans rayons, et la lenteur n’est jamais nommée', () => {
    const onConjAnswer = vi.fn();
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );

    // Seuil = 5 s + 1 s par caractère de « ons » → 8 s. On prend son temps.
    advance(12_000);
    tapLetters('ons');
    tapValidate();

    expect(document.querySelector('.feedback-star-rays')).toBeNull();
    expect(document.querySelector('.feedback-message.correct')?.textContent).toBe(t.wellDone);
    expect(text()).not.toMatch(/lent|vite|rapide/i);
    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(isConjAccepted(judgement.verdict)).toBe(true);
    expect(fast).toBe(false);
  });

  it('« presque » : coquille du radical acceptée, forme correcte montrée segmentée', () => {
    const onConjAnswer = vi.fn();
    // « Bientôt, nous ser|ons prêts. » — tapé « cerons ».
    render(
      <SessionScreen
        questions={[conjItem('fut-etre', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );

    tapLetters('cerons');
    tapValidate();

    const [, judgement, fast] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement, boolean];
    expect(judgement.verdict).toBe('almost');
    expect(isConjAccepted(judgement.verdict)).toBe(true);
    expect(judgement.blamedKeys).toEqual([]);
    // Accepté mais JAMAIS promu (§5.3) : seul un `correct` franc peut être
    // « rapide » — la boîte ne monte que sur la forme exacte. Réponse tapée
    // instantanément (faux timers) : sans le verrou de verdict, elle serait
    // passée « rapide ».
    expect(fast).toBe(false);

    // Accepté : pas de carte d'erreur, et la forme correcte segmentée.
    expect(document.querySelector('.feedback-overlay.incorrect')).toBeNull();
    const overlay = document.querySelector('.feedback-overlay.correct')!;
    expect(overlay.querySelector('.conj-form-stem')?.textContent).toBe('ser');
    expect(overlay.querySelector('.conj-form-mark')?.textContent).toBe('ons');
    // Rien n'est dit de la coquille : on ne pénalise jamais l'orthographe
    // lexicale dans un jeu de conjugaison.
    expect(overlay.textContent).toContain(t.wellDone);
  });

  it('erreur : aucun son négatif, forme correcte avec pronom et marque illuminés', () => {
    const onConjAnswer = vi.fn();
    // « En ce moment, nous man|geons des crêpes. » — tapé « ons » (piège raté).
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 0)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );

    tapLetters('ons');
    tapValidate();

    // Aucun son du tout sur le chemin d'erreur (le silence, jamais le buzzer).
    expect(oscillators).toBe(0);

    const overlay = document.querySelector('.feedback-overlay.incorrect')!;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.conj-form-subject.is-lit')).not.toBeNull();
    expect(overlay.querySelector('.conj-form-mark.is-lit')).not.toBeNull();
    expect(overlay.querySelector('.conj-form-stem')?.textContent).toBe('man');
    expect(overlay.querySelector('.conj-form-mark')?.textContent).toBe('geons');
    // Le feedback n'avance pas tout seul : l'enfant referme quand il a regardé.
    advance(5_000);
    expect(document.querySelector('.feedback-overlay.incorrect')).not.toBeNull();
  });

  it('une réponse correcte, elle, fait bien un son', () => {
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );

    tapLetters('ons');
    tapValidate();
    expect(oscillators).toBeGreaterThan(0);
  });

  it('astuce affichée pour un fait en boîte ≤ 2, pas au-delà', () => {
    const { unmount } = render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 0, { box: 2 })]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );
    tapLetters('ons');
    tapValidate();
    // Le piège de son a priorité : c'est LUI qui vient de faire rater.
    expect(text()).toContain('Le piège du g et du c');
    unmount();

    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 0, { box: 3 })]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );
    tapLetters('ons');
    tapValidate();
    expect(text()).not.toContain('Le piège du g et du c');
  });

  it('attribution d’erreur : « seron » fait redescendre la terminaison, pas le radical', () => {
    const onConjAnswer = vi.fn();
    render(
      <SessionScreen
        questions={[conjItem('fut-etre', 1)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );

    tapLetters('seron');
    tapValidate();

    const [, judgement] = onConjAnswer.mock.calls[0] as [unknown, ConjJudgement];
    expect(judgement.verdict).toBe('ending');
    expect(judgement.blamedKeys).toEqual(['fut-nous']);
  });

  it('une erreur re-programme la question 2 à 3 questions plus tard', () => {
    render(
      <SessionScreen
        questions={[conjItem('pres-g1-nous', 0)]}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );

    expect(document.querySelectorAll('.session-progress-dot')).toHaveLength(1);
    tapLetters('ons');
    tapValidate();
    fireEvent.click(findButton(/J'ai compris/));
    // La file s'est allongée d'un re-test.
    expect(document.querySelectorAll('.session-progress-dot')).toHaveLength(2);
  });
});

describe('Introduction d’un fait nouveau — 5 étapes (spec §5.2)', () => {
  const intro = () => [conjItem('pres-g1-nous', 1, { isIntroduction: true })];

  it('étape 1 : la phrase en contexte, forme complète visible', () => {
    render(<SessionScreen
        questions={intro()}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />);

    expect(text()).toContain(t.new);
    const sentence = document.querySelector('.conj-intro-sentence')!;
    expect(sentence.textContent).toContain('Aujourd’hui,');
    expect(sentence.querySelector('.conj-form-stem')?.textContent).toBe('chant');
    expect(sentence.querySelector('.conj-form-mark')?.textContent).toBe('ons');
    // Pas de clavier tant qu'on n'a rien à écrire.
    expect(document.querySelector('.letterpad-container')).toBeNull();
  });

  it('étape 2 : le pronom s’illumine, puis sa marque, avec la règle en ancrage', () => {
    render(<SessionScreen
        questions={intro()}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />);
    fireEvent.click(findButton(/Suivant/));

    expect(document.querySelector('.conj-form-subject.is-lit')).not.toBeNull();
    expect(document.querySelector('.conj-form-mark.is-lit')).toBeNull();

    advance(800);
    expect(document.querySelector('.conj-form-mark.is-lit')).not.toBeNull();
    // Ancrage à la règle transversale : les marques de personne.
    expect(text()).toContain('Chaque personne a sa marque');
  });

  it('étape 3 : copie différée — le modèle s’affiche 4 s, se masque, l’enfant écrit', () => {
    render(<SessionScreen
        questions={intro()}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />);
    fireEvent.click(findButton(/Suivant/));
    advance(800);
    fireEvent.click(findButton(/Suivant/));

    // Modèle visible, clavier encore absent : « je lis ».
    expect(text()).toContain('Regarde bien');
    expect(document.querySelector('.conj-copy-model .conj-form-mark')?.textContent).toBe('ons');
    expect(document.querySelector('.letterpad-container')).toBeNull();

    advance(4_000);

    // « Je cache, j'écris » : seule la TERMINAISON se couvre. Le pronom et le
    // radical restent — sans le pronom, l'écran ne dit plus quelle personne est
    // demandée, et le radical est de toute façon affiché par le clavier.
    expect(document.querySelector('.conj-copy-model .conj-form-mark')).toBeNull();
    expect(document.querySelector('.conj-copy-model .conj-form-subject')?.textContent).toBe('nous');
    expect(document.querySelector('.conj-copy-model .conj-form-stem')?.textContent).toBe('chant');
    expect(document.querySelector('.conj-copy-model .conj-blank')).not.toBeNull();
    expect(document.querySelector('.letterpad-container')).not.toBeNull();
    expect(text()).toContain(t.copyWrite);
  });

  it('étape 3 ratée : le modèle est remontré, sans reproche ni pénalité', () => {
    const onConjAnswer = vi.fn();
    render(
      <SessionScreen
        questions={intro()}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );
    fireEvent.click(findButton(/Suivant/));
    advance(800);
    fireEvent.click(findButton(/Suivant/));
    advance(4_000);

    tapLetters('on');
    tapValidate();

    expect(document.querySelector('.conj-copy-model .conj-form-mark')?.textContent).toBe('ons');
    expect(text()).toContain('Regarde encore');
    // La copie n'entre JAMAIS dans le Leitner.
    expect(onConjAnswer).not.toHaveBeenCalled();
  });

  it('étape 3 : la copie est jugée comme la séance — la forme entière recopiée passe', () => {
    // Le modèle montré à l'étape 3 est la forme ENTIÈRE (« nous chantons »),
    // alors que seule la terminaison est attendue. L'enfant qui recopie ce
    // qu'il vient de voir a fait exactement ce qu'on lui demandait : la copie
    // ne peut pas être plus sévère que la question qu'elle prépare.
    render(
      <SessionScreen
        questions={intro()}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={() => {}}
      />,
    );
    fireEvent.click(findButton(/Suivant/));
    advance(800);
    fireEvent.click(findButton(/Suivant/));
    advance(4_000);

    tapLetters('chantons');
    tapValidate();

    // On est passé à l'étape 4 (la question), pas revenu sur le modèle.
    expect(document.querySelector('.conj-question')).not.toBeNull();
    expect(text()).not.toContain('Regarde encore');
  });

  it('étapes 4 et 5 : la copie réussie enchaîne sur la question, qui programme un re-test', () => {
    const onConjAnswer = vi.fn();
    render(
      <SessionScreen
        questions={intro()}
        onComplete={() => {}}
        onAnswer={() => {}}
        onConjAnswer={onConjAnswer}
      />,
    );
    fireEvent.click(findButton(/Suivant/));
    advance(800);
    fireEvent.click(findButton(/Suivant/));
    advance(4_000);

    tapLetters('ons');
    tapValidate();

    // Étape 4 : la première question, en contexte.
    expect(document.querySelector('.conj-question')).not.toBeNull();
    expect(document.querySelector('.conj-blank')).not.toBeNull();
    expect(onConjAnswer).not.toHaveBeenCalled();

    tapLetters('ons');
    tapValidate();
    expect(onConjAnswer).toHaveBeenCalledTimes(1);
    // Étape 5 : le re-test différé s'ajoute à la file.
    expect(document.querySelectorAll('.session-progress-dot')).toHaveLength(2);
  });
});
