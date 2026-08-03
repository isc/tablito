import type { ReactNode } from 'react';
import { useStrings } from './lang';

// Strings de l'écran Confidentialité (PrivacyScreen) et de petites chaînes UI
// partagées avec l'écran Nouveautés (ChangelogScreen). Pattern de référence des
// modules i18n : un dico `fr` source, un `en` contraint à la même forme, et un
// hook `useXStrings()` par écran. Les chaînes de prose contiennent du JSX
// (balises <strong>, <code>, espaces insécables) — on les exprime donc comme
// des fonctions renvoyant du ReactNode.

interface PrivacyStrings {
  back: string;
  title: string;
  subtitle: ReactNode;
  onDeviceTitle: string;
  onDeviceBody: ReactNode;
  feedbackTitle: string;
  feedbackIntro: ReactNode;
  feedbackItems: ReactNode[];
  feedbackOutro: ReactNode;
  reminderTitle: string;
  reminderIntro: ReactNode;
  reminderItems: ReactNode[];
  reminderOutro: ReactNode;
  transferTitle: string;
  transferBody: ReactNode;
  watchTitle: string;
  watchBody: ReactNode;
  notCollectedTitle: string;
  notCollectedItems: ReactNode[];
  rightsTitle: string;
  rightsIntro: ReactNode;
  rightsItems: ReactNode[];
  rightsOutro: ReactNode;
  contactTitle: string;
  contactBody: ReactNode;
  updated: string;
}

