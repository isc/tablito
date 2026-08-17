import { useCallback, useEffect, useRef, useState } from 'react';
import LetterKeyboard from './LetterKeyboard';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useInputMode } from '../hooks/useInputMode';
import { useLatestRef } from '../hooks/useLatestRef';
import { useTTS } from '../hooks/useTTS';
import { isAndroid } from '../lib/install';
import { voiceLog } from '../lib/voiceDebug';
import { loadPhoneticDict, type PhoneticDict } from '../lib/phoneticDict';
import { bestSpelledParse, parseSpelledLetters } from '../lib/parseSpelledLetters';
import { conjStrings as t } from '../i18n/conjugation';
import { useVoiceStrings } from '../i18n/voice';

// === Mode vocal épelé de la conjugaison (specs §15.10) ===
//
// L'enfant DIT la forme puis l'ÉPELLE (« chantent : e, n, t ») : épeler est de
// la production orthographique authentique, là où dire la forme seule serait
// aveugle à la compétence testée (chante / chantes / chantent sont homophones,
// §15.5). Le coût moteur de la frappe disparaît, et avec lui le bruit qu'il
// mettait sur le seuil de rapidité.
//
// Trois garanties, qui sont la raison d'être de ce composant :
//
//   1. **un raté de reconnaissance n'est JAMAIS une erreur Leitner.** Rien ne
//      part au jugement tant que la reconstruction n'est pas fiable ; sinon on
//      redemande, gentiment, et on bascule au clavier au deuxième raté ;
//   2. **écho visuel corrigeable.** Les lettres reconnues remplissent l'ardoise
//      du clavier, qui reste sous la main : dès que l'enfant y touche, le micro
//      se coupe et c'est elle qui valide — plus aucune soumission automatique
//      ne peut lui passer devant ;
//   3. **on ne compare jamais en orthographe.** Tout l'appariement est délégué
//      à `parseSpelledLetters`, qui projette le transcript en phonèmes.
//
// Ce composant est le pendant conjugaison de `VoiceInput` (le vocal des maths,
// §3.6bis) et en reprend la politique micro selon la plateforme. Il ne le
// réutilise pas : le vocal des maths attend un NOMBRE, valide dès l'interim
// quand il reconnaît la réponse attendue et laisse le micro filtrer l'écho par
// une fenêtre de grâce sélective. Ici la réponse est une suite de lettres, il
// n'y a pas de chemin rapide, et l'écho se jette d'un bloc (voir plus bas).

/** Bascule automatique au clavier après deux ratés sur la MÊME question (§15.10). */
const MAX_FAILS_BEFORE_KEYBOARD = 2;

// Après la fin de la synthèse, le recognizer peut encore livrer un final qui
// porte l'écho haut-parleur→micro. On le jette — mais ici on jette TOUT, y
// compris une épellation apparemment valide : les phrases porteuses contiennent
// « à l'école », « aux billes », « au tableau », dont les mots sonnent comme
// les lettres a et o. Un écho pourrait donc fabriquer une réponse plausible, et
// une réponse plausible est bien plus nuisible qu'un silence. Comme on jette
// plus large, on jette moins longtemps que le vocal des maths (2 s) : la fenêtre
// couvre le final traînant, pas la réponse de l'enfant.
const POST_TTS_GRACE_MS = 1200;

/**
 * Les deux relances parlées du mode, avec leurs clés de MP3 (§15.10). Elles
 * vivent ici, chez le composant qui décide de les dire : l'écran de séance n'a
 * qu'à jouer la clé qu'on lui passe. Leur texte, lui, vient de
 * i18n/conjugation.ts (`voiceNotHeard`, `voiceSpellNow`) et
 * scripts/generate-tts.mjs le lit là-bas — jamais deux rédactions.
 */
const NUDGE_KEYS = {
  unheard: 'conj-voice-again',
  spell: 'conj-voice-spell',
} as const;

