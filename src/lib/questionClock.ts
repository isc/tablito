// Chronomètre d'une question, en temps ÉVEILLÉ.
//
// Le temps de réponse sert trois choses : le seuil « rapide » qui décide d'une
// montée de boîte (§3.3), l'historique du fait, et le temps moyen de la séance
// affiché au parent (§5.2). Les trois mesuraient jusqu'ici l'horloge murale
// entre l'affichage de la question et la validation — donc aussi le téléphone
// mis en veille au milieu d'une séance, reprise dix minutes plus tard.
//
// Constaté dans un profil joint à un avis du 23/08/2026 : une question de
// conjugaison enregistrée à 860 596 ms (14 min), moyenne de la séance portée à
// 50 s, et une montée de boîte perdue sur un fait que l'enfant savait. C'est
// exactement ce que le parent demandait : « quand on met le téléphone en veille
// et qu'on fait 5 minutes de pause, il ne faut pas prendre en compte ce temps
// abusif ».
//
// On soustrait donc le temps passé onglet caché — écran verrouillé, app en
// arrière-plan, autre onglet. Corriger ici plutôt qu'à l'affichage de la
// moyenne bénéficie aux trois usages d'un coup, et n'écrit jamais dans
// l'historique une durée que l'enfant n'a pas vécue.
//
// Même soustraction pour une pause demandée par l'app (la confirmation d'arrêt
// de séance, cf. setQuestionClockPaused) : un enfant qui hésite puis continue
// ne perd pas sa montée de boîte.
//
// Ce que la soustraction ne voit pas : l'enfant qui s'éloigne en laissant
// l'écran allumé. Rien ne distingue ça d'une longue réflexion sur UNE question,
// et on ne tronque donc rien ici — c'est au niveau de la séance, qui a une norme
// à quoi comparer, que l'aberration se repère (cf. lib/sessionTiming).

/** Total du temps qui ne compte pas (caché ou en pause) depuis le chargement de la page. */
let hiddenTotalMs = 0;
/** Début de la période qui ne compte pas en cours, `null` quand le chrono tourne. */
let hiddenSince: number | null = null;
let listening = false;
let paused = false;

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

// Caché et en pause en même temps : une seule période, comptée une fois.
function sync(): void {
  const off = paused || isHidden();
  if (off && hiddenSince === null) hiddenSince = Date.now();
  if (!off && hiddenSince !== null) {
    hiddenTotalMs += Date.now() - hiddenSince;
    hiddenSince = null;
  }
}

// Écoute posée au premier usage, jamais retirée : un seul écouteur pour toute
// la vie de la page, et le compteur doit rester juste même entre deux séances.
function listen(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  sync();
  document.addEventListener('visibilitychange', sync);
}

function hiddenMsSoFar(): number {
  return hiddenSince === null ? hiddenTotalMs : hiddenTotalMs + (Date.now() - hiddenSince);
}

/** Instant de départ d'une question, temps caché compris pour pouvoir le retirer. */
export interface QuestionStart {
  at: number;
  hiddenMs: number;
}

/**
 * Valeur d'attente, avant qu'une première question ne démarre : les écrans
 * gardent le départ dans un `useRef`, qui a besoin d'une valeur initiale.
 */
export const NOT_STARTED: QuestionStart = { at: 0, hiddenMs: 0 };

/** Démarre (ou redémarre) le chronomètre de la question en cours. */
export function startQuestion(): QuestionStart {
  listen();
  return { at: Date.now(), hiddenMs: hiddenMsSoFar() };
}

/**
 * Temps éveillé écoulé depuis `start`. Plancher à 0 : l'horloge système peut
 * reculer (fuseau, réglage manuel) et une durée négative n'a aucun sens pour un
 * seuil de rapidité.
 */
export function activeMsSince(start: QuestionStart): number {
  const hidden = hiddenMsSoFar() - start.hiddenMs;
  return Math.max(0, Date.now() - start.at - hidden);
}

/**
 * Suspend (ou relance) le chrono de toutes les questions, comme un écran
 * verrouillé. Une question ouverte pendant la pause part donc de zéro à la
 * reprise.
 */
export function setQuestionClockPaused(value: boolean): void {
  listen();
  paused = value;
  sync();
}

/** Remise à zéro du compteur global — réservée aux tests. */
export function resetHiddenTimeForTests(): void {
  hiddenTotalMs = 0;
  paused = false;
  hiddenSince = isHidden() ? Date.now() : null;
}