const fr: PrivacyStrings = {
  back: 'Retour',
  title: 'Confidentialité',
  subtitle: (
    <>
      Tablito est conçu pour respecter la vie privée des enfants. Voici
      exactement ce qui se passe avec les données.
    </>
  ),
  onDeviceTitle: 'Ce qui reste sur cet appareil',
  onDeviceBody: (
    <>
      Le prénom de l'enfant, sa progression (Leitner, badges, séances,
      streak) et ses préférences (son, mode vocal) sont stockés
      localement dans le navigateur (<code>localStorage</code>).
      L'application fonctionne entièrement hors-ligne après le premier
      chargement. Par défaut, rien n'est envoyé sur un serveur : les seules
      exceptions sont déclenchées par vous et décrites ci-dessous (l'envoi
      d'un avis, l'activation du rappel quotidien, le transfert vers un
      autre appareil, et le suivi à distance).
    </>
  ),
  feedbackTitle: "Ce qui est envoyé en cas d'avis",
  feedbackIntro: (
    <>
      Si vous utilisez le bouton <strong>«&nbsp;Envoyer un avis&nbsp;»</strong> du
      dashboard parent, les éléments suivants sortent de l'appareil :
    </>
  ),
  feedbackItems: [
    <>le message que vous écrivez,</>,
    <>l'email si vous en fournissez un (optionnel, pour vous répondre),</>,
    <>
      un contexte anonyme : navigateur, langue, taille d'écran, et
      quelques statistiques agrégées (nombre de séances, faits
      maîtrisés, streak, jours depuis le début).
    </>,
  ],
  feedbackOutro: (
    <>
      Le prénom de l'enfant n'est pas envoyé. Ces données atterrissent
      dans une base Supabase hébergée en Europe, lisible uniquement par
      le responsable du projet.
    </>
  ),
  reminderTitle: 'Ce qui est envoyé si vous activez les notifications',
  reminderIntro: (
    <>
      Les <strong>notifications</strong> (espace parent) sont facultatives, et
      indépendantes l'une de l'autre&nbsp;: le <strong>rappel quotidien</strong> de
      séance, et le <strong>recap hebdomadaire</strong> du suivi à distance. Si
      vous en activez au moins une, l'appareil enregistre un{' '}
      <em>abonnement push</em> dans la même base Supabase&nbsp;:
    </>
  ),
  reminderItems: [
    <>
      un identifiant technique fourni par le navigateur (l'<em>endpoint</em>{' '}
      de notification) et ses clés de chiffrement,
    </>,
    <>le fuseau horaire de l'appareil (pour envoyer à 18&nbsp;h heure locale),</>,
    <>
      la date de la dernière séance, uniquement pour ne pas notifier les
      jours où l'enfant a déjà pratiqué (anti-nag),
    </>,
    <>
      lesquelles des deux notifications sont activées, et la date du dernier
      recap envoyé (pour n'en envoyer qu'un par semaine).
    </>,
  ],
  reminderOutro: (
    <>
      <strong>Le prénom n'est pas envoyé</strong> et les deux messages sont
      génériques — le recap hebdomadaire ne contient d'ailleurs aucun chiffre,
      puisque la progression suivie est chiffrée et illisible par le serveur&nbsp;:
      il annonce qu'un recap est prêt, et c'est l'app qui l'affiche après
      déchiffrement sur votre appareil. Ces informations sont rattachées à l'abonnement (son
      endpoint), pas à une identité. L'envoi des notifications passe par le
      service de notification de votre navigateur (Google, Mozilla ou Apple
      selon le navigateur), comme pour toute notification web. Vous pouvez
      désactiver chaque notification à tout moment depuis son bouton&nbsp;;
      désactiver la dernière supprime l'abonnement de la base.
    </>
  ),
  transferTitle: 'Ce qui est envoyé lors d’un transfert vers un autre appareil',
  transferBody: (
    <>
      Le bouton <strong>«&nbsp;Transférer&nbsp;»</strong> (espace parent,
      section Sauvegarde) dépose le profil, <strong>chiffré sur l'appareil</strong>{' '}
      avant l'envoi, sur la même base Supabase, le temps que le nouvel appareil
      le récupère. La clé de déchiffrement vit uniquement dans le QR code / le
      lien : elle n'est jamais transmise au serveur, qui ne peut donc pas lire
      le contenu. Le dépôt est utilisable une seule fois et s'efface
      automatiquement au bout de 15&nbsp;minutes, récupéré ou non.
    </>
  ),
  watchTitle: 'Ce qui est envoyé si vous activez le suivi à distance',
  watchBody: (
    <>
      Le suivi à distance (espace parent, section «&nbsp;Suivi à
      distance&nbsp;») permet de consulter la progression d'un enfant qui
      pratique sur un autre appareil. Il repose sur le même chiffrement que le
      transfert&nbsp;: après chaque séance, l'appareil de l'enfant dépose un
      instantané de son profil <strong>chiffré sur l'appareil</strong> avant
      l'envoi, et la clé de déchiffrement ne vit que dans le QR code / le lien
      partagé — jamais transmise au serveur, qui ne peut donc pas lire le
      contenu. La différence avec un transfert est la{' '}
      <strong>durée</strong>&nbsp;: là où un transfert s'efface au bout de
      15&nbsp;minutes, un suivi reste déposé et relisible tant qu'il est actif,
      pour que la progression affichée sur l'appareil du parent reste à jour. Le
      bouton «&nbsp;Ne plus partager&nbsp;» supprime immédiatement le dépôt, et un
      suivi qu'aucune séance n'a rafraîchi depuis 6&nbsp;mois est purgé
      automatiquement. Aucune adresse e-mail n'est demandée, et aucun compte n'est
      créé.
    </>
  ),
  notCollectedTitle: "Ce qui n'est pas collecté",
  notCollectedItems: [
    <>Aucun cookie de suivi, aucun analytics tiers.</>,
    <>Aucune publicité, aucun lien externe côté enfant.</>,
    <>Aucun nom de famille, école, adresse, ou donnée sensible.</>,
    <>Aucune donnée vocale n'est enregistrée : le mode vocal utilise l'API du navigateur en local, rien ne sort.</>,
    <>Aucun prénom n'est envoyé, même avec le rappel quotidien activé.</>,
  ],
  rightsTitle: 'Vos droits',
  rightsIntro: <>Depuis le dashboard parent vous pouvez à tout moment :</>,
  rightsItems: [
    <><strong>Exporter</strong> toute la progression au format JSON,</>,
    <><strong>Importer</strong> une sauvegarde.</>,
  ],
  rightsOutro: (
    <>
      Pour supprimer l'intégralité des données, videz les données du site
      dans les réglages de votre navigateur. Pour les avis déjà envoyés,
      demandez la suppression via un nouveau formulaire «&nbsp;Envoyer un avis&nbsp;».
    </>
  ),
  contactTitle: 'Contact',
  contactBody: (
    <>
      Pour toute question ou demande de suppression, utilisez le
      formulaire <strong>«&nbsp;Envoyer un avis&nbsp;»</strong> du dashboard parent.
    </>
  ),
  updated: 'Dernière mise à jour : juillet 2026.',
};

