import { pushConfigured, pushSupported } from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';
import { useNotificationSettingsStrings } from '../i18n/parent';
import { usePushPref } from '../hooks/usePushPref';
import PushToggle from './PushToggle';

// Section « Rappel quotidien » de l'espace parent : un simple toggle on/off.
// L'heure (18h locale) est fixe côté serveur (cf. scripts/send-reminders.mjs) ;
// pas de sélecteur d'heure. La source de vérité est la préférence enregistrée
// pour cet appareil (cf. usePushPref), réconciliée au montage pour gérer une
// permission révoquée hors de l'app.
//
// Ce rappel s'adresse à l'ENFANT, sur l'appareil où il pratique. Le recap
// hebdomadaire destiné au parent est un autre toggle, dans la section « Suivi à
// distance » (WeeklyRecapSettings) — les deux sont indépendants.
export default function NotificationSettings() {
  const t = useNotificationSettingsStrings();
  const { enabled, busy, message, toggle } = usePushPref('daily', t);

  const supported = pushSupported();
  // Push web sur iOS : seulement en PWA installée (iOS 16.4+).
  const iosNeedsInstall = isIOS() && !isStandalone();

  if (!pushConfigured) return null;

  // Non supporté : le seul cas qui mérite une explication est iOS pas encore
  // installé. Ailleurs (vieux navigateur desktop), on masque la section.
  if (!supported) {
    if (!iosNeedsInstall) return null;
    return (
      <div className="parent-section">
        <h3>{t.dailyReminder}</h3>
        <p className="parent-section-subtitle">{t.iosInstallSubtitle}</p>
      </div>
    );
  }

  return (
    <div className="parent-section">
      <h3>{t.dailyReminder}</h3>
      <p className="parent-section-subtitle">{t.reminderSubtitle}</p>
      <PushToggle
        enabled={enabled}
        busy={busy}
        message={message}
        onToggle={toggle}
        onLabel={t.enabled}
        offLabel={t.enableReminder}
      />
    </div>
  );
}
