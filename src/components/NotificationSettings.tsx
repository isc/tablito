import { useState, useEffect, useCallback } from 'react';
import {
  pushConfigured,
  pushSupported,
  isSubscribed,
  subscribeToReminders,
  unsubscribeFromReminders,
} from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';

interface NotificationSettingsProps {
  childName: string;
}

// Section « Rappel quotidien » de l'espace parent : un simple toggle on/off.
// L'heure (18h locale) est fixe côté serveur (cf. scripts/send-reminders.mjs) ;
// pas de sélecteur d'heure. La source de vérité de l'état activé/désactivé est
// la subscription du navigateur (isSubscribed), pas le profil — on la
// réconcilie au montage pour gérer une permission révoquée hors de l'app.
export default function NotificationSettings({ childName }: NotificationSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        const res = await subscribeToReminders(childName);
        if (res === 'subscribed') {
          setEnabled(true);
        } else if (res === 'denied') {
          setMessage(
            'Notifications bloquées. Autorise-les dans les réglages de ton navigateur, puis réessaie.',
          );
        } else {
          setMessage("Impossible d'activer le rappel pour le moment. Réessaie plus tard.");
        }
      }
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, childName]);

  if (!pushConfigured) return null;

  // Non supporté : le seul cas qui mérite une explication est iOS pas encore
  // installé. Ailleurs (vieux navigateur desktop), on masque la section.
  if (!supported) {
    if (!iosNeedsInstall) return null;
    return (
      <div className="parent-section">
        <h3>Rappel quotidien</h3>
        <p className="parent-section-subtitle">
          Pour recevoir un petit rappel chaque jour à 18h, installe d'abord Multiplix
          sur l'écran d'accueil (menu Partager de Safari → « Sur l'écran d'accueil »).
        </p>
      </div>
    );
  }

  return (
    <div className="parent-section">
      <h3>Rappel quotidien</h3>
      <p className="parent-section-subtitle">
        Une notification chaque jour à 18h pour penser à réviser les tables
        (jamais les jours où la séance est déjà faite).
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
        <span className="notif-toggle-label">{enabled ? 'Activé' : 'Activer le rappel'}</span>
        <span className={`notif-switch ${enabled ? 'notif-switch--on' : ''}`} aria-hidden="true">
          <span className="notif-switch-knob" />
        </span>
      </button>
      {message && <p className="notif-message">{message}</p>}
    </div>
  );
}
