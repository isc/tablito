// Instrumentation du faux Web Audio de `setup.ts`, partagée par les tests qui
// ont besoin de savoir qu'un MP3 a été JOUÉ (et pas seulement fetché) ou de
// faire finir sa lecture. Trois fichiers de test le faisaient chacun à leur
// façon, avec chacun sa restauration à la main.
//
// Deux besoins, un seul patch :
//   - COMPTER les lectures démarrées — c'est la seule preuve qu'une voix a
//     réellement parlé, `useTTS` avalant les 404 en silence ;
//   - TERMINER la lecture après un délai — le faux BufferSource ne s'arrête
//     jamais tout seul, donc `isSpeaking` resterait vrai pour toujours et les
//     composants vocaux jetteraient tout ce qu'ils entendent comme un écho.

export interface PatchedBufferSource {
  /** Nombre de lectures démarrées depuis le patch. */
  starts: () => number;
  /** Rend son `createBufferSource` d'origine au contexte audio. Idempotent. */
  restore: () => void;
}

interface PatchOptions {
  /**
   * Durée simulée d'une lecture, en ms : `onended` est appelé après ce délai
   * (timers factices compris). Omis, la lecture ne se termine jamais — ce qui
   * suffit aux tests qui ne font que compter.
   */
  endAfterMs?: number;
}

type AudioContextProto = {
  prototype: { createBufferSource: () => AudioBufferSourceNode };
};

/**
 * Instrumente `AudioContext.prototype.createBufferSource` pour la durée d'un
 * test. À défaire par `restore()` dans le `afterEach` correspondant — sans quoi
 * le patch fuiterait sur les tests suivants du même fichier.
 */
export function patchBufferSource({ endAfterMs }: PatchOptions = {}): PatchedBufferSource {
  const ctor = globalThis.AudioContext as unknown as AudioContextProto;
  const original = ctor.prototype.createBufferSource;
  let starts = 0;
  let restored = false;

  ctor.prototype.createBufferSource = function (this: AudioContext) {
    const node = original.call(this);
    const start = node.start.bind(node);
    node.start = ((...args: Parameters<AudioBufferSourceNode['start']>) => {
      starts += 1;
      if (endAfterMs !== undefined) {
        setTimeout(() => node.onended?.(new Event('ended')), endAfterMs);
      }
      return start(...args);
    }) as AudioBufferSourceNode['start'];
    return node;
  };

  return {
    starts: () => starts,
    restore: () => {
      if (restored) return;
      restored = true;
      ctor.prototype.createBufferSource = original;
    },
  };
}
