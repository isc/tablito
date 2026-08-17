import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  AnySessionItem,
  ConjSessionItem,
  SessionItem,
  SessionResult,
} from '../types';
import NumPad from '../components/NumPad';
import LetterKeyboard from '../components/LetterKeyboard';
import VoiceInput from '../components/VoiceInput';
import ConjVoiceInput from '../components/ConjVoiceInput';
import DotGrid from '../components/DotGrid';
import ConjForm from '../components/ConjForm';
import { renderConjHintLine } from '../components/conjHintLine';
import FeedbackOverlay from '../components/FeedbackOverlay';
import ConjFeedbackOverlay from '../components/ConjFeedbackOverlay';
import StrategyHint from '../components/StrategyHint';
import StrategyHintShell from '../components/StrategyHintShell';
import DivisionStrategyHint from '../components/DivisionStrategyHint';
import RemainderStrategyHint from '../components/RemainderStrategyHint';
import {
  FAST_THRESHOLD_MS,
  DIVISION_FAST_THRESHOLD_MS,
  REMAINDER_FAST_THRESHOLD_MS,
  conjFastThresholdMs,
  remainderDividend,
} from '../types';
import {
  requireConjFactDef,
  resolveConjQuestion,
  type ConjQuestionView,
} from '../lib/conjugationFacts';
import { getConjStrategy } from '../lib/conjugationStrategies';
import {
  conjRetryGap,
  isConjAccepted,
  judgeConjAnswer,
  type ConjJudgement,
} from '../lib/conjugationComposer';
import { conjStrings as tc } from '../i18n/conjugation';
import { getStrategy, hasStrategy } from '../lib/strategies';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { getRemainderStrategy } from '../lib/remainderStrategies';
import { getDivisionFactKey } from '../lib/divisionFacts';
import { getRemainderFactKey } from '../lib/remainderFacts';
import { getFactKey } from '../lib/facts';
import { itemDisplay } from '../lib/sessionItemView';
import { MAX_SESSION_QUESTIONS, scheduleRetry, todayISO } from '../lib/utils';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useInputMode } from '../hooks/useInputMode';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { preflightMicPermission } from '../lib/micPreflight';
import { useWakeLock } from '../hooks/useWakeLock';
import { useSessionStrings } from '../i18n/session';

const STT_SUPPORTED = isSpeechRecognitionSupported();

// Écran de séance UNIFIÉ (specs §11.6). Une séance est une liste de
// AnySessionItem : 100% multiplication (avant déblocage de la division), mixte
// (division + entretien des tables), ou 100% conjugaison — la conjugaison étant
// une MATIÈRE séparée (spec Verbito §7.2), ses questions ne se mélangent jamais
// aux questions de maths dans une même séance. Chaque question est rendue selon
// son `kind`.
type IntroStep = 'grid' | 'commute' | 'strategy';

/**
 * Introduction d'un fait de conjugaison — 5 étapes (spec Verbito §5.2) :
 *   1. `sentence`  : la phrase en contexte, affichée ET lue, forme visible ;
 *   2. `mechanics` : la mécanique en couleurs (pronom puis marque illuminés),
 *                    ancrée à la règle transversale ;
 *   3. `copy`      : la copie différée — la forme s'affiche 4 s, se masque,
 *                    l'enfant la tape (le geste ELOR qu'elle connaît) ;
 *   4. la première question, en contexte → sortie de `showIntro` ;
 *   5. le re-test 2 à 3 questions plus tard → `scheduleRetry`.
 */
type ConjIntroStep = 'sentence' | 'mechanics' | 'copy';

/** Durée d'exposition du modèle avant masquage, étape 3 (spec §5.2). */
const CONJ_COPY_REVEAL_MS = 4000;

/**
 * Nombre de copies ratées tolérées avant de passer à la question quand même :
 * la copie différée est un geste d'ancrage, pas une épreuve — on ne laisse
 * jamais l'enfant coincé dessus.
 */
const CONJ_COPY_MAX_ATTEMPTS = 3;

interface SessionScreenProps {
  questions: AnySessionItem[];
  onComplete: (result: Omit<SessionResult, 'factsPromoted'>) => void;
  onAnswer: (
    item: SessionItem,
    correct: boolean,
    timeMs: number,
    answered: number | null,
    inputMode: 'keypad' | 'voice',
    // Niveau 3 uniquement : reste répondu (null si la question s'est arrêtée
    // à un quotient faux). `answered` porte alors le quotient répondu.
    answeredRemainder?: number | null,
  ) => void;
  /**
   * Réponse à une question de conjugaison. Canal SÉPARÉ d'`onAnswer` (et non un
   * élargissement de sa signature) pour deux raisons : la réponse est une
   * chaîne, pas un nombre, et le verdict n'est pas booléen — `judgeConjAnswer`
   * attribue l'erreur (§4.5), et les faits à faire redescendre ne sont pas
   * forcément celui posé (`blamedKeys`).
   */
  onConjAnswer: (
    item: ConjSessionItem,
    judgement: ConjJudgement,
    fast: boolean,
    timeMs: number,
    inputMode: 'keypad' | 'voice',
  ) => void;
}

