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

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  useEffect(() => {
    onInterimRef.current = onInterim;
  }, [onInterim]);

  const isSupported = typeof window !== 'undefined' && isSpeechRecognitionSupported();

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
      if (wantListeningRef.current) {
        try {
          rec.start();
        } catch {
          // start() throws if already started — ignore
        }
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
    setError(null);
    try {
      rec.start();
    } catch {
      // Already started — ignore
    }
  }, [ensureRecognition]);

  const abort = useCallback(() => {
    wantListeningRef.current = false;
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
