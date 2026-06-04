export interface ChangelogEntry {
  date: string; // ISO YYYY-MM-DD
  items: string[];
}

// Ordre antéchronologique (plus récent en haut). Les entrées sont écrites
// pour un parent qui consulte la page de temps en temps : on regroupe par
// jour de publication, on ne mentionne pas les détails techniques (refactos,
// CI, lint), seulement ce qui change l'expérience visible côté enfant ou
// parent. Garder court et concret.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-06-02',
    items: [
      "Nouveau niveau 2 — la division : quand l'enfant a maîtrisé toutes ses tables (badge « Génie des maths »), l'app se met à réviser les mêmes faits sous forme de division (56 ÷ 7 = ?), avec sa propre image mystère à dévoiler. Toujours un seul bouton « C'est parti » : l'app choisit la séance du jour — les tables les jours où il reste des faits à réviser, la division le reste du temps. Chaque division n'est proposée qu'une fois la multiplication correspondante bien maîtrisée, et l'appli enseigne l'astuce clé : pour 56 ÷ 7, on cherche « 7 fois combien font 56 ? ».",
    ],
  },
  {
    date: '2026-05-29',
    items: [
      "Nouveau rappel quotidien : activez-le dans l'espace parent (« Rappel quotidien ») pour recevoir chaque jour à 18h une notification qui invite l'enfant à réviser ses tables. Aucun rappel les jours où la séance est déjà faite. Désactivable à tout moment depuis le même endroit. Sur iPhone, il faut d'abord installer Multiplix sur l'écran d'accueil.",
    ],
  },
  {
    date: '2026-05-26',
    items: [
      "Nouveau bouton « Partager l'app » dans l'espace parent : ouvre la feuille de partage du téléphone (iMessage, WhatsApp, mail…) pour envoyer le lien de Multiplix à un autre parent. Sur ordinateur, le lien est copié dans le presse-papiers.",
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
