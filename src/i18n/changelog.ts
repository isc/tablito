import type { Lang } from './lang';
import type { ChangelogEntry } from '../lib/changelog';

// Données de la page « Nouveautés », language-aware. Les dates sont identiques
// dans les deux langues (ordre antéchronologique, plus récent en haut) ; seuls
// les `items` sont traduits. Le `fr` est la source historique (déplacée
// verbatim depuis lib/changelog.ts), le `en` en est la traduction destinée au
// parent (anglais adulte clair). Consommé par lib/changelog.ts via getLang().

const fr: ChangelogEntry[] = [
  {
    date: '2026-07-20',
    items: [
      "Espace parent : la liste « Faits les plus difficiles » oubliait les erreurs commises pendant les révisions bonus (les questions ajoutées pour compléter une séance courte). Le taux de bonnes réponses pouvait montrer des séances imparfaites alors que presque aucune erreur n'était listée. La liste reflète désormais toutes les erreurs des dernières séances, révisions bonus comprises.",
    ],
  },
  {
    date: '2026-07-01',
    items: [
      "Changement de téléphone simplifié : l'espace parent propose un bouton « Transférer » (section Sauvegarde). Un QR code s'affiche, on le scanne avec l'appareil photo du nouveau téléphone, et la progression s'y installe toute seule — fini le copier-coller de la sauvegarde. Sur iPhone, scannez plutôt le QR depuis l'app : écran d'accueil → « Déjà une progression ? » → « Scanner le QR de l'ancien appareil ». Le transfert est chiffré de bout en bout, valable 15 minutes et utilisable une seule fois. L'export/import classique reste disponible.",
    ],
  },
  {
    date: '2026-06-21',
    items: [
      "Les gels de série protègent désormais plusieurs jours d'absence consécutifs : chaque gel couvre un jour manqué, donc avec 2 gels en réserve une série survit à 2 jours d'absence d'affilée (avant, un seul jour était couvert et la série cassait dès le deuxième). La séance de retour consomme les gels en silence et le récap célèbre l'événement.",
    ],
  },
  {
    date: '2026-06-15',
    items: [
      "Image mystère qui ne se complétait jamais entièrement : les faits les plus difficiles (typiquement 7×9, 8×9, 9×9) pouvaient n'être jamais proposés à l'apprentissage, laissant quelques cases définitivement vides en bas de l'image — surtout si l'enfant butait sur la table de 9. Désormais ces derniers faits finissent toujours par être introduits, et l'image peut être dévoilée jusqu'au bout.",
    ],
  },
  {
    date: '2026-06-14',
    items: [
      "Tablito parle désormais anglais : l'interface est disponible en français et en anglais. La langue suit celle de l'appareil au premier lancement, et se change à tout moment dans l'espace parent (« Langue de l'application »). Tout est traduit — écrans, règles, badges, astuces — et même la voix : les questions et explications sont lues en anglais quand cette langue est choisie.",
    ],
  },
  {
    date: '2026-06-11',
    items: [
      "Plusieurs enfants sur le même appareil : l'espace parent propose désormais « Ajouter un enfant » (section Profils). Chaque enfant a son propre profil — progression, badges, série et images mystère séparés. Dès deux profils, l'app demande « Qui joue ? » au lancement, et un bouton en haut de l'accueil permet de changer de joueur à tout moment. Les profils existants sont conservés tels quels.",
    ],
  },
  {
    date: '2026-06-10',
    items: [
      "L'app s'appelle désormais Tablito (auparavant Multiplix) et vit à la nouvelle adresse tablito.app. C'est elle qu'il faut utiliser et partager désormais.",
    ],
  },
  {
    date: '2026-06-05',
    items: [
      "Nouveau niveau 2 — la division : quand l'enfant a décroché ses 8 badges de tables (de 2 à 9), l'app se met à réviser les mêmes faits sous forme de division (56 ÷ 7 = ?), avec sa propre image mystère à dévoiler. Toujours un seul bouton « C'est parti » : la séance du jour devient la division, et les quelques tables à réviser pour l'entretien y sont glissées au passage. Les divisions arrivent progressivement, et l'appli enseigne l'astuce clé : pour 56 ÷ 7, on cherche « 7 fois combien font 56 ? » (7 × ? = 56).",
    ],
  },
  {
    date: '2026-05-29',
    items: [
      "Nouveau rappel quotidien : activez-le dans l'espace parent (« Rappel quotidien ») pour recevoir chaque jour à 18h une notification qui invite l'enfant à réviser ses tables. Aucun rappel les jours où la séance est déjà faite. Désactivable à tout moment depuis le même endroit. Sur iPhone, il faut d'abord installer Tablito sur l'écran d'accueil.",
    ],
  },
  {
    date: '2026-05-26',
    items: [
      "Nouveau bouton « Partager l'app » dans l'espace parent : ouvre la feuille de partage du téléphone (iMessage, WhatsApp, mail…) pour envoyer le lien de Tablito à un autre parent. Sur ordinateur, le lien est copié dans le presse-papiers.",
    ],
  },
  {
    date: '2026-05-25',
    items: [
      "Étoile dorée corrigée : elle ne s'allumait pas vraiment selon la rapidité (bug d'origine). Désormais, une bonne réponse rapide affiche l'étoile avec ses rayons, une bonne réponse lente affiche l'étoile seule. Le signal visuel reflète enfin ce qui se passe en coulisse : seule une réponse rapide fait monter la boîte.",
      "Mode voix : le seuil de réponse rapide passe à 3 s (au lieu de 5 s, hérité du mode clavier). En clavier on reste à 5 s pour absorber le surcoût du pavé numérique. Avant, en voix, l'enfant pouvait monter de boîte avec une réponse à 4 s qui ne reflète pas la maîtrise.",
      "Badge Véloce : se décroche désormais après 5 étoiles dorées d'affilée dans une séance — au lieu de \"5 réponses sous 2 s\", un seuil qui n'apparaissait nulle part ailleurs et que les bonus reviews bien plus rapides masquaient partiellement.",
    ],
  },
  {
    date: '2026-05-22',
    items: [
      "Test de placement : les multiplications ratées (mauvaise réponse ou « Je ne sais pas ») ne sont plus introduites en douce via les autres résultats. Quand l'enfant rate 4×7 mais réussit 5×8, l'appli n'en déduit plus qu'il connaît 4×7 — ce fait sera proposé plus tard, avec son écran d'astuce, plutôt que de surgir sans préavis dans une séance.",
    ],
  },
  {
    date: '2026-05-19',
    items: [
      "Test de placement plus juste : les questions sont posées de la plus facile à la plus difficile, et le test s'arrête après 3 ratés consécutifs (« Je ne sais pas » compris). Un enfant qui maîtrise les tables faciles n'est plus mis à l'épreuve sur les ×7/×8/×9 inconnus, et les premières séances ne sont plus saturées de multiplications hors de son niveau.",
      "Nouveau bouton « Réinitialiser le profil » dans l'espace parent : efface les données et relance le test de placement. Utile pour recommencer à zéro ou changer d'enfant.",
    ],
  },
  {
    date: '2026-05-16',
    items: [
      "Gels de série : l'enfant gagne automatiquement un gel (❄️) tous les 7 jours d'affilée (2 max en réserve). Quand il manque un jour, le gel sauve la série en silence à la séance suivante — le récap célèbre l'événement. Plus de gros zéro après une seule journée d'absence.",
    ],
  },
  {
    date: '2026-05-13',
    items: [
      "Nouvelle règle bonus « ×11 » dans l'écran Règles : quand toutes les tables de 2 à 9 sont maîtrisées, l'enfant découvre l'astuce « il suffit de répéter le chiffre » (3×11 = 33, 7×11 = 77…). Pastille « Nouveau » discrète sur le bouton Règles le jour du déblocage.",
    ],
  },
  {
    date: '2026-05-08',
    items: [
      "Les deux derniers faits (8×9 et 9×9) ne sont plus bloqués par un planning de révision chargé : un slot leur est désormais réservé en fin de parcours, même quand 15+ révisions sont dues le même jour.",
      "Reconnaissance vocale plus fluide en séance : le micro reste actif toute la séance (moins de bips iOS).",
    ],
  },
  {
    date: '2026-05-06',
    items: [
      "Deux nouveaux badges intermédiaires pour combler le « désert » entre les badges du début et la maîtrise complète d'une table : « Première case révélée » (1ère multiplication passée en boîte 4) et « Première multiplication maîtrisée » (1ère en boîte 5). Ils se débloquent au moment où l'image mystère change visiblement de finesse pour la première fois.",
    ],
  },
  {
    date: '2026-05-01',
    items: [
      "Les badges « Table de N » tombent plus vite quand l'enfant a réussi le test de placement : un fait inféré à partir d'une réponse rapide démarre désormais en boîte 3 (et plus en boîte 2), reconnaissant la maîtrise déjà démontrée.",
    ],
  },
  {
    date: '2026-04-30',
    items: [
      "Les deux derniers faits (8×9 et 9×9) sont désormais bien introduits en fin de parcours, même si certains autres faits sont retombés en boîte 1.",
      "La pill « série » de l'écran d'accueil affiche maintenant l'état réel : si plusieurs jours sans séance complète, elle passe à « On s'y remet ? » au lieu de garder figée la dernière valeur.",
    ],
  },
  {
    date: '2026-04-29',
    items: [
      "Page « Nouveautés » accessible depuis l'espace parent (la voici).",
      "Le test de placement reconnaît maintenant les faits faciles déjà connus à partir des plus durs : 2×2, 2×3, etc. ne restent plus comme « non introduits » quand l'enfant a réussi des multiplications difficiles.",
      "Si le mode vocal est activé, la permission micro est demandée dès le premier tap après le lancement de l'app, plutôt qu'en pleine séance.",
    ],
  },
  {
    date: '2026-04-28',
    items: [
      "Le splash screen iOS n'affiche plus un carré indigo aux bords droits — un médaillon circulaire à la place.",
      "La séance redevient disponible automatiquement après minuit sans avoir à fermer l'app.",
      "Le feedback de fin de question peut maintenant scroller en mode paysage.",
    ],
  },
  {
    date: '2026-04-27',
    items: [
      "Possibilité de basculer entre clavier et micro pendant une séance, sans quitter.",
      "Modale détaillée au tap sur la pill de streak (jours d'affilée).",
      "Modale détaillée pour les badges, avec conditions et progression.",
      "L'écran ne s'éteint plus pendant une séance.",
      "Animation des règles d'introduction (×10) calée sur la voix.",
    ],
  },
  {
    date: '2026-04-25',
    items: [
      "Splash screens iOS pour iPhone et iPad.",
      "Landing marketing pour faciliter l'installation PWA depuis Safari.",
      "Page Confidentialité accessible depuis l'espace parent.",
      "Sous-titres explicatifs et liens « ? » vers le guide dans le dashboard parent.",
    ],
  },
];

