import { useState, useRef, useCallback, useEffect } from 'react';
import type QrScanner from 'qr-scanner';
import type { UserProfile } from '../types';
import Mascot from '../components/Mascot';
import NumPad from '../components/NumPad';
import {
  PLACEMENT_FACTS,
  MAX_CONSECUTIVE_FAILURES,
  type PlacementResult,
} from '../lib/placement';
import { useTTS } from '../hooks/useTTS';
import { useWelcomeStrings } from '../i18n/onboarding';

export type { PlacementResult };

// États du scan de QR de transfert (caméra in-app). 'on' filme, 'fetching'
// récupère/déchiffre après détection, les erreurs ramènent aux options.
type ScanState = 'off' | 'on' | 'fetching' | 'cameraError' | 'transferError';

interface WelcomeScreenProps {
  onComplete: (name: string, placementResults: PlacementResult[]) => void;
  // Restaure une progression (changement d'appareil, migration). Renvoie false
  // si le JSON collé est invalide, pour afficher une erreur. En cas de succès,
  // App navigue vers l'écran adapté au profil (ce composant est alors démonté).
  onImport: (json: string) => boolean;
  // Un transfert scanné (QR de l'ancien appareil) a installé ce profil : App
  // navigue vers son écran d'arrivée, ce composant est démonté.
  onTransferImported: (profile: UserProfile) => void;
  // Présent uniquement en mode « ajouter un enfant » (il existe déjà au moins
  // un profil) : permet de revenir en arrière sans créer de profil. Absent au
  // tout premier onboarding.
  onCancel?: () => void;
}

