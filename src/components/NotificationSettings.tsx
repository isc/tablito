import { useState, useEffect, useCallback } from 'react';
import {
  pushConfigured,
  pushSupported,
  isSubscribed,
  subscribeToReminders,
  unsubscribeFromReminders,
} from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';
import { useNotificationSettingsStrings } from '../i18n/parent';

// Section « Rappel quotidien » de l'espace parent : un simple toggle on/off.
// L'heure (18h locale) est fixe côté serveur (cf. scripts/send-reminders.mjs) ;
// pas de sélecteur d'heure. La source de vérité de l'état activé/désactivé est
// la subscription du navigateur (isSubscribed), pas le profil — on la
// réconcilie au montage pour gérer une permission révoquée hors de l'app.
export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const t = useNotificationSettingsStrings();

  const supported = pushSupported();
  // Push web sur iOS : seulement en PWA installée (iOS 16.4+).
  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    let cancelled = false;
    isSubscribed().then((v) => {
      if (!cancelled) setEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (enabled) {
        await unsubscribeFromReminders();
        setEnabled(false);
      } else {
        const res = await subscribeToReminders();
        if (res === 'subscribed') {
          setEnabled(true);
        } else if (res === 'denied') {
          setMessage(t.blocked);
        } else {
          setMessage(t.unavailable);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, t]);

  if (!pushConfigured) return null;

  // Non supporté : le seul cas qui mérite une explication est iOS pas encore
  // installé. Ailleurs (vieux navigateur desktop), on masque la section.
  if (!supported) {
    if (!iosNeedsInstall) return null;
    return (
      <div className="parent-section">
        <h3>{t.dailyReminder}</h3>
        <p className="parent-section-subtitle">
          {t.iosInstallSubtitle}
        </p>
      </div>
    );
  }

  return (
    <div className="parent-section">
      <h3>{t.dailyReminder}</h3>
      <p className="parent-section-subtitle">
        {t.reminderSubtitle}
      </p>
      <button
        type="button"
        className="notif-toggle"
        role="switch"
        aria-checked={enabled}
        aria-busy={busy}
        disabled={busy}
        onClick={handleToggle}
      >
        <span className="notif-toggle-label">{enabled ? t.enabled : t.enableReminder}</span>
        <span className={`notif-switch ${enabled ? 'notif-switch--on' : ''}`} aria-hidden="true">
          <span className="notif-switch-knob" />
        </span>
      </button>
      {message && <p className="notif-message">{message}</p>}
    </div>
  );
}