// Vue d'affichage selon le type : opérandes affichés (via itemDisplay,
// partagé avec FeedbackOverlay), réponse attendue, seuil de rapidité, clé TTS.
function view(item: SessionItem) {
  const display = itemDisplay(item);
  if (item.kind === 'rem') {
    return {
      ...display,
      answer: item.fact.quotient,
      fastMs: REMAINDER_FAST_THRESHOLD_MS,
      qKey: `qr-${display.left}-${display.right}`,
      token: `r-${display.left}-${display.right}`,
    };
  }
  if (item.kind === 'div') {
    return {
      ...display,
      answer: item.fact.quotient,
      fastMs: DIVISION_FAST_THRESHOLD_MS,
      qKey: `qd-${display.left}-${display.right}`,
      token: `d-${display.left}-${display.right}`,
    };
  }
  return {
    ...display,
    answer: item.fact.product,
    fastMs: FAST_THRESHOLD_MS,
    qKey: `q-${display.left}-${display.right}`,
    token: `m-${display.left}-${display.right}`,
  };
}

function itemKey(item: AnySessionItem): string {
  if (item.kind === 'conj') return item.fact.key;
  if (item.kind === 'rem') return getRemainderFactKey(item.fact.divisor, item.fact.quotient);
  if (item.kind === 'div') return getDivisionFactKey(item.fact.dividend, item.fact.divisor);
  return getFactKey(item.fact.a, item.fact.b);
}

// Question de conjugaison résolue (phrase porteuse, radical affiché, réponse
// attendue, segmentation, clé TTS) — tout se dérive du couple (fait, porteuse).
function conjView(item: ConjSessionItem): ConjQuestionView {
  return resolveConjQuestion(requireConjFactDef(item.fact.key), item.carrierIndex);
}

// Clé TTS de l'énoncé d'une question (pré-générée par scripts/generate-tts.mjs).
// En conjugaison, l'énoncé s'arrête à l'infinitif (« Demain, nous… chanter »,
// §4.1) : lire la phrase entière dicterait la réponse au moment où on la
// demande, et les formes irrégulières n'auraient plus qu'à être transcrites.
function questionKey(item: AnySessionItem): string {
  return item.kind === 'conj' ? conjView(item).promptTtsKey : view(item).qKey;
}

// Clé TTS de l'écran d'intro d'un item.
function introKey(item: AnySessionItem): string {
  // §5.2 étape 1 : « la phrase en contexte, affichée et lue à voix haute,
  // forme complète visible ». C'est le SEUL moment où l'audio donne la forme —
  // ici on montre, on ne teste pas encore.
  if (item.kind === 'conj') {
    const cv = conjView(item);
    return cv.sentenceTtsKey ?? cv.promptTtsKey;
  }
  if (item.kind === 'rem') return `intror-${item.fact.divisor}-${item.fact.quotient}`;
  if (item.kind === 'div') return `introd-${item.fact.dividend}-${item.fact.divisor}`;
  return `intro-${item.fact.a}-${item.fact.b}`;
}

