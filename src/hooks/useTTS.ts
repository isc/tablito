import { useCallback, useRef, useEffect, useState } from 'react';
import { getAudioContext } from '../lib/audioContext';

const BASE = import.meta.env.BASE_URL;

// Cache des buffers décodés au niveau module : on ne re-fetch + re-décode
// pas le même MP3 deux fois pendant une session, et on évite la latence
// (~50-200 ms) à partir de la 2ᵉ lecture.
const bufferCache = new Map<string, AudioBuffer>();
const inflightLoads = new Map<string, Promise<AudioBuffer | null>>();

async function loadBuffer(key: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const inflight = inflightLoads.get(key);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const res = await fetch(`${BASE}audio/tts/${key}.mp3`);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      bufferCache.set(key, audioBuf);
      return audioBuf;
    } catch {
      return null;
    } finally {
      inflightLoads.delete(key);
    }
  })();
  inflightLoads.set(key, promise);
  return promise;
}

interface ActiveSource {
  source: AudioBufferSourceNode;
  // Quand stop() ou un autre speak() interrompt cette source, on met
  // stopped=true pour ne pas appeler le callback onEnd qu'on lance via
  // l'événement `ended` (qui se déclenche aussi en cas d'arrêt manuel).
  stopped: boolean;
}

// Lecture des MP3 TTS via Web Audio (decodeAudioData + BufferSource).
// Pourquoi pas un simple `<audio>` HTMLMediaElement ? Parce qu'iOS active
// alors automatiquement le widget « Now Playing » sur l'écran verrouillé
// et passe via le canal média qui ignore le mute switch — deux comportements
// indésirables ici. Web Audio joue via le canal système, sans MediaSession,
// et respecte le silent switch comme un son d'app classique.
export function useTTS() {
  const activeRef = useRef<ActiveSource | null>(null);
  // Compteur de génération : chaque appel de speak/stop incrémente. Une
  // tâche async qui voit son `gen` périmé après un await sait qu'un autre
  // speak() (ou un stop()) est passé entre-temps et abandonne sans toucher
  // à l'état.
  const callGenRef = useRef(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((key: string, onEnd?: () => void) => {
    const myGen = ++callGenRef.current;

    if (activeRef.current) {
      activeRef.current.stopped = true;
      try { activeRef.current.source.stop(); } catch { /* ignore */ }
      activeRef.current = null;
    }

    setIsSpeaking(true);

    void (async () => {
      const ctx = getAudioContext();
      const buffer = await loadBuffer(key, ctx);
      // Périmé : un speak() ou stop() plus récent a pris le relais.
      if (callGenRef.current !== myGen) return;
      if (!buffer) {
        activeRef.current = null;
        setIsSpeaking(false);
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const active: ActiveSource = { source, stopped: false };
      activeRef.current = active;

      source.onended = () => {
        if (activeRef.current === active) {
          activeRef.current = null;
          setIsSpeaking(false);
        }
        if (!active.stopped && onEnd) onEnd();
      };

      try {
        source.start(0);
      } catch {
        if (activeRef.current === active) {
          activeRef.current = null;
          setIsSpeaking(false);
        }
      }
    })();
  }, []);

  const stop = useCallback(() => {
    // Bump de génération pour qu'un speak() en cours de chargement abandonne.
    callGenRef.current++;
    if (activeRef.current) {
      activeRef.current.stopped = true;
      try { activeRef.current.source.stop(); } catch { /* ignore */ }
      activeRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  return { speak, stop, isSpeaking };
}
