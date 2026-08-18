// === Noms des lettres françaises (spec §15.10, mode vocal épelé) ===
//
// Quand on épelle à voix haute, on ne prononce pas des lettres : on prononce
// leurs NOMS (« esse », « haine », « té »). La reconnaissance vocale, elle,
// transcrit en orthographe — et l'orthographe d'un nom de lettre isolé, en voix
// d'enfant, est une loterie : « s » revient en « esse », « ès », « ace » ou
// « S », « n » en « haine », « aine » ou « enne ».
//
// D'où cette table, écrite à la main, qui donne pour chaque lettre du périmètre
// (l'alphabet, plus é et ê — les deux seuls diacritiques du clavier, cf.
// LetterKeyboard) :
//   - `names`    : les orthographes que le STT est susceptible d'écrire ;
//   - `phonemes` : la ou les prononciations du NOM de la lettre, en API.
//
// Les deux servent à deux étages différents de l'appariement
// (cf. parseSpelledLetters) : `names` est un raccourci exact, `phonemes` est le
// filet — c'est LUI qui rend inoffensive toute transcription homophone qu'on
// n'a pas anticipée, en projetant le mot transcrit dans l'espace phonémique
// (via lib/phoneticDict) avant de comparer. On ne compare JAMAIS en
// orthographe : « haine » ne ressemble pas à « n », /ʼɛn/ est /ɛn/.
//
// Les valeurs API ont été relevées sur le dictionnaire de prononciation
// lui-même, qui contient chaque lettre seule à son nom (« s » → /ɛs/,
// « w » → /dubləve/) : la table n'invente rien, elle rend explicite — et
// testable — ce dont dépend le mode.

export interface LetterNameDef {
  /** La lettre écrite : ce qui atterrit dans la réponse. */
  letter: string;
  /** Orthographes plausibles du nom de la lettre dans un transcript STT. */
  names: readonly string[];
  /** Prononciations du nom de la lettre, en API (sans les barres obliques). */
  phonemes: readonly string[];
}

/**
 * Une entrée par lettre du périmètre. Trois principes, tenus par les tests :
 *
 * 1. **aucun `name` ne sert deux lettres** — sinon l'appariement devrait
 *    deviner, et le mode épellerait au hasard ;
 * 2. **aucun `phoneme` ne sert deux lettres** — même raison, côté filet ;
 * 3. **une lettre seule n'a pas besoin d'être listée dans ses `names`** : le
 *    transcript d'un seul caractère est reconnu tel quel (« N », « T »), c'est
 *    le premier étage de l'appariement.
 */