const en: PrivacyStrings = {
  back: 'Back',
  title: 'Privacy',
  subtitle: (
    <>
      Tablito is built to respect children's privacy. Here is exactly what
      happens with the data.
    </>
  ),
  onDeviceTitle: 'What stays on this device',
  onDeviceBody: (
    <>
      The child's first name, their progress (Leitner, badges, sessions,
      streak) and their preferences (sound, voice mode) are stored
      locally in the browser (<code>localStorage</code>). The app works
      entirely offline after the first load. By default, nothing is sent to
      a server: the only exceptions are triggered by you and described below
      (sending feedback, turning on the daily reminder, transferring to
      another device, and remote follow).
    </>
  ),
  feedbackTitle: 'What is sent when you send feedback',
  feedbackIntro: (
    <>
      If you use the <strong>"Send feedback"</strong> button in the parent
      dashboard, the following items leave the device:
    </>
  ),
  feedbackItems: [
    <>the message you write,</>,
    <>your email if you provide one (optional, so we can reply),</>,
    <>
      anonymous context: browser, language, screen size, and a few
      aggregated statistics (number of sessions, mastered facts, streak,
      days since you started).
    </>,
  ],
  feedbackOutro: (
    <>
      The child's first name is not sent. This data lands in a Supabase
      database hosted in Europe, readable only by the project owner.
    </>
  ),
  reminderTitle: 'What is sent if you turn on notifications',
  reminderIntro: (
    <>
      <strong>Notifications</strong> (parent area) are optional, and independent
      of each other: the <strong>daily session reminder</strong>, and the{' '}
      <strong>weekly recap</strong> of remote follow. If you turn on at least one,
      the device records a <em>push subscription</em> in the same Supabase
      database:
    </>
  ),
  reminderItems: [
    <>
      a technical identifier provided by the browser (the notification{' '}
      <em>endpoint</em>) and its encryption keys,
    </>,
    <>the device's time zone (to send at 6&nbsp;pm local time),</>,
    <>
      the date of the last session, only so as not to notify on days when
      the child has already practiced (anti-nag),
    </>,
    <>
      which of the two notifications are on, and the date of the last recap sent
      (so that only one goes out per week).
    </>,
  ],
  reminderOutro: (
    <>
      <strong>The first name is not sent</strong> and both messages are generic —
      the weekly recap carries no figures at all, since the followed progress is
      encrypted and unreadable by the server: it announces that a recap is ready,
      and the app displays it after decrypting on your device. This information is
      tied to the subscription (its endpoint), not to an identity. Notifications are delivered through your
      browser's notification service (Google, Mozilla or Apple depending on
      the browser), as with any web notification. You can turn off each
      notification at any time from its own button; turning off the last one
      removes the subscription from the database.
    </>
  ),
  transferTitle: 'What is sent when transferring to another device',
  transferBody: (
    <>
      The <strong>"Transfer"</strong> button (parent area, Backup section)
      uploads the profile, <strong>encrypted on the device</strong> before
      sending, to the same Supabase database, just long enough for the new
      device to pick it up. The decryption key only lives in the QR code /
      link: it is never sent to the server, which therefore cannot read the
      content. The upload can be used once and deletes itself after
      15&nbsp;minutes, picked up or not.
    </>
  ),
  watchTitle: 'What is sent if you turn on remote follow',
  watchBody: (
    <>
      Remote follow (parent area, "Remote follow" section) lets you check the
      progress of a child practising on another device. It uses the same
      encryption as a transfer: after every session, the child's device uploads a
      snapshot of their profile <strong>encrypted on the device</strong> before
      sending, and the decryption key only lives in the shared QR code / link —
      never sent to the server, which therefore cannot read the content. The
      difference with a transfer is <strong>duration</strong>: where a transfer
      deletes itself after 15&nbsp;minutes, a follow stays uploaded and readable
      as long as it is active, so that the progress shown on the parent's device
      stays up to date. The "Stop sharing" button deletes the upload immediately,
      and a follow that no session has refreshed for 6&nbsp;months is purged
      automatically. No email address is asked for, and no account is created.
    </>
  ),
  notCollectedTitle: 'What is not collected',
  notCollectedItems: [
    <>No tracking cookies, no third-party analytics.</>,
    <>No advertising, no external links on the child's side.</>,
    <>No last name, school, address, or sensitive data.</>,
    <>No voice data is recorded: voice mode uses the browser's API locally, nothing leaves the device.</>,
    <>No first name is sent, even with the daily reminder turned on.</>,
  ],
  rightsTitle: 'Your rights',
  rightsIntro: <>From the parent dashboard you can at any time:</>,
  rightsItems: [
    <><strong>Export</strong> all progress as JSON,</>,
    <><strong>Import</strong> a backup.</>,
  ],
  rightsOutro: (
    <>
      To delete all the data, clear the site data in your browser's
      settings. For feedback already sent, request its deletion via a new
      "Send feedback" form.
    </>
  ),
  contactTitle: 'Contact',
  contactBody: (
    <>
      For any question or deletion request, use the{' '}
      <strong>"Send feedback"</strong> form in the parent dashboard.
    </>
  ),
  updated: 'Last updated: July 2026.',
};

export const privacyStrings = { fr, en };

export function usePrivacyStrings(): PrivacyStrings {
  return useStrings(privacyStrings);
}

// --- Petites chaînes UI de l'écran Nouveautés (ChangelogScreen) ---

interface ChangelogUiStrings {
  back: string;
  title: string;
  subtitle: string;
}

const changelogUiFr: ChangelogUiStrings = {
  back: 'Retour',
  title: 'Nouveautés',
  subtitle: 'Les changements récents de Tablito.',
};

const changelogUiEn: ChangelogUiStrings = {
  back: 'Back',
  title: "What's new",
  subtitle: 'Recent changes to Tablito.',
};

export const changelogUiStrings = { fr: changelogUiFr, en: changelogUiEn };

export function useChangelogUiStrings(): ChangelogUiStrings {
  return useStrings(changelogUiStrings);
}