interface ConjVoiceInputProps {
  /**
   * Forme verbale complète attendue (« chantent »). Sert à RECONNAÎTRE la forme
   * dite avant l'épellation pour l'écarter du décompte des lettres — jamais à
   * valider : l'homophonie y est une qualité (§15.5), la discrimination
   * orthographique se joue dans l'épellation.
   */
  expectedForm: string;
  /**
   * Réponse à juger, avec la surface qui l'a réellement produite : `'voice'`
   * pour une épellation entendue, `'keypad'` dès que l'enfant a tapé (une
   * correction, ou la bascule après deux ratés). L'appelant en a besoin — le
   * seuil de rapidité et l'historique ne peuvent pas dire « vocal » d'une
   * réponse tapée au clavier (§15.10).
   */
  onSubmit: (value: string, source: 'voice' | 'keypad') => void;
  /** Radical affiché en encre douce dans l'ardoise (« chant »). */
  prefix?: string;
  /** Seule la terminaison est demandée : la consigne dite diffère. */
  endingOnly?: boolean;
  disabled?: boolean;
  /** La synthèse parle : sur Android on ferme le micro, partout on jette l'écho. */
  isSpeaking?: boolean;
  /** Change à chaque question : remet l'écoute, l'écho et les compteurs à zéro. */
  questionToken?: string | number;
  /**
   * Premier son de la réponse. C'est LÀ que se mesure le seuil de rapidité en
   * vocal (§15.10) : la latence de rappel pur, avant toute production — l'écran
   * de séance s'en sert au lieu du temps jusqu'à la validation.
   */
  onSpeechStart?: () => void;
  /**
   * Joue une relance parlée. L'écran de séance est le seul à posséder l'instance
   * de synthèse qui pilote `isSpeaking` (donc la politique micro) : il reçoit la
   * clé, il la dit.
   */
  onNudge?: (ttsKey: string) => void;
}

