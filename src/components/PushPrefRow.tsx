// Ligne d'une notification des réglages de l'espace parent : un interrupteur.
// Deux notifications indépendantes l'emploient (cf. ParentSettingsList) :
//
// - le RAPPEL QUOTIDIEN (`daily`) s'adresse à l'ENFANT, sur l'appareil où il
//   pratique. L'heure (18h locale) est fixe côté serveur (cf.
//   scripts/send-reminders.mjs) ; pas de sélecteur d'heure.
// - le RECAP DU DIMANCHE (`weekly`) en est la contrepartie parent, sur un
//   appareil qui suit au moins un enfant. La notification reste GÉNÉRIQUE : le
//   serveur ne peut pas lire le prénom de l'enfant, l'instantané étant chiffré
//   de bout en bout. Elle dit qu'un recap est prêt et ouvre l'espace parent, qui
//   déchiffre localement.
//
// La source de vérité est la préférence enregistrée pour cet appareil (cf.
// usePushPref), réconciliée au montage pour gérer une permission révoquée hors
// de l'app.

import type { ReactNode } from 'react';
import { pushConfigured, pushSupported, type PushPrefs } from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';
import { useStrings, type Lang } from '../i18n/lang';
import type { PushPrefStrings } from '../i18n/parent';
import { usePushPref } from '../hooks/usePushPref';
import { SettingRow, SwitchRow } from './ParentSettingRow';

interface PushPrefRowProps {
  pref: keyof PushPrefs;
  icon: ReactNode;
  strings: Record<Lang, PushPrefStrings>;
}

export default function PushPrefRow({ pref, icon, strings }: PushPrefRowProps) {
  const t = useStrings(strings);
  const { enabled, busy, message, toggle } = usePushPref(pref, t);

  if (!pushConfigured) return null;

  // Non supporté : le seul cas qui mérite une explication est iOS pas encore
  // installé, seul cas réparable par l'utilisateur. Ailleurs (vieux navigateur
  // desktop), on masque la ligne.
  if (!pushSupported()) {
    if (!(isIOS() && !isStandalone())) return null;
    return <SettingRow icon={icon} title={t.title} sub={t.iosInstallSubtitle} />;
  }

  return (
    <SwitchRow
      icon={icon}
      title={t.title}
      sub={t.subtitle}
      enabled={enabled}
      busy={busy}
      message={message}
      onToggle={toggle}
    />
  );
}
