// Strings de la matière verbes irréguliers anglais (specs §16). Volontairement
// FR SEULEMENT, comme i18n/conjugation.ts : la matière est proposée dans toute
// langue d'interface sauf l'anglais, c'est-à-dire aujourd'hui le français. Une
// future interface dans une autre langue ajoutera sa table ici.
//
// AUCUN import runtime ici, pour la même raison que i18n/conjugation.ts.

import type { IrrFamily } from '../lib/irregularVerbs';

export const IRR_FAMILY_NAMES: Record<IrrFamily, string> = {
  same: 'Trois fois pareil',
  ought: 'La famille -ought',
  iau: 'La famille i → a → u',
  ew: 'La famille -ew / -own',
  back: 'Retour à la case départ',
  en: 'Le participe en -en',
  t: 'Deux pareils en -t',
  d: 'Deux pareils en -d',
  vowel: 'La voyelle qui change',
  unique: 'Les inclassables',
};

/**
 * L'astuce d'une famille (specs §16.3) : une ANALOGIE avec un verbe déjà su,
 * pas une règle. Deux familles ont en plus un repère qui leur est propre.
 */
export const IRR_FAMILY_HINTS: Record<IrrFamily, string> = {
  same: 'Rien ne change : les trois formes sont pareilles.',
  ought:
    'Le passé finit en -ought… sauf pour les deux verbes en -ch, teach et catch, qui prennent -aught.',
  iau: 'Le i devient a, puis u. Comme dans l’alphabet, le a vient avant le u : le prétérit d’abord.',
  ew: 'Le prétérit finit en -ew, le participe en -own (ou -awn).',
  back: 'Le participe revient à l’infinitif.',
  en: 'Le participe finit en -en (ou -n).',
  t: 'Prétérit et participe sont pareils, et finissent par -t.',
  d: 'Prétérit et participe sont pareils, et finissent par -d.',
  vowel: 'Prétérit et participe sont pareils : seule la voyelle change.',
  unique: 'Ce verbe ne ressemble à aucun autre : il s’apprend tout seul.',
};

export const irrStrings = {
  new: 'Nouveau !',
  next: 'Suivant →',
  gotIt: "J'ai compris !",
  replay: 'Réécouter',
  listen: 'Écouter',
  /** Étape 1 de l'introduction : la récitation, lue par la voix anglaise. */
  introListen: 'Écoute et répète à voix haute',
  /** Étape 2 : l'analogie avec un verbe de la même famille déjà su. */
  introFamily: (example: string) => `Comme ${example}`,
  /** Étape 3 : copie différée. */
  copyLook: 'Regarde bien…',
  copySay: 'À toi ! Dis les trois formes.',
  copyWrite: 'À toi ! Écris les deux formes.',
  copyAgain: 'Regarde encore une fois…',
  /** Consigne de la question. */
  askSay: 'Dis le verbe !',
  askWrite: 'Écris le prétérit, puis le participe',
  /** Cases de saisie au clavier. */
  slotPreterite: 'Prétérit',
  slotParticiple: 'Participe',
  /** Validation d'une case qui n'est pas la dernière. */
  nextSlot: 'Suivant →',
  /** Feedback. */
  correctMessages: ['Bravo !', 'Super !', 'Génial !', 'Yes!', 'Well done!'],
  wellDone: 'Bravo !',
  incorrectMessage: 'Presque ! Voici le verbe :',
  youSaid: 'Tu as dit :',
  youWrote: 'Tu as écrit :',
  hintEyebrow: 'Astuce',
  regularizedHint: 'C’est un verbe irrégulier : pas de -ed !',
  swappedHint: 'Attention à l’ordre : d’abord le prétérit, puis le participe.',
  /** Voix. */
  voiceUseMic: 'Répondre à voix haute',
  voiceHint: 'Dis : go, went, gone',
  voiceNotHeard: "Je n'ai pas bien entendu",
  voiceRestart: 'Recommencer',
  /** Placement (specs §16.8). */
  placementTitle: 'Les verbes irréguliers anglais',
  placementSubtitle:
    'Tu en connais peut-être déjà ! Je te donne un verbe, tu me dis ses deux autres formes. Si tu ne sais pas, ce n’est pas grave.',
  placementStart: 'C’est parti !',
  placementDontKnow: 'Je ne sais pas',
  placementDoneTitle: 'Bravo, tu en connais déjà !',
  placementDoneSubtitle: 'Ils apparaissent déjà sur ton image mystère. On continue avec les autres.',
  placementEmptyTitle: 'C’est parti pour les verbes !',
  placementEmptySubtitle: 'On va les apprendre ensemble, deux par deux.',
  placementDoneCta: 'Commencer',
};