export default function ConjVoiceInput({
  expectedForm,
  onSubmit,
  prefix = '',
  endingOnly = false,
  disabled = false,
  isSpeaking = false,
  questionToken,
  onSpeechStart,
  onNudge,
}: ConjVoiceInputProps) {
  const { setInputMode } = useInputMode();
  const tv = useVoiceStrings();

  // Écho visuel : les lettres entendues, poussées dans l'ardoise du clavier.
  const [echo, setEcho] = useState('');
  const [keyboardOnly, setKeyboardOnly] = useState(false);
  // L'enfant a pris la main au clavier : micro coupé, validation à elle.
  const [tookOver, setTookOver] = useState(false);
  // Micro coupé à la demande (appui sur l'icône) — distinct de `isListening`,
  // qui retombe brièvement entre deux sessions du recognizer et ferait
  // clignoter la consigne.
  const [micOn, setMicOn] = useState(true);
  const [hint, setHint] = useState<'spell' | 'again' | 'spell-now'>('spell');

  /**
   * Remet la surface en position « je t'écoute » : ardoise vide, micro ouvert,
   * consigne de départ. Trois moments l'utilisent — une nouvelle question, la
   * réouverture du micro après l'avoir coupé, et le retour volontaire à la voix
   * après la bascule clavier — et ils doivent repartir du même état, sinon un
   * reste de la question précédente traîne dans l'ardoise.
   */
  function resumeVoice(): void {
    setEcho('');
    setKeyboardOnly(false);
    setTookOver(false);
    setMicOn(true);
    setHint('spell');
  }

  // Politique micro : identique au vocal des maths (cf. l'en-tête de
  // VoiceInput). Android = sessions mono-énoncé sans annulation d'écho, donc
  // micro fermé pendant la synthèse ; iOS = micro ouvert toute la séance.
  const pauseMicDuringTTS = isAndroid();

  const dictRef = useRef<PhoneticDict | null>(null);
  /** Ratés de reconnaissance sur la question en cours (jamais des erreurs). */
  const failsRef = useRef(0);
  const lastSpeakEndRef = useRef(0);
  const submittedRef = useRef(false);
  const speechStartedRef = useRef(false);
  // Vrai après une invite « épelle » : on ne réécarte plus la forme dite. Sans
  // ça, une forme d'une seule lettre (« il a » → « a ») tournerait en rond,
  // l'épellation étant alors indiscernable de la forme.
  const ignoreFormRef = useRef(false);
  // Props lues dans les callbacks de reconnaissance, qui ne doivent pas être
  // recréés à chaque render (cf. useLatestRef).
  const disabledRef = useLatestRef(disabled);
  const isSpeakingRef = useLatestRef(isSpeaking);
  const expectedFormRef = useLatestRef(expectedForm);

  useEffect(() => {
    if (!isSpeaking) lastSpeakEndRef.current = Date.now();
  }, [isSpeaking]);

  // Le dictionnaire n'est chargé QU'ICI : entrer en mode vocal est la seule
  // chose qui le rende utile (~4 Ko, groupe de cache `phonetic`). Un échec de
  // chargement ne bloque rien — l'appariement dégrade sur ses étages
  // orthographiques (lettre seule, nom de lettre connu).
  useEffect(() => {
    let alive = true;
    void loadPhoneticDict().then((dict) => {
      if (alive) dictRef.current = dict;
    });
    return () => {
      alive = false;
    };
  }, []);

  // Les MP3 des relances sont décodés dès l'entrée en mode vocal : elles se
  // jouent juste après une réponse mal entendue, le pire moment pour un décodage
  // à la volée — et une relance qui traîne, c'est un enfant qui attend sans
  // savoir quoi faire. Le cache de buffers de `useTTS` est au niveau module,
  // donc précharger d'ici sert la synthèse de l'écran de séance.
  const { preload } = useTTS();
  useEffect(() => {
    preload(Object.values(NUDGE_KEYS));
  }, [preload]);

  // Nouvelle question : tout repart de zéro. Le composant n'est PAS re-monté
  // d'une question à l'autre — un re-montage rouvrirait le micro, et iOS joue un
  // « ding » à chaque ouverture — donc c'est ce reset qui tient lieu de remise à
  // neuf. Côté état, par dérivation au render (l'idiome du vocal des maths et de
  // l'écran de séance)…
  const [prevToken, setPrevToken] = useState(questionToken);
  if (questionToken !== prevToken) {
    setPrevToken(questionToken);
    resumeVoice();
  }

  // … et côté refs par un effet : une ref ne participe pas au rendu, donc elle
  // ne s'écrit pas pendant. L'effet court à la validation du render, avant tout
  // nouvel événement de reconnaissance.
  useEffect(() => {
    failsRef.current = 0;
    submittedRef.current = false;
    speechStartedRef.current = false;
    ignoreFormRef.current = false;
  }, [questionToken]);

  /** Écho de la synthèse : tout ce qui arrive pendant, ou juste après, est suspect. */
  const isTTSEcho = useCallback(
    () => isSpeakingRef.current || Date.now() - lastSpeakEndRef.current < POST_TTS_GRACE_MS,
    [isSpeakingRef],
  );

  const submitSpelled = useCallback(
    (answer: string) => {
      if (submittedRef.current || disabledRef.current) return;
      submittedRef.current = true;
      onSubmit(answer, 'voice');
    },
    [disabledRef, onSubmit],
  );

  /** Réponse tapée : une correction, ou la bascule après deux ratés. */
  const submitTyped = useCallback((answer: string) => onSubmit(answer, 'keypad'), [onSubmit]);

  const handleFinal = useCallback(
    (transcript: string, alternatives: string[]) => {
      if (disabledRef.current || tookOver) return;
      const parse = bestSpelledParse([transcript, ...alternatives], {
        expectedForm: expectedFormRef.current,
        dict: dictRef.current,
        ignoreForm: ignoreFormRef.current,
      });
      if (isTTSEcho()) {
        voiceLog('conj:drop-echo', `${parse.status} ${parse.answer}`);
        return;
      }

      if (parse.status === 'letters') {
        voiceLog('conj:spelled', parse.answer);
        setEcho(parse.answer);
        submitSpelled(parse.answer);
        return;
      }

      // Rien de fiable : on redemande. AUCUN appel à onSubmit, donc aucune
      // erreur Leitner — on n'évalue pas le micro (§15.10).
      const formOnly = parse.status === 'form-only';
      if (formOnly) ignoreFormRef.current = true;
      voiceLog(formOnly ? 'conj:form-only' : 'conj:unheard');
      setEcho('');
      setHint(formOnly ? 'spell-now' : 'again');
      onNudge?.(formOnly ? NUDGE_KEYS.spell : NUDGE_KEYS.unheard);
      failsRef.current += 1;
      if (failsRef.current >= MAX_FAILS_BEFORE_KEYBOARD) setKeyboardOnly(true);
    },
    [disabledRef, expectedFormRef, isTTSEcho, onNudge, submitSpelled, tookOver],
  );

  const handleInterim = useCallback(
    (text: string) => {
      if (disabledRef.current || tookOver || isTTSEcho() || !text.trim()) return;
      // Le chrono de rappel s'arrête au premier son de la réponse, pas à la fin
      // de l'épellation : c'est le rappel qu'on mesure, pas le débit de parole.
      if (!speechStartedRef.current) {
        speechStartedRef.current = true;
        onSpeechStart?.();
      }
      // Écho au fur et à mesure : les lettres apparaissent pendant qu'elle parle.
      const parse = parseSpelledLetters(text, {
        expectedForm: expectedFormRef.current,
        dict: dictRef.current,
        ignoreForm: ignoreFormRef.current,
      });
      if (parse.letters.length > 0) setEcho(parse.answer);
    },
    [disabledRef, expectedFormRef, isTTSEcho, onSpeechStart, tookOver],
  );

  const { start, abort, isListening, error, isSupported } = useSpeechRecognition({
    onFinal: handleFinal,
    onInterim: handleInterim,
    // La matière est francophone (§15) : pas de tag dérivé de la langue
    // d'interface, il n'y a pas d'autre cas.
    lang: 'fr-FR',
  });

  const micClosed = keyboardOnly || tookOver || !micOn || (pauseMicDuringTTS && isSpeaking);
  useEffect(() => {
    if (!isSupported) return;
    if (micClosed) {
      abort();
      return;
    }
    start();
    return abort;
  }, [isSupported, micClosed, start, abort]);

  const handleEdit = useCallback(() => {
    // L'enfant corrige : on lui rend la main entièrement (micro coupé, plus
    // d'écho qui écrase sa saisie, validation explicite comme au clavier).
    setTookOver(true);
  }, []);

  const keyboard = (
    <LetterKeyboard
      onSubmit={submitTyped}
      disabled={disabled}
      prefix={prefix}
      // Écho poussé dans l'ardoise, sauf si l'enfant a pris la main.
      value={tookOver ? undefined : echo}
      onEdit={handleEdit}
    />
  );

  // Reconnaissance vocale absente du navigateur : le clavier, sans un mot. Même
  // repli que le vocal des maths, qui retombe sur le pavé numérique.
  if (!isSupported) return keyboard;

  const permissionBlocked = error === 'not-allowed' || error === 'service-not-allowed';
  const micLive = !micClosed;
  const hintText = tookOver
    ? t.voiceTookOver
    : !micLive
      ? tv.tapToSpeak
      : hint === 'again'
        ? t.voiceNotHeard
        : hint === 'spell-now'
          ? t.voiceSpellNow
          : endingOnly
            ? t.voiceSpellEnding
            : t.voiceSpellWhole;

  return (
    <div className="conj-voice">
      {keyboardOnly ? (
        <div className="conj-voice-fallback" aria-live="polite">
          {t.voiceFallbackToKeyboard}
        </div>
      ) : (
        <div className="conj-voice-bar">
          <button
            type="button"
            className={`conj-voice-mic${micLive && isListening ? ' listening' : ''}`}
            onClick={() => {
              if (disabled) return;
              if (micLive) setMicOn(false);
              else resumeVoice();
            }}
            aria-label={micLive ? tv.listening : tv.speak}
            aria-pressed={micLive}
            disabled={disabled}
          >
            <span aria-hidden="true">{'🎤'}</span>
            {micLive && isListening && <span className="voice-mic-ring" aria-hidden="true" />}
          </button>
          <div className="conj-voice-hint" aria-live="polite">
            {hintText}
          </div>
        </div>
      )}

      {permissionBlocked && <div className="voice-error">{tv.micBlocked}</div>}
      {error === 'network' && <div className="voice-error">{tv.needsInternet}</div>}

      {keyboard}

      {keyboardOnly ? (
        <button
          type="button"
          className="session-input-switch"
          onClick={() => {
            failsRef.current = 0;
            resumeVoice();
          }}
          disabled={disabled}
        >
          {'🎤'} {tv.retryWithVoice}
        </button>
      ) : (
        <button
          type="button"
          className="session-input-switch"
          onClick={() => setInputMode('keypad')}
          disabled={disabled}
        >
          {'⌨️'} {tv.useKeyboard}
        </button>
      )}
    </div>
  );
}
