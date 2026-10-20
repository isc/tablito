import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceLog } from '../lib/voiceDebug';

// Minimal typings for the Web Speech API (not in lib.dom.d.ts).
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionResultItem;
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

interface UseSpeechRecognitionOptions {
  // Called every time a final transcript is available.
  onFinal: (transcript: string, alternatives: string[]) => void;
  // Called with interim (non-final) transcripts, useful for live display.
  onInterim?: (transcript: string) => void;
  // BCP-47 language tag.
  lang?: string;
}

interface UseSpeechRecognitionResult {
  start: () => void;
  // Immediately kill audio capture + any pending results. We use abort
  // (not the native stop) because Chrome's stop() keeps emitting
  // interims/finals for ~1s from already-buffered audio.
  abort: () => void;
  isListening: boolean;
  error: SpeechRecognitionError | null;
  isSupported: boolean;
}

export type SpeechRecognitionError =
  | 'not-allowed'
  | 'service-not-allowed'
  | 'network'
  | 'audio-capture'
  | 'language-not-supported'
  | 'not-supported'
  | 'bad-grammar'
  | (string & {});

// Garde-fou iOS : au tout premier octroi de permission, WebKit termine parfois
// la reconnaissance immédiatement (onend) sans jamais émettre onstart ni
// résultat. Comme on redémarre dans onend pour garder le micro ouvert toute la
// séance, on obtenait une boucle start→end→start→end qui saturait la boucle
// d'événements et figeait toute l'UI (l'utilisateur devait force-quitter).
// On considère qu'un cycle ayant duré moins que ce seuil est « à vide ».
const RAPID_RESTART_THRESHOLD_MS = 500;
// Au-delà de ce nombre de cycles à vide consécutifs, on arrête de retenter :
// la prochaine séance repartira proprement, permission déjà accordée.
const MAX_RAPID_RESTARTS = 5;
// Délai laissé au navigateur entre deux tentatives quand un cycle à vide est
// détecté, pour ne pas re-saturer la boucle d'événements.
const RESTART_BACKOFF_MS = 400;
// Sur Android, un abort() envoyé entre start() et onstart se perd : le
// recognizer reste « démarré » sans plus jamais émettre onstart ni onend, et
// chaque start() suivant lève InvalidStateError — le micro n'écoute plus
// jusqu'à ce qu'on passe au clavier et revienne (journal vocal du 20/10/2026 :
// les deux blocages suivent un abort arrivé 15 ms après le redémarrage, avant
// onstart). Un abort demandé pendant le démarrage attend donc onstart. Filet
// de sécurité : un navigateur qui se croit déjà démarré, ou qui ne confirme
// jamais le démarrage, est remis à zéro puis relancé, quelques fois.
const STUCK_RETRY_MS = 1000;
const MAX_STUCK_RETRIES = 3;
const START_TIMEOUT_MS = 4000;

