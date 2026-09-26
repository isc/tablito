// Ligne « Recap du dimanche » — la contrepartie parent du rappel quotidien.
//
// N'est rendue que si cet appareil suit au moins un enfant (sinon il n'y a
// aucun recap à annoncer), y compris sur un appareil purement suiveur, où le
// rappel quotidien, lui, n'apparaît pas — il est lié à un profil local.
//
// La notification elle-même reste GÉNÉRIQUE : le serveur ne peut pas lire le
// prénom de l'enfant, l'instantané étant chiffré de bout en bout. Elle dit
// qu'un recap est prêt et ouvre l'espace parent, qui déchiffre localement.

import { pushConfigured, pushSupported } from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';
import { useWeeklyRecapStrings } from '../i18n/parent';
import { usePushPref } from '../hooks/usePushPref';
import { SettingRow, SwitchRow } from './ParentSettingRow';
import { CalendarIcon } from './ParentSettingIcons';

export default function WeeklyRecapSettings() {
  const t = useWeeklyRecapStrings();
  const { enabled, busy, message, toggle } = usePushPref('weekly', t);

  if (!pushConfigured) return null;

  if (!pushSupported()) {
    // Même règle que le rappel quotidien : on n'explique que le cas iOS non
    // installé, seul cas réparable par l'utilisateur.
    if (!(isIOS() && !isStandalone())) return null;
    return <SettingRow icon={<CalendarIcon />} title={t.title} sub={t.iosInstallSubtitle} />;
  }

  return (
    <SwitchRow
      icon={<CalendarIcon />}
      title={t.title}
      sub={t.subtitle}
      enabled={enabled}
      busy={busy}
      message={message}
      onToggle={toggle}
    />
  );
}
