import { useState, useRef, useCallback, useEffect } from 'react';
import type { SessionItem, SessionResult } from '../types';
import NumPad from '../components/NumPad';
import VoiceInput from '../components/VoiceInput';
import DotGrid from '../components/DotGrid';
import FeedbackOverlay from '../components/FeedbackOverlay';
import StrategyHint from '../components/StrategyHint';
import DivisionStrategyHint from '../components/DivisionStrategyHint';
import RemainderStrategyHint from '../components/RemainderStrategyHint';
import {
  FAST_THRESHOLD_MS,
  DIVISION_FAST_THRESHOLD_MS,
  REMAINDER_FAST_THRESHOLD_MS,
  remainderDividend,
} from '../types';
import { getStrategy, hasStrategy } from '../lib/strategies';
import { getDivisionStrategy } from '../lib/divisionStrategies';
import { getRemainderStrategy } from '../lib/remainderStrategies';
import { getDivisionFactKey } from '../lib/divisionFacts';
import { getRemainderFactKey } from '../lib/remainderFacts';
import { getFactKey } from '../lib/facts';
import { itemDisplay } from '../lib/sessionItemView';
import { todayISO } from '../lib/utils';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useInputMode } from '../hooks/useInputMode';
import { isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { preflightMicPermission } from '../lib/micPreflight';
import { useWakeLock } from '../hooks/useWakeLock';
import { useSessionStrings } from '../i18n/session';

// Borne dure sur la longueur d'une session : la composition vise 12-15
// questions, chaque erreur peut insérer une retry. Sans cap, des erreurs en
// chaîne (surtout en vocal) rendent la session interminable.
const MAX_SESSION_LENGTH = 20;
const STT_SUPPORTED = isSpeechRecognitionSupported();

// Écran de séance UNIFIÉ (specs §11.6). Une séance est une liste de SessionItem
// qui peut être 100% multiplication (avant déblocage de la division) ou mixte
// (division + entretien des tables, après déblocage). Chaque question est
// rendue selon son `kind`.
type IntroStep = 'grid' | 'commute' | 'strategy';

interface SessionScreenProps {
  questions: SessionItem[];
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

function itemKey(item: SessionItem): string {
  if (item.kind === 'rem') return getRemainderFactKey(item.fact.divisor, item.fact.quotient);
  if (item.kind === 'div') return getDivisionFactKey(item.fact.dividend, item.fact.divisor);
  return getFactKey(item.fact.a, item.fact.b);
}

// Clé TTS de l'écran d'intro d'un item (pré-générée par scripts/generate-tts.mjs).
function introKey(item: SessionItem): string {
  if (item.kind === 'rem') return `intror-${item.fact.divisor}-${item.fact.quotient}`;
  if (item.kind === 'div') return `introd-${item.fact.dividend}-${item.fact.divisor}`;
  return `intro-${item.fact.a}-${item.fact.b}`;
}

export default function SessionScreen({
  questions: initialQuestions,
  onComplete,
  onAnswer,
}: SessionScreenProps) {
  const [questions, setQuestions] = useState<SessionItem[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState<IntroStep>('grid');
  const [feedback, setFeedback] = useState<{
    item: SessionItem;
    correct: boolean;
    fast: boolean;
    submittedValue: number;
    // Niveau 3 : reste saisi (null = la question s'est arrêtée au quotient).
    submittedRemainder?: number | null;
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

  const questionStartTime = useRef(0);
  const correctCount = useRef(0);
  const totalTimeMs = useRef(0);
  const introducedFacts = useRef(new Set<string>());

  const currentItem = questions[currentIndex] as SessionItem | undefined;

  const speakQuestion = useCallback((item: SessionItem) => speak(view(item).qKey), [speak]);

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
      keys.add(view(item).qKey);
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
    } else {
      setShowIntro(false);
    }
    setNumpadDisabled(false);
    setRemQuotient(null);
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

      // Réintroduction après erreur (capée — cf. MAX_SESSION_LENGTH).
      if (!correct && questions.length < MAX_SESSION_LENGTH) {
        const retryPosition = Math.min(currentIndex + 3, questions.length);
        const retryItem = { ...currentItem, isRetry: true, isIntroduction: false } as SessionItem;
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(retryPosition, 0, retryItem);
          return next;
        });
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
    [currentItem, currentIndex, questions.length, remQuotient, onAnswer, playCorrect, playIncorrect, stopSpeech, speak, inputMode],
  );

  const handleFeedbackDismiss = useCallback(() => {
    setFeedback(null);
    moveToNext();
  }, [moveToNext]);

  const handleIntroNext = useCallback(() => {
    if (!currentItem) return;

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

  const v = view(currentItem);
  const introStrategy =
    showIntro && currentItem.kind === 'mult' && introStep === 'strategy'
      ? getStrategy(currentItem.fact.a, currentItem.fact.b)
      : null;
  const divIntroStrategy =
    showIntro && currentItem.kind === 'div' ? getDivisionStrategy(currentItem.fact) : null;
  const remIntroStrategy =
    showIntro && currentItem.kind === 'rem' ? getRemainderStrategy(currentItem) : null;

  const maxDots = Math.min(questions.length, MAX_SESSION_LENGTH);
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
      {showIntro && currentItem.kind === 'rem' && (
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
      {showIntro && currentItem.kind === 'div' && (
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

      {/* Question. Niveau 3 : saisie en deux temps sur le même écran — le
          quotient validé s'installe dans la formule et le « reste ? » prend le
          relais (specs §12.5). Le NumPad est re-keyé par étape (reset de la
          saisie) et VoiceInput re-tokené (reset de l'écoute). */}
      {!showIntro && (
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
    </div>
  );
}