export function useSpeechRecognition({
  onFinal,
  onInterim,
  lang = 'fr-FR',
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<SpeechRecognitionError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  // Horodatage du dernier start() effectif + compteur de cycles « à vide »
  // consécutifs + timer de backoff : voir le garde-fou iOS dans onend.
  const lastStartAtRef = useRef(0);
  const emptyRestartCountRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Où en est la session du navigateur. « starting-then-abort » : un abort
  // demandé pendant le démarrage, rejoué dans onstart.
  const phaseRef = useRef<'idle' | 'starting' | 'starting-then-abort' | 'listening'>('idle');
  const stuckRetriesRef = useRef(0);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  useEffect(() => {
    onInterimRef.current = onInterim;
  }, [onInterim]);

  const isSupported = typeof window !== 'undefined' && isSpeechRecognitionSupported();

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /** Lance une session, maintenant ou après `delayMs` ; voir STUCK_RETRY_MS. */
  const launch = useCallback(
    (rec: SpeechRecognitionLike, delayMs = 0) => {
      function later(ms: number) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (wantListeningRef.current && phaseRef.current === 'idle') now();
        }, ms);
      }
      function unstick(why: string) {
        voiceLog('reco:stuck', why);
        phaseRef.current = 'idle';
        try {
          rec.abort();
        } catch {
          // ignore
        }
        if (stuckRetriesRef.current >= MAX_STUCK_RETRIES) return;
        stuckRetriesRef.current += 1;
        later(STUCK_RETRY_MS);
      }
      function now() {
        lastStartAtRef.current = Date.now();
        // Avant start() : certains navigateurs émettent onstart dedans.
        const before = phaseRef.current;
        phaseRef.current = 'starting';
        try {
          rec.start();
        } catch (e) {
          phaseRef.current = before;
          // Session vivante (ou abort en vol) : start() lève, c'est attendu,
          // onend relancera. Au repos, le navigateur est désynchronisé.
          if (before === 'idle') unstick(String(e));
          else voiceLog('reco:start-threw', String(e));
          return;
        }
        if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = setTimeout(() => {
          startTimeoutRef.current = null;
          if (phaseRef.current === 'starting' || phaseRef.current === 'starting-then-abort') unstick('no onstart');
        }, START_TIMEOUT_MS);
      }
      if (delayMs > 0) later(delayMs);
      else {
        clearRestartTimer();
        now();
      }
    },
    [clearRestartTimer],
  );

  const ensureRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) {
      // Garde la langue à jour si elle a changé depuis la création : le tag est
      // lu au prochain start(). Sans ça, l'instance mise en cache resterait
      // figée sur la langue initiale.
      recognitionRef.current.lang = lang;
      return recognitionRef.current;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    // continuous:true was tested and felt worse in practice: Chrome still
    // emits no-speech timeouts and seems to miss utterances while in that
    // mode. Keep the short-session mode and rely on auto-restart.
    rec.continuous = false;
    rec.maxAlternatives = 5;

    rec.onstart = () => {
      voiceLog('reco:onstart');
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      stuckRetriesRef.current = 0;
      const abortNow = phaseRef.current === 'starting-then-abort';
      phaseRef.current = 'listening';
      if (abortNow) {
        voiceLog('reco:abort-on-start');
        rec.abort();
        return;
      }
      setIsListening(true);
      setError(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const primary = result[0]?.transcript ?? '';
        if (result.isFinal) {
          const alternatives: string[] = [];
          for (let j = 0; j < result.length; j++) {
            const alt = (result as unknown as Record<number, SpeechRecognitionResultItem>)[j];
            if (alt?.transcript) alternatives.push(alt.transcript);
          }
          voiceLog('reco:final', JSON.stringify(alternatives));
          onFinalRef.current(primary, alternatives);
        } else if (onInterimRef.current) {
          voiceLog('reco:interim', JSON.stringify(primary));
          onInterimRef.current(primary);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      voiceLog('reco:error', event.error);
      // "no-speech", "aborted", "audio-capture", "not-allowed", "network", ...
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // benign — we'll auto-restart via onend if wantListening
        return;
      }
      setError(event.error);
      wantListeningRef.current = false;
    };

    rec.onend = () => {
      phaseRef.current = 'idle';
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      setIsListening(false);
      if (!wantListeningRef.current) return;

      // Un cycle anormalement court (terminé presque aussitôt démarré, sans
      // résultat) trahit le glitch iOS du premier octroi de permission. On
      // les compte ; au-delà d'un seuil on coupe la boucle plutôt que de
      // figer le thread principal.
      const ranForMs = Date.now() - lastStartAtRef.current;
      if (ranForMs < RAPID_RESTART_THRESHOLD_MS) {
        emptyRestartCountRef.current += 1;
      } else {
        emptyRestartCountRef.current = 0;
      }
      voiceLog('reco:onend', `ranFor=${ranForMs}ms empty=${emptyRestartCountRef.current}`);

      if (emptyRestartCountRef.current >= MAX_RAPID_RESTARTS) {
        voiceLog('reco:giveup');
        wantListeningRef.current = false;
        emptyRestartCountRef.current = 0;
        return;
      }

      // Cycle à vide : on laisse respirer le navigateur avant de retenter,
      // pour ne pas re-saturer la boucle d'événements. Sinon, redémarrage
      // immédiat pour ne pas manquer une réponse enchaînée entre deux questions.
      launch(rec, emptyRestartCountRef.current > 0 ? RESTART_BACKOFF_MS : 0);
    };

    recognitionRef.current = rec;
    return rec;
  }, [lang, launch]);

  const start = useCallback(() => {
    const rec = ensureRecognition();
    if (!rec) {
      setError('not-supported');
      return;
    }
    voiceLog('reco:start');
    wantListeningRef.current = true;
    // Démarrage explicite (geste utilisateur / nouvelle séance) : on repart
    // d'un compteur vierge pour le garde-fou anti-boucle.
    emptyRestartCountRef.current = 0;
    setError(null);
    // Démarrage déjà en route : il suffit d'annuler l'abort qui l'attendait.
    if (phaseRef.current === 'starting-then-abort') phaseRef.current = 'starting';
    if (phaseRef.current === 'starting') return;
    stuckRetriesRef.current = 0;
    launch(rec);
  }, [ensureRecognition, launch]);

  const abort = useCallback(() => {
    voiceLog('reco:abort');
    wantListeningRef.current = false;
    clearRestartTimer();
    const rec = recognitionRef.current;
    if (!rec) return;
    if (phaseRef.current === 'starting' || phaseRef.current === 'starting-then-abort') {
      // Perdu par Android avant onstart : rejoué dans onstart.
      phaseRef.current = 'starting-then-abort';
      return;
    }
    try {
      rec.abort();
    } catch {
      // ignore
    }
  }, [clearRestartTimer]);

  useEffect(() => abort, [abort]);

  return { start, abort, isListening, error, isSupported };
}
