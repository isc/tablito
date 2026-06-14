// Vitest setup file — runs once per test file before the tests.
//
// i18n : jsdom ET Node 22 exposent `navigator.language` = 'en-US', ce qui
// basculerait l'app en anglais et casserait les assertions de texte français
// des tests existants. On fige la langue d'interface sur le français via une
// préférence localStorage explicite (lue en priorité par detectLang) AVANT que
// le moindre module ne soit importé (les setupFiles tournent en premier). En
// environnement node, localStorage n'existe pas : on le polyfill a minima.
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
localStorage.setItem('multiplix-lang', 'fr');
//
// jsdom ships a lot of the DOM but not the Web Audio API. `useSound` instantiates
// `new AudioContext()` as soon as a question is answered, which would throw in
// jsdom. We stub it with a minimal no-op implementation so the real `useSound`
// hook can run unchanged inside the tests.

class FakeAudioParam {
  setValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect(): void {}
}

class FakeOscillatorNode {
  type = 'sine';
  frequency = new FakeAudioParam();
  connect(): void {}
  start(): void {}
  stop(): void {}
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect(): void {}
  start(): void {}
  stop(): void {
    if (this.onended) this.onended();
  }
}

class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  createOscillator(): OscillatorNode {
    return new FakeOscillatorNode() as unknown as OscillatorNode;
  }
  createGain(): GainNode {
    return new FakeGainNode() as unknown as GainNode;
  }
  createBufferSource(): AudioBufferSourceNode {
    return new FakeBufferSourceNode() as unknown as AudioBufferSourceNode;
  }
  decodeAudioData(): Promise<AudioBuffer> {
    return Promise.resolve({} as AudioBuffer);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

// Install on both window and globalThis so any access path finds it.
(globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext =
  FakeAudioContext as unknown as typeof AudioContext;
(globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext =
  FakeAudioContext as unknown as typeof AudioContext;

// jsdom doesn't implement HTMLMediaElement.play/pause — stub them pour
// éviter les crashs si du code legacy en utilise encore.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {};
}

// useTTS fait un fetch sur /audio/tts/*.mp3 ; en jsdom ça partirait en
// vrai sur localhost et échouerait. On stub fetch pour ces chemins en
// renvoyant un arrayBuffer vide — useTTS gère gracieusement le cas où
// decodeAudioData renvoie un buffer vide.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/audio/tts/')) {
    return Promise.resolve(
      new Response(new ArrayBuffer(0), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }),
    );
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;