export default function SessionScreen({
  questions: initialQuestions,
  onComplete,
  onAnswer,
  onConjAnswer,
}: SessionScreenProps) {
  const [questions, setQuestions] = useState<AnySessionItem[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState<IntroStep>('grid');
  const [conjIntroStep, setConjIntroStep] = useState<ConjIntroStep>('sentence');
  // Étape 2 : le pronom s'illumine d'abord, sa marque ensuite.
  const [conjMarkLit, setConjMarkLit] = useState(false);
  // Étape 3 : le modèle est visible (4 s) puis masqué — l'enfant tape alors.
  const [conjCopyVisible, setConjCopyVisible] = useState(true);
  const conjCopyAttempts = useRef(0);
  const [feedback, setFeedback] = useState<{
    item: SessionItem;
    correct: boolean;
    fast: boolean;
    submittedValue: number;
    // Niveau 3 : reste saisi (null = la question s'est arrêtée au quotient).
    submittedRemainder?: number | null;
  } | null>(null);
  const [conjFeedback, setConjFeedback] = useState<{
    view: ConjQuestionView;
    judgement: ConjJudgement;
    fast: boolean;
    typed: string;
    box: ConjSessionItem['fact']['box'];
  } | null>(null);
  // Niveau 3 — saisie en deux temps (specs §12.5) : quotient validé de la
  // question en cours, null tant qu'on est à l'étape 1 (« Combien de fois ? »).
  const [remQuotient, setRemQuotient] = useState<number | null>(null);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  const submittingRef = useRef(false);

  const { playCorrect, playIncorrect } = useSound();
  const { speak, stop: stopSpeech, preload, isSpeaking } = useTTS();
  const { inputMode, setInputMode } = useInputMode();
  const t = useSessionStrings();
  useWakeLock(true);

  // Bascule clavier → micro en cours de séance. On pré-arme la permission en
  // consommant le geste du clic (requis par iOS) AVANT de monter VoiceInput :
  // sinon le tout premier SpeechRecognition.start() coïncide avec le prompt
  // natif et, sur iOS, déclenche le glitch « onend immédiat » au premier
  // octroi. On reproduit ici le preflight déjà fait au démarrage de séance.
  const switchToVoice = useCallback(async () => {
    await preflightMicPermission();
    setInputMode('voice');
  }, [setInputMode]);

  // Mode vocal épelé de la conjugaison (§15.10) : même réglage que le vocal des
  // maths, donc même bascule et même persistance — le clavier reste le défaut.
  // La matière étant francophone, aucune condition de langue à ajouter ici, et
  // aucune condition de support : comme `VoiceInput` côté maths, c'est le
  // composant qui retombe sur le clavier si le navigateur ne sait pas écouter.
  const conjVoiceMode = inputMode === 'voice';

  const questionStartTime = useRef(0);
  /**
   * Conjugaison en vocal épelé : latence de RAPPEL de la question en cours —
   * l'écart entre la question posée et le premier son de la réponse (§15.10).
   * C'est elle qui décide de « rapide », et non le temps jusqu'à la validation :
   * le coût moteur de la frappe disparaissant, le seuil mesure enfin le rappel
   * pur. `null` tant que l'enfant n'a pas parlé (réponse tapée, ou pas encore).
   */
  const conjRecallMs = useRef<number | null>(null);
  const correctCount = useRef(0);
  const totalTimeMs = useRef(0);
  const introducedFacts = useRef(new Set<string>());

  const currentItem = questions[currentIndex] as AnySessionItem | undefined;

  const speakQuestion = useCallback((item: AnySessionItem) => speak(questionKey(item)), [speak]);

  // Précharge l'audio de toutes les questions de la séance dès son ouverture.
  // Sans cela, le MP3 d'une question est décodé à la volée quand on l'atteint :
  // un enfant qui connaît le fait peut répondre avant la fin de ce décodage, et
  // le stop() de la réponse annule alors une lecture jamais démarrée — la
  // question n'est jamais lue à voix haute (bug des séances mixtes où les
  // divisions, plus lentes à répondre, s'entendaient mais pas les tables
  // connues). Préchargé = `speak` démarre par le chemin synchrone, increvable.
  useEffect(() => {
    const keys = new Set<string>();
    for (const item of initialQuestions) {
      keys.add(questionKey(item));
      if (item.isIntroduction) keys.add(introKey(item));
      if (item.kind === 'rem') {
        // Invites statiques du niveau 3 : relance de l'étape 2 et astuce
        // générique d'erreur (le dividende varie, l'astuce parlée est fixe).
        keys.add('rem-rest');
        keys.add('strategy-rem');
      }
    }
    preload([...keys]);
    // Une seule fois à l'ouverture : les retrys réutilisent des clés déjà en cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ajuste l'état UI au changement de question (render-time, cf. ancien
  // SessionScreen — reset synchrone du guard anti double-submit).
  const [prevIndex, setPrevIndex] = useState(-1);
  if (currentIndex !== prevIndex && currentItem) {
    submittingRef.current = false;
    setPrevIndex(currentIndex);
    if (currentItem.isIntroduction) {
      setShowIntro(true);
      setIntroStep('grid');
      setConjIntroStep('sentence');
      setConjMarkLit(false);
      setConjCopyVisible(true);
      conjCopyAttempts.current = 0;
    } else {
      setShowIntro(false);
    }
    setNumpadDisabled(false);
    setRemQuotient(null);
    conjRecallMs.current = null;
  }

  useEffect(() => {
    if (!currentItem) return;
    if (currentItem.isIntroduction) {
      introducedFacts.current.add(itemKey(currentItem));
      speak(introKey(currentItem));
    } else {
      speakQuestion(currentItem);
    }
    questionStartTime.current = Date.now();
  }, [currentIndex, currentItem, speak, speakQuestion]);

  // En vocal, démarrer le timer à la fin du TTS (ne pas compter la lecture).
  // Pas de reset en étape 2 du niveau 3 (relance « il reste ? ») : le temps
  // d'une question à deux réponses court de l'affichage à la validation du
  // reste (specs §12.7).
  useEffect(() => {
    if (inputMode !== 'voice') return;
    if (showIntro) return;
    if (remQuotient !== null) return;
    if (!isSpeaking) {
      questionStartTime.current = Date.now();
    }
  }, [isSpeaking, inputMode, showIntro, currentIndex, remQuotient]);

  // Étape 2 de l'intro conjugaison : le pronom s'illumine à l'arrivée, sa
  // marque une demi-seconde plus tard — l'accord se joue dans cet écart.
  useEffect(() => {
    if (!showIntro || conjIntroStep !== 'mechanics') return;
    setConjMarkLit(false);
    const timer = setTimeout(() => setConjMarkLit(true), 700);
    return () => clearTimeout(timer);
  }, [showIntro, conjIntroStep, currentIndex]);

  // Étape 3 : « je lis, je cache, j'écris » (Skinner et al. 1997). Le modèle
  // s'affiche 4 s puis se masque — c'est le masquage qui fait le rappel.
  useEffect(() => {
    if (!showIntro || conjIntroStep !== 'copy' || !conjCopyVisible) return;
    const timer = setTimeout(() => setConjCopyVisible(false), CONJ_COPY_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [showIntro, conjIntroStep, conjCopyVisible]);

  const moveToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      const totalQuestions = results.length + (feedback ? 1 : 0);
      const avgTime = totalQuestions > 0 ? totalTimeMs.current / totalQuestions : 0;
      onComplete({
        date: todayISO(),
        questionsCount: questions.length,
        correctCount: correctCount.current,
        averageTimeMs: Math.round(avgTime),
        newFactsIntroduced: introducedFacts.current.size,
      });
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, questions, results.length, feedback, onComplete]);

  const handleAnswer = useCallback(
    (value: number) => {
      if (!currentItem || submittingRef.current) return;
      // Canal numérique : les questions de conjugaison passent par
      // `handleConjSubmit` (réponse en chaîne, verdict non booléen).
      if (currentItem.kind === 'conj') return;

      // Niveau 3, étape 1 (« Combien de fois ? ») : un quotient JUSTE ne clôt
      // pas la question — on passe à l'étape 2 (« Il reste combien ? ») sans
      // toucher au timer ni au Leitner (specs §12.5). Un quotient FAUX
      // court-circuite : la question se termine incorrecte, le feedback cible
      // l'encadrement (pas la peine de demander un reste sur un mauvais
      // multiple).
      if (currentItem.kind === 'rem' && remQuotient === null && value === currentItem.fact.quotient) {
        stopSpeech();
        setRemQuotient(value);
        speak('rem-rest');
        return;
      }

      submittingRef.current = true;
      setNumpadDisabled(true);
      stopSpeech();

      const v = view(currentItem);
      const timeMs = Date.now() - questionStartTime.current;
      const isRemainderStep = currentItem.kind === 'rem' && remQuotient !== null;
      // Étape 2 : la valeur saisie est le reste ; le quotient est déjà validé.
      const correct = isRemainderStep
        ? value === currentItem.remainder
        : value === v.answer;
      const fast = correct && timeMs < v.fastMs[inputMode];

      totalTimeMs.current += timeMs;
      if (correct) correctCount.current++;

      if (correct) playCorrect();
      else playIncorrect();

      const answeredQuotient = isRemainderStep ? remQuotient : value;
      const answeredRemainder =
        currentItem.kind === 'rem' ? (isRemainderStep ? value : null) : undefined;
      onAnswer(currentItem, correct, timeMs, answeredQuotient, inputMode, answeredRemainder);

      // Réintroduction après erreur, plafond de séance compris (cf.
      // MAX_SESSION_QUESTIONS) — même mécanique qu'en conjugaison.
      if (!correct) {
        setQuestions((prev) => scheduleRetry(prev, currentIndex, currentItem, 3));
      }

      setResults((prev) => [...prev, { correct }]);
      setFeedback({
        item: currentItem,
        correct,
        fast,
        submittedValue: isRemainderStep ? remQuotient! : value,
        submittedRemainder: answeredRemainder,
      });

      // Astuce parlée sur l'overlay d'erreur (gated boîte ≤ 2 comme l'overlay).
      if (!correct && currentItem.fact.box <= 2) {
        if (currentItem.kind === 'rem') {
          // Le dividende varie à chaque présentation : astuce générique fixe.
          speak('strategy-rem');
        } else if (currentItem.kind === 'div') {
          speak(`strategyd-${currentItem.fact.dividend}-${currentItem.fact.divisor}`);
        } else if (hasStrategy(currentItem.fact.a, currentItem.fact.b)) {
          speak(`strategy-${currentItem.fact.a}-${currentItem.fact.b}`);
        }
      }
    },
    [currentItem, currentIndex, remQuotient, onAnswer, playCorrect, playIncorrect, stopSpeech, speak, inputMode],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedback(null);
    moveToNext();
  }, [moveToNext]);

  const handleConjFeedbackDismiss = useCallback(() => {
    setConjFeedback(null);
    moveToNext();
  }, [moveToNext]);

  /**
   * Réponse à une question de conjugaison (spec §4.5, §5.3). L'attribution
   * d'erreur est déléguée à `judgeConjAnswer` : c'est elle qui distingue le
   * « presque » (accepté) de l'erreur de terminaison ou de radical.
   */
  const handleConjSubmit = useCallback(
    (typed: string, source: 'keypad' | 'voice' = 'keypad') => {
      if (!currentItem || currentItem.kind !== 'conj' || submittingRef.current) return;
      submittingRef.current = true;
      setNumpadDisabled(true);
      stopSpeech();

      const view = conjView(currentItem);
      const timeMs = Date.now() - questionStartTime.current;
      const judgement = judgeConjAnswer(view, typed);
      // Le seuil dépend de la surface qui a RÉELLEMENT produit la réponse, pas
      // du réglage : après deux ratés de reconnaissance, l'enfant tape, et une
      // réponse tapée mérite le seuil du clavier. Au clavier donc, base + coût
      // par caractère, qui absorbe le coût moteur de la frappe (§4.5) ; en
      // épellation, la latence de rappel et la base seule (§15.10). Seul un
      // `correct` franc peut être « rapide » : un « presque » est accepté,
      // pas promu.
      const spoken = source === 'voice' && conjRecallMs.current !== null;
      const judgedMs = spoken ? (conjRecallMs.current as number) : timeMs;
      const fast =
        judgement.verdict === 'correct'
        && judgedMs < conjFastThresholdMs(view.expected, source);
      const accepted = isConjAccepted(judgement.verdict);

      totalTimeMs.current += timeMs;
      if (accepted) correctCount.current++;

      // Aucun son négatif en conjugaison (§5.3) : le silence, jamais le buzzer.
      if (accepted) playCorrect();

      // `timeMs` (et non `judgedMs`) part dans l'historique : le temps réel de
      // la question reste vrai, c'est le SEUIL qui change de définition.
      onConjAnswer(currentItem, judgement, fast, timeMs, source);

      // Re-pose 2 à 3 questions plus tard : après une erreur, et après une
      // introduction (§5.2 étape 5 — le re-test différé).
      if (!accepted || currentItem.isIntroduction) {
        setQuestions((prev) => scheduleRetry(prev, currentIndex, currentItem, conjRetryGap()));
      }

      setResults((prev) => [...prev, { correct: accepted }]);
      setConjFeedback({ view, judgement, fast, typed, box: currentItem.fact.box });
    },
    [currentItem, currentIndex, onConjAnswer, playCorrect, stopSpeech],
  );

  /**
   * Premier son de la réponse épelée (§15.10) : la question a été rappelée, le
   * reste (épellation, correction éventuelle) n'est plus du rappel. On ne garde
   * que le premier — après un raté de reconnaissance, la latence de rappel de
   * l'enfant reste celle de sa première tentative.
   */
  const handleConjSpeechStart = useCallback(() => {
    if (conjRecallMs.current === null) {
      conjRecallMs.current = Date.now() - questionStartTime.current;
    }
  }, []);

  /** Fin de l'introduction : on enchaîne sur la première question (§5.2 §4). */
  const finishConjIntro = useCallback(() => {
    if (!currentItem) return;
    setShowIntro(false);
    submittingRef.current = false;
    setNumpadDisabled(false);
    questionStartTime.current = Date.now();
    conjRecallMs.current = null;
    speakQuestion(currentItem);
  }, [currentItem, speakQuestion]);

  /** Étape 3 : la copie différée n'entre JAMAIS dans le Leitner. */
  const handleConjCopy = useCallback(
    (typed: string) => {
      if (!currentItem || currentItem.kind !== 'conj') return;
      const view = conjView(currentItem);
      // EXACTEMENT le juge de la séance, pas une égalité de chaînes : la copie
      // est un geste d'ancrage, elle ne peut pas être plus sévère que la
      // question qu'elle prépare (même raison qu'au placement, §4.5). Le
      // modèle affiché étant la forme ENTIÈRE, l'enfant qui la recopie en
      // entier alors que seule la terminaison est attendue a fait ce qu'on lui
      // montrait — et on ne pénalise jamais l'orthographe lexicale.
      const ok = isConjAccepted(judgeConjAnswer(view, typed).verdict);
      conjCopyAttempts.current++;
      if (ok || conjCopyAttempts.current >= CONJ_COPY_MAX_ATTEMPTS) {
        finishConjIntro();
      } else {
        // Raté : on remontre le modèle et on relit la phrase. Cover-Copy-
        // Compare, sans commentaire ni pénalité.
        setConjCopyVisible(true);
        speak(introKey(currentItem));
      }
    },
    [currentItem, finishConjIntro, speak],
  );

  const handleConjIntroNext = useCallback(() => {
    if (!currentItem || currentItem.kind !== 'conj') return;
    if (conjIntroStep === 'sentence') {
      setConjIntroStep('mechanics');
    } else if (conjIntroStep === 'mechanics') {
      setConjIntroStep('copy');
      setConjCopyVisible(true);
      speak(introKey(currentItem));
    }
    // Pas de cas 'copy' : l'étape de copie n'a pas de bouton « Suivant », c'est
    // la copie réussie (ou trois essais) qui en sort — cf. `handleConjCopy`.
  }, [conjIntroStep, currentItem, speak]);

  const handleIntroNext = useCallback(() => {
    if (!currentItem) return;
    // L'intro de conjugaison a son propre enchaînement (`handleConjIntroNext`).
    if (currentItem.kind === 'conj') return;

    const finish = () => {
      setShowIntro(false);
      questionStartTime.current = Date.now();
      speakQuestion(currentItem);
    };

    // Division et niveau 3 : intro en une étape (« pense à la multiplication » /
    // « cherche le multiple juste en dessous »).
    if (currentItem.kind === 'div' || currentItem.kind === 'rem') {
      finish();
      return;
    }

    // Multiplication : grille → commutativité (sauf carrés) → astuce → question.
    const { a, b } = currentItem.fact;
    const goToStrategyOrFinish = () => {
      if (hasStrategy(a, b)) {
        setIntroStep('strategy');
        speak(`strategy-${a}-${b}`);
      } else {
        finish();
      }
    };

    if (introStep === 'grid') {
      if (a === b) {
        goToStrategyOrFinish();
      } else {
        setIntroStep('commute');
        speak(`comm-${a}-${b}`);
      }
    } else if (introStep === 'commute') {
      goToStrategyOrFinish();
    } else {
      finish();
    }
  }, [introStep, currentItem, speak, speakQuestion]);

  if (!currentItem) return null;

  // Dispatch par matière : `mathItem` est nul sur une question de conjugaison,
  // et toute la dérivation mathématique (opérandes, seuil, clés TTS) avec lui.
  const mathItem = currentItem.kind === 'conj' ? null : currentItem;
  const conjItem = currentItem.kind === 'conj' ? currentItem : null;
  const v = mathItem ? view(mathItem) : null;
  const cv = conjItem ? conjView(conjItem) : null;
  const introStrategy =
    showIntro && currentItem.kind === 'mult' && introStep === 'strategy'
      ? getStrategy(currentItem.fact.a, currentItem.fact.b)
      : null;
  const divIntroStrategy =
    showIntro && currentItem.kind === 'div' ? getDivisionStrategy(currentItem.fact) : null;
  const remIntroStrategy =
    showIntro && currentItem.kind === 'rem' ? getRemainderStrategy(currentItem) : null;
  const conjIntroStrategy = showIntro && cv ? getConjStrategy(cv) : null;

  /**
   * Surface de saisie de la conjugaison : le mini-clavier, ou le mode vocal
   * épelé quand il est actif (§15.10) — qui rend le MÊME clavier, en le
   * préremplissant des lettres entendues et en gardant la correction ouverte.
   *
   * `token` sert de clé de reset : le clavier est re-monté à chaque question
   * (saisie vide), tandis que le composant vocal reçoit le token en prop et se
   * réinitialise sans se re-monter — un re-montage rouvrirait le micro à chaque
   * question, et iOS joue un « ding » à chaque ouverture.
   */
  const renderConjInput = (
    q: ConjQuestionView,
    token: string,
    onSubmitTyped: (typed: string, source?: 'keypad' | 'voice') => void,
  ) =>
    conjVoiceMode ? (
      <ConjVoiceInput
        expectedForm={q.form}
        onSubmit={onSubmitTyped}
        prefix={q.displayedStem}
        endingOnly={q.endingOnly}
        disabled={numpadDisabled}
        isSpeaking={isSpeaking}
        questionToken={token}
        onSpeechStart={handleConjSpeechStart}
        onNudge={speak}
      />
    ) : (
      <>
        <LetterKeyboard
          key={token}
          onSubmit={onSubmitTyped}
          disabled={numpadDisabled}
          prefix={q.displayedStem}
        />
        {STT_SUPPORTED && (
          <button
            type="button"
            className="session-input-switch"
            onClick={switchToVoice}
            disabled={numpadDisabled}
          >
            {'🎤'} {tc.voiceUseMic}
          </button>
        )}
      </>
    );

  const maxDots = Math.min(questions.length, MAX_SESSION_QUESTIONS);
  const progressDots = Array.from({ length: maxDots }, (_, i) => {
    if (i < results.length) return results[i].correct ? 'correct' : 'incorrect';
    if (i === results.length) return 'current';
    return 'pending';
  });

  return (
    <div className="session-screen">
      {!showIntro && (
        <div className="session-header">
          <div className="session-progress">
            {progressDots.map((status, i) => (
              <div key={i} className={`session-progress-dot ${status}`} />
            ))}
          </div>
        </div>
      )}

      {/* Introduction — multiplication (grille / commutativité / astuce) */}
      {showIntro && currentItem.kind === 'mult' && (
        <div className="session-intro">
          <div className="session-intro-title">{t.new}</div>

          {introStep === 'grid' ? (
            <>
              <div className="session-intro-formula">
                {currentItem.fact.a}
                <span className="session-intro-operator">{'×'}</span>
                {currentItem.fact.b}
              </div>
              <DotGrid a={currentItem.fact.a} b={currentItem.fact.b} animated size="normal" bare />
              <div className="session-intro-result">
                = <b>{currentItem.fact.product}</b>
              </div>
              <div className="session-intro-explanation">
                <strong>
                  {currentItem.fact.a} {'×'} {currentItem.fact.b}
                </strong>
                , {t.isShort}{' '}
                {Array.from({ length: currentItem.fact.a })
                  .map(() => currentItem.fact.b.toString())
                  .join(' + ')}{' '}
                = <strong>{currentItem.fact.product}</strong>
              </div>
              <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
                {t.next}
              </button>
            </>
          ) : introStep === 'commute' ? (
            <>
              <DotGrid a={currentItem.fact.a} b={currentItem.fact.b} animated={false} showRotation size="normal" />
              <div className="session-intro-commutativity">
                {currentItem.fact.b} {'×'} {currentItem.fact.a}{t.sameThing}
                <br />
                {t.alsoEquals} <strong>{currentItem.fact.product}</strong>
              </div>
              <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
                {t.next}
              </button>
            </>
          ) : (
            <>
              {introStrategy && <StrategyHint strategy={introStrategy} variant="intro" />}
              <div className="session-intro-explanation">{t.littleTrick}</div>
              <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
                {t.gotIt}
              </button>
            </>
          )}
        </div>
      )}

      {/* Introduction — niveau 3 (« cherche le multiple juste en dessous »).
          Modèle quotitif : rangées de `divisor` points (les fois), plus la
          rangée incomplète du reste (specs §12.4). */}
      {showIntro && currentItem.kind === 'rem' && v && (
        <div className="session-intro">
          <div className="session-intro-title">{t.new}</div>
          <div className="session-intro-formula">
            {v.left}
            <span className="session-intro-operator">{v.op}</span>
            {v.right}
          </div>
          <DotGrid
            a={currentItem.fact.quotient}
            b={currentItem.fact.divisor}
            remainderDots={currentItem.remainder}
            animated
            size="normal"
            bare
          />
          <div className="session-intro-explanation">
            {t.remIntro(remainderDividend(currentItem), currentItem.fact.divisor)}
          </div>
          {remIntroStrategy && <RemainderStrategyHint strategy={remIntroStrategy} variant="intro" />}
          <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
            {t.gotIt}
          </button>
        </div>
      )}

      {/* Introduction — division (« pense à la multiplication ») */}
      {showIntro && currentItem.kind === 'div' && v && (
        <div className="session-intro">
          <div className="session-intro-title">{t.new}</div>
          <div className="session-intro-formula">
            {v.left}
            <span className="session-intro-operator">{v.op}</span>
            {v.right}
          </div>
          <DotGrid a={currentItem.fact.divisor} b={currentItem.fact.quotient} animated size="normal" bare groupReveal />
          <div className="session-intro-explanation">
            {t.shareInto(currentItem.fact.dividend, currentItem.fact.divisor)}
          </div>
          {divIntroStrategy && <DivisionStrategyHint strategy={divIntroStrategy} variant="intro" />}
          <button className="btn btn--ink session-intro-btn" onClick={handleIntroNext}>
            {t.gotIt}
          </button>
        </div>
      )}

      {/* Introduction — conjugaison, 5 étapes (spec Verbito §5.2). Les trois
          premières vivent ici ; la 4ᵉ est la question elle-même, la 5ᵉ est le
          re-test différé posé par `scheduleRetry`. */}
      {showIntro && cv && (
        <div className="session-intro conj-intro">
          <div className="session-intro-title">{tc.new}</div>

          {conjIntroStep === 'sentence' ? (
            <>
              {/* 1. La phrase en contexte, lue à voix haute, forme visible. */}
              <div className="conj-intro-sentence">
                <ConjForm
                  before={cv.carrier.before}
                  subject={cv.subject}
                  segment={cv.segment}
                  after={cv.tail}
                />
              </div>
              <div className="conj-intro-infinitive">{tc.infinitive(cv.verb)}</div>
              <button className="btn btn--ink session-intro-btn" onClick={handleConjIntroNext}>
                {tc.next}
              </button>
            </>
          ) : conjIntroStep === 'mechanics' ? (
            <>
              {/* 2. La mécanique en couleurs : le pronom, puis sa marque. */}
              <div className="session-intro-explanation">{tc.mechanicsTitle}</div>
              <div className="conj-intro-sentence">
                <ConjForm
                  subject={cv.subject}
                  segment={cv.segment}
                  lit={conjMarkLit ? 'both' : 'subject'}
                />
              </div>
              {conjIntroStrategy && (
                <StrategyHintShell
                  title={conjIntroStrategy.title}
                  lines={conjIntroStrategy.lines.map(renderConjHintLine)}
                  variant="intro"
                />
              )}
              <button className="btn btn--ink session-intro-btn" onClick={handleConjIntroNext}>
                {tc.next}
              </button>
            </>
          ) : (
            <>
              {/* 3. Copie différée : le modèle 4 s, puis l'enfant écrit. */}
              <div className="session-intro-explanation" aria-live="polite">
                {conjCopyVisible
                  ? conjCopyAttempts.current > 0
                    ? tc.copyAgain
                    : tc.copyLook
                  : tc.copyWrite}
              </div>
              <div className={`conj-copy-model${conjCopyVisible ? '' : ' is-hidden'}`}>
                <ConjForm subject={cv.subject} segment={cv.segment} />
              </div>
              {!conjCopyVisible && (
                <div className="conj-keyboard-area">
                  {/* La copie différée s'épelle aussi bien qu'elle s'écrit : en
                      mode vocal, l'enfant n'a jamais besoin du clavier. */}
                  {renderConjInput(
                    cv,
                    `copy-${currentIndex}-${conjCopyAttempts.current}`,
                    handleConjCopy,
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Question — conjugaison (spec §4.1, §4.2) : la phrase porteuse, le
          radical affiché quand il est régulier, et la seule terminaison à
          taper. Aucune auto-validation : la longueur n'est pas prévisible. */}
      {!showIntro && cv && (
        <div className="session-question conj-question">
          <div className="conj-sentence">
            <ConjForm
              before={cv.carrier.before}
              subject={cv.subject}
              segment={[cv.displayedStem, '']}
            />
            <span className="conj-blank" aria-hidden="true" />
            <span className="conj-sentence-tail">{cv.tail}</span>
          </div>
          <div className="conj-question-meta">
            <span className="conj-intro-infinitive">{tc.infinitive(cv.verb)}</span>
            <button
              type="button"
              className="conj-replay-btn"
              onClick={() => speak(cv.promptTtsKey)}
              aria-label={tc.replay}
            >
              {'🔊'} {tc.replay}
            </button>
          </div>
          <div className="conj-keyboard-area">
            {renderConjInput(cv, `answer-${currentIndex}`, handleConjSubmit)}
          </div>
        </div>
      )}

      {/* Question. Niveau 3 : saisie en deux temps sur le même écran — le
          quotient validé s'installe dans la formule et le « reste ? » prend le
          relais (specs §12.5). Le NumPad est re-keyé par étape (reset de la
          saisie) et VoiceInput re-tokené (reset de l'écoute). */}
      {!showIntro && mathItem && v && (
        <div className="session-question">
          <div className="formula-text session-question-text">
            {v.left}
            <span className="formula-operator">{v.op}</span>
            {v.right}
            <span className="formula-equals">=</span>
            {currentItem.kind === 'rem' && remQuotient !== null ? (
              <>
                {remQuotient}
                <span className="formula-remainder">{t.remainderWord}</span>
                <span className="formula-placeholder">?</span>
              </>
            ) : (
              <span className="formula-placeholder">?</span>
            )}
          </div>
          {currentItem.kind === 'rem' && (
            <div className="session-rem-step" aria-live="polite">
              {remQuotient === null ? t.howManyTimes : t.whatRemains}
            </div>
          )}
          <div className="session-numpad-area">
            {inputMode === 'voice' ? (
              <VoiceInput
                onSubmit={handleAnswer}
                disabled={numpadDisabled}
                isSpeaking={isSpeaking}
                questionToken={`${v.token}-${currentIndex}${remQuotient !== null ? '-rest' : ''}`}
                expectedValue={
                  currentItem.kind === 'rem' && remQuotient !== null
                    ? currentItem.remainder
                    : v.answer
                }
              />
            ) : (
              <>
                <NumPad
                  key={remQuotient === null ? 'main' : 'rest'}
                  onSubmit={handleAnswer}
                  disabled={numpadDisabled}
                />
                {STT_SUPPORTED && (
                  <button
                    type="button"
                    className="session-input-switch"
                    onClick={switchToVoice}
                    disabled={numpadDisabled}
                  >
                    {'🎤'} {t.useMic}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Feedback — un seul composant, qui rend × ou ÷ selon l'item */}
      {feedback && (
        <FeedbackOverlay
          item={feedback.item}
          correct={feedback.correct}
          fast={feedback.fast}
          submittedValue={feedback.submittedValue}
          submittedRemainder={feedback.submittedRemainder}
          onDismiss={handleFeedbackDismiss}
        />
      )}

      {/* Feedback — conjugaison, quatre cas (spec §5.3) */}
      {conjFeedback && (
        <ConjFeedbackOverlay
          view={conjFeedback.view}
          verdict={conjFeedback.judgement.verdict}
          fast={conjFeedback.fast}
          typed={conjFeedback.typed}
          box={conjFeedback.box}
          onDismiss={handleConjFeedbackDismiss}
        />
      )}
    </div>
  );
}
