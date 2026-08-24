// Temps moyen de réponse d'une séance, interruptions retranchées.
//
// Le parent lit cette moyenne dans son tableau de bord (§5.2) et compare ses
// séances entre elles. Une seule interruption la ruine : dans un profil joint à
// un avis du 23/08/2026, une question laissée en plan pendant 14 min a porté la
// moyenne de la séance à 50 s, pour des réponses réellement données en 3 à 9 s.
//
// `lib/questionClock` retranche déjà le temps écran verrouillé, qui est le cas
// le plus courant. Reste l'enfant qui s'éloigne SANS verrouiller : aucun signal
// ne le distingue d'une longue réflexion — au niveau d'UNE question. Au niveau
// de la séance, si : une réponse très au-dessus de la norme de la séance
// elle-même est une interruption, pas une réflexion.
//
// D'où la normalisation, reprise de la convention d'Arabesque (l'autre app de
// la maison, `practiceTracker.js`, qui règle le même problème sur la durée
// jouée par mesure) : un seuil d'aberration calibré sur les données de la
// fenêtre courante, et le segment aberrant remplacé par LA NORME DE SON ESPÈCE
// — ici la plus longue réponse normale de la séance — plutôt que par le seuil
// ou par zéro. La question a bien été répondue ; c'est l'attente qui n'a pas eu
// lieu.
//
// Un plafond fixe ferait le même travail en apparence, mais mal : le tempo d'un
// enfant de CE2 au clavier n'est pas celui d'un enfant qui répond à la voix, ni
// le même en division avec reste (deux réponses) qu'en table de 2. Le seuil doit
// suivre l'enfant, pas une constante choisie à sa place.
//
// Ce qui n'est PAS corrigé ici, exprès : le temps enregistré dans l'historique
// du fait, et le jugement « rapide » qui décide d'une montée de boîte. Les deux
// se prennent à la réponse, quand la séance n'a pas encore de médiane — et une
// réponse interrompue est de toute façon « lente », donc jamais promue.

/**
 * Calibrage du seuil d'aberration. `FACTOR` est celui d'Arabesque ; le plancher,
 * lui, est propre à la matière : une réponse se compte en secondes, pas en
 * mesures jouées. 20 s passe au-dessus de la plus lente réponse réellement
 * observée dans un profil (une division avec reste à 18,9 s), pour qu'un enfant
 * qui cherche vraiment ne soit jamais pris pour un enfant parti jouer dehors.
 */
export const ABERRANT_ANSWER_FLOOR_MS = 20_000;
export const ABERRANT_ANSWER_FACTOR = 4;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Moyenne des temps de réponse d'une séance, les réponses aberrantes ramenées à
 * la plus longue réponse normale de la même séance. Renvoie 0 sans réponse.
 */
export function normalizedAverageMs(times: number[]): number {
  if (times.length === 0) return 0;

  const threshold = Math.max(ABERRANT_ANSWER_FLOOR_MS, ABERRANT_ANSWER_FACTOR * median(times));
  // Jamais vide : le seuil vaut au moins 4 × la médiane, donc la médiane
  // elle-même y est, et avec elle la moitié basse de la séance.
  const normal = times.filter((t) => t <= threshold);
  const replacement = Math.max(...normal);

  const total = times.reduce((sum, t) => sum + Math.min(t, replacement), 0);
  return Math.round(total / times.length);
}
