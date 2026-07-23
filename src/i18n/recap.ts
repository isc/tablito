import { useStrings, type Lang } from './lang';

// Joint une liste de nombres avec le « et »/« and » de la langue.
function joinList(nums: number[], conj: string): string {
  if (nums.length <= 1) return nums.join('');
  return nums.slice(0, -1).join(', ') + ` ${conj} ` + nums[nums.length - 1];
}

interface Strings {
  title: string;
  message: (name: string) => string;
  milestoneDivTitle: string;
  milestoneMultTitle: string;
  milestoneDivSubtitle: string;
  milestoneMultSubtitle: string;
  // Niveau 3 : carte de déblocage (fin du niveau 2) et jalon ultime (les 64
  // zones en boîte 5, badge Grand maître de la division).
  milestoneRemUnlockTitle: string;
  milestoneRemUnlockSubtitle: string;
  milestoneRemTitle: string;
  milestoneRemSubtitle: string;
  tableCompleteDivTitle: (tables: number[]) => string;
  tableCompleteMultTitle: (tables: number[]) => string;
  tableCompleteRemTitle: (tables: number[]) => string;
  tableCompleteDivSubtitle: string;
  tableCompleteMultSubtitle: string;
  tableCompleteRemSubtitle: string;
  freezeUsedTitle: string;
  freezeUsedSubtitle: (streak: number) => string;
  freezeEarnedTitle: string;
  freezeEarnedSubtitle: string;
  imageChangedTeaser: string;
  imageChangedCta: string;
  progressEyebrow: string;
  multiplications: string;
  divisions: string;
  remainders: string;
  newBadgeEyebrow: string;
  seeImage: string;
  finish: string;
}

const fr: Strings = {
  title: 'Séance terminée !',
  message: (name) => `Bravo ${name}, tu as bien travaillé.`,
  milestoneDivTitle: 'Tu maîtrises toutes les divisions !',
  milestoneMultTitle: 'Tu débloques les divisions !',
  milestoneDivSubtitle:
    "Tu as révélé toute l'image des divisions — les 64 divisions sont en boîte 5. Un énorme accomplissement. Bravo !",
  milestoneMultSubtitle:
    "Tu connais toutes tes tables ! Tu vas maintenant les réviser autrement : en divisions (comme 56 ÷ 7). Une nouvelle image mystère t'attend.",
  milestoneRemUnlockTitle: 'Tu débloques la division avec reste !',
  milestoneRemUnlockSubtitle:
    "Tu connais toutes tes divisions ! Prochain défi : quand ça ne tombe pas juste (comme 45 ÷ 7 = 6, reste 3). Une nouvelle image mystère t'attend.",
  milestoneRemTitle: 'Tu maîtrises la division avec reste !',
  milestoneRemSubtitle:
    "Tu as révélé toute l'image des divisions avec reste — les 64 cases sont en boîte 5. Le sommet de la division. Bravo !",
  tableCompleteDivTitle: (tables) =>
    `Tu as maîtrisé les divisions par ${joinList(tables, 'et')} !`,
  tableCompleteMultTitle: (tables) =>
    tables.length === 1
      ? `Tu as maîtrisé la table de ${tables[0]} !`
      : `Tu as maîtrisé les tables de ${joinList(tables, 'et')} !`,
  tableCompleteRemTitle: (tables) =>
    `Tu as maîtrisé les divisions avec reste par ${joinList(tables, 'et')} !`,
  tableCompleteDivSubtitle: 'Toutes ces divisions sont en boîte 5.',
  tableCompleteMultSubtitle: 'Toutes les multiplications sont en boîte 5.',
  tableCompleteRemSubtitle: 'Toutes ces divisions avec reste sont en boîte 5.',
  freezeUsedTitle: 'Ton gel a sauvé ta série !',
  freezeUsedSubtitle: (streak) =>
    `Tu n'as pas joué hier, mais ta série de ${streak} ${streak > 1 ? 'jours' : 'jour'} continue.`,
  freezeEarnedTitle: 'Tu as gagné un gel de série !',
  freezeEarnedSubtitle: 'Il te protégera la prochaine fois que tu manqueras un jour.',
  imageChangedTeaser: 'Ton image a changé !',
  imageChangedCta: 'Viens la voir →',
  progressEyebrow: 'Tu connais',
  multiplications: 'multiplications',
  divisions: 'divisions',
  remainders: 'divisions avec reste',
  newBadgeEyebrow: 'Nouveau badge',
  seeImage: 'Voir mon image →',
  finish: 'À demain !',
};

const en: Strings = {
  title: 'Session complete!',
  message: (name) => `Well done ${name}, great work.`,
  milestoneDivTitle: "You've mastered every division!",
  milestoneMultTitle: "You've unlocked division!",
  milestoneDivSubtitle:
    "You've revealed the whole division picture — all 64 divisions are in box 5. A huge achievement. Well done!",
  milestoneMultSubtitle:
    "You know all your times tables! Now you'll review them a new way: as division (like 56 ÷ 7). A new mystery picture is waiting for you.",
  milestoneRemUnlockTitle: "You've unlocked division with remainders!",
  milestoneRemUnlockSubtitle:
    "You know all your divisions! Next challenge: when it doesn't come out even (like 45 ÷ 7 = 6 r 3). A new mystery picture is waiting for you.",
  milestoneRemTitle: "You've mastered division with remainders!",
  milestoneRemSubtitle:
    "You've revealed the whole remainders picture — all 64 squares are in box 5. The summit of division. Well done!",
  tableCompleteDivTitle: (tables) =>
    `You've mastered dividing by ${joinList(tables, 'and')}!`,
  tableCompleteMultTitle: (tables) =>
    tables.length === 1
      ? `You've mastered the ${tables[0]} times table!`
      : `You've mastered the ${joinList(tables, 'and')} times tables!`,
  tableCompleteRemTitle: (tables) =>
    `You've mastered dividing by ${joinList(tables, 'and')} with remainders!`,
  tableCompleteDivSubtitle: 'All of these divisions are in box 5.',
  tableCompleteMultSubtitle: 'Every multiplication is in box 5.',
  tableCompleteRemSubtitle: 'All of these divisions with remainder are in box 5.',
  freezeUsedTitle: 'Your freeze saved your streak!',
  freezeUsedSubtitle: (streak) =>
    `You didn't play yesterday, but your ${streak}-day streak keeps going.`,
  freezeEarnedTitle: 'You earned a streak freeze!',
  freezeEarnedSubtitle: 'It will protect you next time you miss a day.',
  imageChangedTeaser: 'Your picture changed!',
  imageChangedCta: 'Come see it →',
  progressEyebrow: 'You know',
  multiplications: 'multiplications',
  divisions: 'divisions',
  remainders: 'divisions with remainder',
  newBadgeEyebrow: 'New badge',
  seeImage: 'See my picture →',
  finish: 'See you tomorrow!',
};

export const recapStrings: Record<Lang, Strings> = { fr, en };

export function useRecapStrings(): Strings {
  return useStrings(recapStrings);
}