export const LETTER_NAMES: readonly LetterNameDef[] = [
  { letter: 'a', names: ['ah', 'à', 'ha'], phonemes: ['a'] },
  { letter: 'b', names: ['bé', 'be', 'bè'], phonemes: ['be'] },
  { letter: 'c', names: ['cé', 'ce', 'cè', 'ses', 'sé'], phonemes: ['se'] },
  { letter: 'd', names: ['dé', 'de', 'dè', 'des'], phonemes: ['de'] },
  // La lettre e se dit [ø] (« eux ») ou, relâchée, [ə]. « euh » est ici la
  // lettre et non une hésitation : dans un contexte où l'on demande de nommer
  // des lettres, e est celle qu'on nomme le plus (-e, -es, -ez, -ent), et la
  // perdre coûterait plus cher que d'accepter une hésitation de temps en temps.
  { letter: 'e', names: ['euh', 'heu', 'eu', 'eux'], phonemes: ['ø', 'ə'] },
  { letter: 'f', names: ['effe', 'ef', 'èf', 'aife'], phonemes: ['ɛf'] },
  // Les apostrophes sont normalisées (’ → ') avant comparaison : une seule
  // graphie par nom suffit.
  { letter: 'g', names: ['gé', 'ge', 'gè', "j'ai", 'geai'], phonemes: ['ʒe'] },
  { letter: 'h', names: ['hache', 'ache', 'hâche'], phonemes: ['aʃ'] },
  { letter: 'i', names: ['hi', 'ih'], phonemes: ['i'] },
  { letter: 'j', names: ['ji', 'gi', 'gis'], phonemes: ['ʒi'] },
  { letter: 'k', names: ['ka', 'kâ', 'cas'], phonemes: ['ka'] },
  // « elle » reste la lettre l, pas le pronom : les doubles l du périmètre
  // (« allons », « allez ») s'épellent « elle, elle ». Attention au sens de la
  // règle du préambule : elle ignore les mots INCOMPRIS avant la première
  // lettre, pas les mots compris — un pronom qui est aussi un nom de lettre
  // n'est donc PAS ignoré, il écrit sa lettre. C'est pourquoi
  // `parseSpelledLetters` consomme explicitement le pronom de la question
  // (option `subject`) avant de chercher des lettres.
  { letter: 'l', names: ['elle', 'el', 'èl', 'aile', 'ailes'], phonemes: ['ɛl'] },
  { letter: 'm', names: ['emme', 'em', 'èm', 'aime', 'aimes'], phonemes: ['ɛm'] },
  { letter: 'n', names: ['enne', 'en', 'èn', 'haine', 'aine', 'ène'], phonemes: ['ɛn'] },
  { letter: 'o', names: ['oh', 'ho', 'au', 'eau'], phonemes: ['o'] },
  { letter: 'p', names: ['pé', 'pe', 'pè', 'pet'], phonemes: ['pe'] },
  { letter: 'q', names: ['qu', 'ku', 'cu', 'ky', 'cul'], phonemes: ['ky'] },
  { letter: 'r', names: ['erre', 'ère', 'air', 'aire', 'ers'], phonemes: ['ɛʁ'] },
  { letter: 's', names: ['esse', 'ès', 'es', 'ace', 'aisse'], phonemes: ['ɛs'] },
  { letter: 't', names: ['té', 'te', 'tè', 'thé', 'tes'], phonemes: ['te'] },
  { letter: 'u', names: ['hue', 'ue', 'hu'], phonemes: ['y'] },
  { letter: 'v', names: ['vé', 've', 'vè'], phonemes: ['ve'] },
  // Noms composés : appariés sur plusieurs mots consécutifs du transcript,
  // avant toute tentative mot à mot — sans quoi « i grec » donnerait la
  // lettre i suivie d'un mot incompris, et « double vé » deux lettres fausses.
  { letter: 'w', names: ['double vé', 'double v', 'double vet'], phonemes: ['dubləve'] },
  { letter: 'x', names: ['iks', 'ixe', 'ix'], phonemes: ['iks'] },
  { letter: 'y', names: ['i grec', 'y grec', 'igrec'], phonemes: ['igʁɛk'] },
  { letter: 'z', names: ['zède', 'zed', 'zèd'], phonemes: ['zɛd'] },
  // é et ê se nomment par leur son, ou par leur son plus l'accent.
  //
  // « et » = é est un ARBITRAGE DÉLIBÉRÉ, pas un oubli (§15.10, « arbitrages
  // assumés »). Le nom de la lettre é et la conjonction « et » sont des
  // homophones EXACTS (/e/) : aucun traitement phonémique ne pourra jamais les
  // distinguer, il n'y a qu'un pari à prendre. On le prend du côté de la
  // lettre, parce que le mode a besoin du é pour épeler « étais », « étions »,
  // « était » — sans quoi tout l'imparfait d'être devient inépelable, et c'est
  // un fait de l'inventaire, pas un cas d'école.
  //
  // Ce qui est sacrifié en connaissance de cause : l'enfant qui énumère « e, n
  // ET t » écrit un é parasite au milieu de sa terminaison — la reconstruction
  // devient « ené t », donc un raté de plus, jamais une erreur Leitner (§15.10).
  // C'est rare (on épelle « e, n, t », on ne coordonne pas), et le coût du pari
  // inverse serait permanent. Quand le faux é passe quand même, il est borné :
  // `judgeConjAnswer` traite « etais » pour « étais » en « presque » — accepté,
  // jamais promu (§15.5).
  {
    letter: 'é',
    names: ['et', 'hé', 'eh', 'e accent aigu', 'é accent aigu', 'accent aigu'],
    phonemes: ['e'],
  },
  {
    letter: 'ê',
    names: [
      'e accent circonflexe',
      'ê accent circonflexe',
      'accent circonflexe',
      'e chapeau',
      'ai',
    ],
    phonemes: ['ɛ'],
  },
];

/**
 * Mots que l'enfant intercale sans épeler : ponctuation dictée et marqueurs de
 * fin. Volontairement court, et surtout : aucun de ces mots n'est un nom de
 * lettre. Les pronoms et les marqueurs temporels n'y sont PAS — inutile, tout
 * ce qui précède la première lettre reconnue est déjà ignoré (préambule).
 */
export const SPELLING_FILLERS: readonly string[] = [
  'virgule',
  'point',
  'tiret',
  "trait d'union",
  'espace',
  'alors',
  'donc',
  'ensuite',
  'et puis',
  'voilà',
  'et voilà',
  'fini',
  "j'ai fini",
  "c'est tout",
  'ok',
];
