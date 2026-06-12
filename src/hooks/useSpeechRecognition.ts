import { useCallback, useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  useEffect(() => {
    onInterimRef.current = onInterim;
  }, [onInterim]);

  const isSupported = typeof window !== 'undefined' && isSpeechRecognitionSupported();

  const ensureRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) return recognitionRef.current;
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
          onFinalRef.current(primary, alternatives);
        } else if (onInterimRef.current) {
          onInterimRef.current(primary);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech", "aborted", "audio-capture", "not-allowed", "network", ...
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // benign — we'll auto-restart via onend if wantListening
        return;
      }
      setError(event.error);
      wantListeningRef.current = false;
    };

    rec.onend = () => {
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

      if (emptyRestartCountRef.current >= MAX_RAPID_RESTARTS) {
        wantListeningRef.current = false;
        emptyRestartCountRef.current = 0;
        return;
      }

      const restart = () => {
        if (!wantListeningRef.current) return;
        lastStartAtRef.current = Date.now();
        try {
          rec.start();
        } catch {
          // start() throws if already started — ignore
        }
      };

      if (emptyRestartCountRef.current > 0) {
        // Cycle à vide détecté : on laisse respirer le navigateur avant de
        // retenter, pour ne pas re-saturer la boucle d'événements.
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          restart();
        }, RESTART_BACKOFF_MS);
      } else {
        // Chemin nominal : redémarrage immédiat pour ne pas manquer une
        // réponse enchaînée rapidement entre deux questions.
        restart();
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    const rec = ensureRecognition();
    if (!rec) {
      setError('not-supported');
      return;
    }
    wantListeningRef.current = true;
    // Démarrage explicite (geste utilisateur / nouvelle séance) : on repart
    // d'un compteur vierge pour le garde-fou anti-boucle.
    emptyRestartCountRef.current = 0;
    lastStartAtRef.current = Date.now();
    setError(null);
    try {
      rec.start();
    } catch {
      // Already started — ignore
    }
  }, [ensureRecognition]);

  const abort = useCallback(() => {
    wantListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.abort();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { start, abort, isListening, error, isSupported };
}
