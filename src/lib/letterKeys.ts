// Disposition du mini-clavier de lettres (LetterKeyboard). Elle vit ici et non
// dans le composant parce que le juge de la conjugaison en a besoin : une
// coquille de clavier, c'est le doigt qui tombe sur la touche d'à côté
// (conjugationComposer, verdict « presque »).

// Tableau de chaînes (pas un spread de littéral) : é et ê doivent rester des
// clés d'un caractère quelle que soit la forme Unicode du fichier source.
// Ordre alphabétique, 4 rangées de 7 (pourquoi : cf. LetterKeyboard).
export const LETTER_KEYS = [
  'a', 'b', 'c', 'd', 'e', 'é', 'ê',
  'f', 'g', 'h', 'i', 'j', 'k', 'l',
  'm', 'n', 'o', 'p', 'q', 'r', 's',
  't', 'u', 'v', 'w', 'x', 'y', 'z',
];

/** Touches par rangée : LetterKeyboard la passe à la grille CSS (`--letterpad-cols`). */
export const LETTER_KEY_COLUMNS = 7;

/**
 * Deux touches se touchent-elles sur le clavier : à gauche, à droite, au-dessus
 * ou en dessous ? Pas en diagonale : avec elles, « aller » pour « allez » (r et
 * z) passerait pour une coquille, alors que c'est l'erreur de conjugaison type.
 */
export function areNeighborKeys(a: string, b: string): boolean {
  const i = LETTER_KEYS.indexOf(a);
  const j = LETTER_KEYS.indexOf(b);
  if (i === -1 || j === -1) return false;
  const rows = Math.abs(Math.floor(i / LETTER_KEY_COLUMNS) - Math.floor(j / LETTER_KEY_COLUMNS));
  const cols = Math.abs((i % LETTER_KEY_COLUMNS) - (j % LETTER_KEY_COLUMNS));
  return rows + cols === 1;
}