const en: ChangelogEntry[] = [
  {
    date: '2026-07-20',
    items: [
      'Parent area: the "Hardest facts" list was missing mistakes made during bonus reviews (the extra questions added to fill out a short session). The accuracy chart could show imperfect sessions while almost no mistakes were listed. The list now reflects every mistake from recent sessions, bonus reviews included.',
    ],
  },
  {
    date: '2026-07-01',
    items: [
      'Switching phones made simple: the parent area now offers a "Transfer" button (Backup section). A QR code appears, you scan it with the new phone\'s camera, and the progress installs itself there — no more copy-pasting the backup. On iPhone, scan the QR from within the app instead: welcome screen → "Already have progress?" → "Scan the old device\'s QR code". The transfer is end-to-end encrypted, valid for 15 minutes and usable only once. The classic export/import remains available.',
    ],
  },
  {
    date: '2026-06-21',
    items: [
      'Streak freezes now protect several consecutive days off: each freeze covers one missed day, so with 2 freezes in reserve a streak survives 2 days off in a row (before, only a single day was covered and the streak broke on the second). The comeback session quietly spends the freezes and the recap celebrates it.',
    ],
  },
  {
    date: '2026-06-15',
    items: [
      'Mystery picture that never fully completed: the hardest facts (typically 7×9, 8×9, 9×9) could end up never being offered for learning, leaving a few tiles permanently blank at the bottom of the picture — especially if your child got stuck on the 9 times table. Now these last facts always get introduced eventually, and the picture can be revealed all the way.',
    ],
  },
  {
    date: '2026-06-14',
    items: [
      'Tablito now speaks English: the interface is available in both French and English. The language follows your device on first launch, and can be changed at any time in the parent area ("App language"). Everything is translated — screens, rules, badges, hints — and even the voice: questions and explanations are read aloud in English when that language is selected.',
    ],
  },
  {
    date: '2026-06-11',
    items: [
      'Several children on the same device: the parent area now offers "Add a child" (Profiles section). Each child has their own profile — separate progress, badges, streak and mystery pictures. As soon as there are two profiles, the app asks "Who\'s playing?" at launch, and a button at the top of the home screen lets you switch player at any time. Existing profiles are kept as they are.',
    ],
  },
  {
    date: '2026-06-10',
    items: [
      'The app is now called Tablito (previously Multiplix) and lives at its new address tablito.app. That is the one to use and share from now on.',
    ],
  },
  {
    date: '2026-06-05',
    items: [
      'New level 2 — division: once the child has earned their 8 times-table badges (from 2 to 9), the app starts reviewing the same facts as divisions (56 ÷ 7 = ?), with its own mystery picture to reveal. Still a single "Let\'s go" button: the day\'s session becomes division, and the few tables due for maintenance are slipped in along the way. Divisions arrive gradually, and the app teaches the key trick: for 56 ÷ 7, you look for "7 times what makes 56?" (7 × ? = 56).',
    ],
  },
  {
    date: '2026-05-29',
    items: [
      'New daily reminder: turn it on in the parent area ("Daily reminder") to get a notification every day at 6 pm inviting the child to review their tables. No reminder on days when the session is already done. Can be turned off at any time from the same place. On iPhone, you first need to install Tablito on the home screen.',
    ],
  },
  {
    date: '2026-05-26',
    items: [
      'New "Share the app" button in the parent area: it opens the phone\'s share sheet (iMessage, WhatsApp, email…) to send the Tablito link to another parent. On a computer, the link is copied to the clipboard.',
    ],
  },
  {
    date: '2026-05-25',
    items: [
      'Golden star fixed: it did not actually light up based on speed (an original bug). Now, a fast correct answer shows the star with its rays, a slow correct answer shows the star alone. The visual signal finally reflects what happens behind the scenes: only a fast answer moves the box up.',
      'Voice mode: the fast-answer threshold drops to 3 s (instead of 5 s, inherited from keyboard mode). In keyboard mode we keep 5 s to absorb the overhead of the number pad. Before, in voice mode, a child could move up a box with a 4 s answer that does not reflect mastery.',
      'Speedy badge: now earned after 5 golden stars in a row within a session — instead of "5 answers under 2 s", a threshold that appeared nowhere else and that the much faster bonus reviews partly masked.',
    ],
  },
  {
    date: '2026-05-22',
    items: [
      'Placement test: missed multiplications (wrong answer or "I don\'t know") are no longer quietly introduced via other results. When the child misses 4×7 but gets 5×8 right, the app no longer concludes that they know 4×7 — that fact will be offered later, with its tip screen, rather than popping up unannounced in a session.',
    ],
  },
  {
    date: '2026-05-19',
    items: [
      'Fairer placement test: questions are asked from easiest to hardest, and the test stops after 3 misses in a row ("I don\'t know" included). A child who has mastered the easy tables is no longer tested on the unknown ×7/×8/×9, and the first sessions are no longer flooded with multiplications above their level.',
      'New "Reset profile" button in the parent area: it erases the data and restarts the placement test. Useful for starting over or switching child.',
    ],
  },
  {
    date: '2026-05-16',
    items: [
      'Streak freezes: the child automatically earns a freeze (❄️) every 7 days in a row (2 max in reserve). When they miss a day, the freeze quietly saves the streak at the next session — the recap celebrates the event. No more big zero after a single day off.',
    ],
  },
  {
    date: '2026-05-13',
    items: [
      'New bonus "×11" rule in the Rules screen: once all the tables from 2 to 9 are mastered, the child discovers the trick "just repeat the digit" (3×11 = 33, 7×11 = 77…). A discreet "New" badge appears on the Rules button on the day it unlocks.',
    ],
  },
  {
    date: '2026-05-08',
    items: [
      'The last two facts (8×9 and 9×9) are no longer blocked by a busy review schedule: a slot is now reserved for them at the end of the journey, even when 15+ reviews are due on the same day.',
      'Smoother voice recognition during a session: the microphone stays active for the whole session (fewer iOS beeps).',
    ],
  },
  {
    date: '2026-05-06',
    items: [
      'Two new intermediate badges to fill the "desert" between the early badges and full mastery of a table: "First tile revealed" (1st multiplication moved to box 4) and "First multiplication mastered" (1st in box 5). They unlock at the moment the mystery picture visibly sharpens for the first time.',
    ],
  },
  {
    date: '2026-05-01',
    items: [
      'The "N times table" badges come faster when the child has passed the placement test: a fact inferred from a fast answer now starts in box 3 (no longer box 2), recognizing the mastery already shown.',
    ],
  },
  {
    date: '2026-04-30',
    items: [
      'The last two facts (8×9 and 9×9) are now properly introduced at the end of the journey, even if some other facts have fallen back to box 1.',
      'The "streak" pill on the home screen now shows the real state: if there have been several days without a full session, it switches to "Shall we get back to it?" instead of keeping the last value frozen.',
    ],
  },
  {
    date: '2026-04-29',
    items: [
      'A "What\'s new" page is accessible from the parent area (this one).',
      'The placement test now recognizes easy facts already known based on the harder ones: 2×2, 2×3, etc. no longer stay marked as "not introduced" when the child has succeeded at difficult multiplications.',
      'If voice mode is enabled, microphone permission is requested on the very first tap after launching the app, rather than mid-session.',
    ],
  },
  {
    date: '2026-04-28',
    items: [
      'The iOS splash screen no longer shows an indigo square with straight edges — a circular medallion instead.',
      'The session becomes available again automatically after midnight without having to close the app.',
      'The end-of-question feedback can now scroll in landscape mode.',
    ],
  },
  {
    date: '2026-04-27',
    items: [
      'You can now switch between keyboard and microphone during a session, without leaving.',
      'A detailed dialog when tapping the streak pill (days in a row).',
      'A detailed dialog for badges, with conditions and progress.',
      'The screen no longer turns off during a session.',
      'The intro rules animation (×10) is synced to the voice.',
    ],
  },
  {
    date: '2026-04-25',
    items: [
      'iOS splash screens for iPhone and iPad.',
      'A marketing landing page to make PWA installation from Safari easier.',
      'A Privacy page accessible from the parent area.',
      'Explanatory subtitles and "?" links to the guide in the parent dashboard.',
    ],
  },
];

export const changelogData: Record<Lang, ChangelogEntry[]> = { fr, en };