export default function WelcomeScreen({
  onComplete,
  onImport,
  onTransferImported,
  onCancel,
}: WelcomeScreenProps) {
  const t = useWelcomeStrings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(false);
  // Repli manuel : la zone de collage n'apparaît que si la lecture du
  // presse-papiers échoue (refus, navigateur non supporté) ou sur demande.
  const [manualPaste, setManualPaste] = useState(false);
  const [scan, setScan] = useState<ScanState>('off');
  const scanVideoRef = useRef<HTMLVideoElement>(null);

  // Scan du QR de transfert affiché par l'ancien appareil. La caméra tourne
  // tant que `scan === 'on'` ; qr-scanner (vendoré) est chargé à la demande.
  // On ignore les QR étrangers (l'utilisateur vise peut-être encore à côté)
  // et on ne consomme le code — lecture unique côté serveur — qu'une fois le
  // scanner arrêté.
  useEffect(() => {
    if (scan !== 'on') return;
    let scanner: QrScanner | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: QrScanner }, transfer] = await Promise.all([
          import('qr-scanner'),
          import('../lib/transfer'),
        ]);
        if (cancelled || !scanVideoRef.current) return;
        const qr = new QrScanner(
          scanVideoRef.current,
          async ({ data }) => {
            if (!transfer.parseTransferLink(data)) return;
            qr.stop();
            setScan('fetching');
            const profile = await transfer.importTransferFromLink(data);
            if (profile) onTransferImported(profile);
            else setScan('transferError');
          },
          { returnDetailedScanResult: true },
        );
        scanner = qr;
        await qr.start();
      } catch {
        // Caméra absente, refusée, ou lib introuvable → repli sur le collage.
        if (!cancelled) setScan('cameraError');
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy(); // destroy() arrête aussi la caméra
    };
  }, [scan, onTransferImported]);

  const { speak, stop: stopSpeech } = useTTS();

  const [testIndex, setTestIndex] = useState(0);
  const [testResults, setTestResults] = useState<PlacementResult[]>([]);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);
  const questionStartTime = useRef(0);

  // TTS for the welcome steps
  useEffect(() => {
    if (step === 0) {
      speak('welcome-hello');
    } else if (step === 1) {
      speak('welcome-name');
    } else if (step === 2) {
      speak('welcome-test');
    }
  }, [step, speak]);

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1 && name.trim()) {
      setStep(2);
    } else if (step === 2) {
      // Start placement test
      setStep(3);
      questionStartTime.current = Date.now();
    }
  };

  const handleSkipTest = () => {
    onComplete(name.trim(), []);
  };

  // Restaure une progression existante (collée depuis un autre appareil / la
  // page de migration de l'ancien domaine). En cas de succès, onImport déclenche
  // la navigation côté App et ce composant est démonté ; sinon on affiche l'erreur.
  const handleImportConfirm = () => {
    if (onImport(importText.trim())) return;
    setImportError(true);
  };

  // Lit directement le presse-papiers (iOS affiche un prompt « Coller »). Si le
  // contenu est valide, onImport navigue ailleurs ; sinon on le verse dans la
  // zone de texte + erreur. Lecture refusée/non supportée → collage manuel.
  const handlePasteFromClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) { setManualPaste(true); return; } // presse-papiers vide → collage manuel
      if (!onImport(text)) {
        setImportText(text);
        setImportError(true);
        setManualPaste(true);
      }
    } catch {
      // Lecture refusée / non supportée → on révèle la zone de collage manuel.
      setManualPaste(true);
    }
  };

  const recordTestResult = useCallback(
    (correct: boolean) => {
      if (numpadDisabled) return;
      setNumpadDisabled(true);
      stopSpeech();

      const fact = PLACEMENT_FACTS[testIndex];
      const [a, b] = fact;
      const timeMs = Date.now() - questionStartTime.current;

      const result: PlacementResult = {
        a: Math.min(a, b),
        b: Math.max(a, b),
        correct,
        timeMs,
      };

      const updatedResults = [...testResults, result];
      setTestResults(updatedResults);

      const updatedFailures = correct ? 0 : consecutiveFailures + 1;
      setConsecutiveFailures(updatedFailures);

      // Brief feedback
      setFeedback(correct ? 'correct' : 'incorrect');

      setTimeout(() => {
        setFeedback(null);
        setNumpadDisabled(false);
        setLastAnswer(null);

        const isLastQuestion = testIndex + 1 >= PLACEMENT_FACTS.length;
        const hitFailureCap = updatedFailures >= MAX_CONSECUTIVE_FAILURES;
        if (isLastQuestion || hitFailureCap) {
          onComplete(name.trim(), updatedResults);
        } else {
          setTestIndex(testIndex + 1);
          questionStartTime.current = Date.now();
        }
      }, correct ? 600 : 1200);
    },
    [numpadDisabled, testIndex, testResults, consecutiveFailures, name, onComplete, stopSpeech],
  );

  const handleTestAnswer = useCallback(
    (value: number) => {
      const [a, b] = PLACEMENT_FACTS[testIndex];
      setLastAnswer(value);
      recordTestResult(value === a * b);
    },
    [testIndex, recordTestResult],
  );

  const handleDontKnow = useCallback(() => {
    recordTestResult(false);
  }, [recordTestResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleNext();
    }
  };

  // Pre-compute display orders once per test (stable across re-renders)
  const [displayOrders] = useState(
    () => PLACEMENT_FACTS.map(([a, b]) => (Math.random() > 0.5 ? [a, b] : [b, a])),
  );

  useEffect(() => {
    if (step !== 3) return;
    const [displayA, displayB] = displayOrders[testIndex];
    const questionKey = `q-${displayA}-${displayB}`;
    if (testIndex === 0) {
      speak('placement-intro', () => speak(questionKey));
    } else {
      speak(questionKey);
    }
  }, [step, testIndex, displayOrders, speak]);

  // Placement test screen
  if (step === 3) {
    const fact = PLACEMENT_FACTS[testIndex];
    const [a, b] = fact;
    const [displayA, displayB] = displayOrders[testIndex];

    const progressDots = Array.from({ length: PLACEMENT_FACTS.length }, (_, i) => {
      if (i < testIndex) return 'done';
      if (i === testIndex) return 'current';
      return 'pending';
    });

    return (
      <div className="welcome-screen">
        <div className="welcome-step" key="test">
          <div className="welcome-test-progress">
            {progressDots.map((status, i) => (
              <div key={i} className={`welcome-test-progress-dot ${status}`} />
            ))}
          </div>
          <div className="formula-text welcome-test-question">
            {displayA}
            <span className="formula-operator">{'\u00D7'}</span>
            {displayB}
            <span className="formula-equals">=</span>
            {lastAnswer != null ? (
              <span className="welcome-test-answer">{lastAnswer}</span>
            ) : (
              <span className="formula-placeholder">?</span>
            )}
          </div>
          {feedback && (
            <div className={`welcome-test-feedback ${feedback}`}>
              {feedback === 'correct' ? '✓' : `${a * b}`}
            </div>
          )}
          {!feedback && (
            <>
              <NumPad onSubmit={handleTestAnswer} disabled={numpadDisabled} />
              <button
                className="welcome-dontknow"
                onClick={handleDontKnow}
                disabled={numpadDisabled}
              >
                <span className="welcome-dontknow-mark">?</span>
                <span>{t.dontKnow}</span>
              </button>
              <div className="welcome-test-hint">
                {t.testHint}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      {step === 0 && !showImport && (
        <div className="welcome-step" key="step0">
          <Mascot mood="idle" />
          <div className="welcome-title">{t.helloTitle}</div>
          <div className="welcome-subtitle">
            {t.helloSubtitlePart1}
            <br />
            {t.helloSubtitlePart2}
          </div>
          <button className="btn btn--ink welcome-btn" onClick={handleNext}>
            {t.next}
          </button>
          <button
            className="welcome-import-link"
            onClick={() => setShowImport(true)}
          >
            {t.alreadyHaveProgress}
          </button>
          {onCancel && (
            <button className="welcome-btn-skip" onClick={onCancel}>
              {t.cancel}
            </button>
          )}
        </div>
      )}

      {step === 0 && showImport && (
        <div className="welcome-step" key="import">
          <div className="welcome-title">{t.importTitle}</div>
          <div className="welcome-subtitle">
            {t.importSubtitle}
          </div>
          {scan === 'on' || scan === 'fetching' ? (
            <>
              <video ref={scanVideoRef} className="welcome-scan-video" />
              <div className="welcome-scan-status">
                {scan === 'fetching' ? t.transferFetching : t.scanPrompt}
              </div>
              <button className="welcome-btn-skip" onClick={() => setScan('off')}>
                {t.cancel}
              </button>
            </>
          ) : (
            <>
              {scan === 'cameraError' && (
                <div className="welcome-import-error">{t.scanCameraError}</div>
              )}
              {scan === 'transferError' && (
                <div className="welcome-import-error">{t.scanTransferError}</div>
              )}
              <button className="btn btn--ink welcome-btn" onClick={() => setScan('on')}>
                {t.scanQr}
              </button>
              {!manualPaste ? (
                <>
                  <button
                    className="welcome-import-link"
                    onClick={handlePasteFromClipboard}
                  >
                    {t.pasteFromClipboard}
                  </button>
                  <button
                    className="welcome-import-link"
                    onClick={() => setManualPaste(true)}
                  >
                    {t.pasteManually}
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    className="welcome-import-textarea"
                    placeholder={t.importPlaceholder}
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.currentTarget.value);
                      setImportError(false);
                    }}
                    autoFocus
                  />
                  {importError && (
                    <div className="welcome-import-error">
                      {t.importNotRecognized}
                    </div>
                  )}
                  <button
                    className="btn btn--ink welcome-btn"
                    onClick={handleImportConfirm}
                    disabled={!importText.trim()}
                  >
                    {t.importConfirm}
                  </button>
                </>
              )}
              <button
                className="welcome-btn-skip"
                onClick={() => {
                  setShowImport(false);
                  setManualPaste(false);
                  setImportError(false);
                  setImportText('');
                  setScan('off');
                }}
              >
                {t.cancel}
              </button>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="welcome-step welcome-step-name" key="step1">
          <Mascot mood="happy" />
          <div className="welcome-title">{t.nameTitle}</div>
          <input
            className="welcome-input"
            type="text"
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={20}
          />
          <button
            className="btn btn--ink welcome-btn"
            onClick={handleNext}
            disabled={!name.trim()}
          >
            {t.itsMe}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="welcome-step" key="step2">
          <Mascot mood="celebrate" />
          <div className="welcome-title">
            {t.greeting(name)}
          </div>
          <div className="welcome-subtitle">
            {t.testIntroPart1}
            <br />
            <br />
            {t.testIntroPart2}
          </div>
          <button className="btn btn--ink welcome-btn" onClick={handleNext}>
            {t.letsGo}
          </button>
          <button className="welcome-btn-skip" onClick={handleSkipTest}>
            {t.skipTest}
          </button>
        </div>
      )}

      {/* Step indicator dots */}
      <div className="welcome-dots">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`welcome-dot ${s === step ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
