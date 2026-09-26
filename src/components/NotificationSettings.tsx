import { pushConfigured, pushSupported } from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';
import { useNotificationSettingsStrings } from '../i18n/parent';
import { usePushPref } from '../hooks/usePushPref';
import { SettingRow, SwitchRow } from './ParentSettingRow';
import { BellIcon } from './ParentSettingIcons';

// Ligne « Rappel quotidien » des réglages de l'espace parent : un interrupteur.
// L'heure (18h locale) est fixe côté serveur (cf. scripts/send-reminders.mjs) ;
// pas de sélecteur d'heure. La source de vérité est la préférence enregistrée
// pour cet appareil (cf. usePushPref), réconciliée au montage pour gérer une
// permission révoquée hors de l'app.
//
// Ce rappel s'adresse à l'ENFANT, sur l'appareil où il pratique. Le recap
// hebdomadaire destiné au parent est une autre ligne (WeeklyRecapSettings) —
// les deux sont indépendants.
export default function NotificationSettings() {
  const t = useNotificationSettingsStrings();
  const { enabled, busy, message, toggle } = usePushPref('daily', t);

  if (!pushConfigured) return null;

  // Non supporté : le seul cas qui mérite une explication est iOS pas encore
  // installé. Ailleurs (vieux navigateur desktop), on masque la ligne.
  if (!pushSupported()) {
    if (!(isIOS() && !isStandalone())) return null;
    return <SettingRow icon={<BellIcon />} title={t.dailyReminder} sub={t.iosInstallSubtitle} />;
  }

  return (
    <SwitchRow
      icon={<BellIcon />}
      title={t.dailyReminder}
      sub={t.reminderSubtitle}
      enabled={enabled}
      busy={busy}
      message={message}
      onToggle={toggle}
    />
  );
}
