// Toggle « Recap hebdomadaire » — la contrepartie parent du rappel quotidien.
//
// Vit dans la section « Suivi à distance » et non à côté du rappel quotidien,
// pour deux raisons : il n'a de sens que si cet appareil suit au moins un enfant
// (sinon il n'y a aucun recap à annoncer), et sur un appareil purement suiveur
// NotificationSettings n'est jamais rendu — il est conditionné au profil local.
//
// La notification elle-même reste GÉNÉRIQUE : le serveur ne peut pas lire le
// prénom de l'enfant, l'instantané étant chiffré de bout en bout. Elle dit
// qu'un recap est prêt et ouvre l'espace parent, qui déchiffre localement.

import { pushConfigured, pushSupported } from '../lib/push';
import { isIOS, isStandalone } from '../lib/install';
import { useWeeklyRecapStrings } from '../i18n/parent';
import { usePushPref } from '../hooks/usePushPref';
import PushToggle from './PushToggle';

export default function WeeklyRecapSettings() {
  const t = useWeeklyRecapStrings();
  const { enabled, busy, message, toggle } = usePushPref('weekly', t);

  if (!pushConfigured) return null;

  if (!pushSupported()) {
    // Même règle que le rappel quotidien : on n'explique que le cas iOS non
    // installé, seul cas réparable par l'utilisateur.
    if (!(isIOS() && !isStandalone())) return null;
    return <p className="parent-section-subtitle">{t.iosInstallSubtitle}</p>;
  }

  return (
    <div className="parent-watch-block">
      <p className="parent-section-subtitle">{t.subtitle}</p>
      <PushToggle
        enabled={enabled}
        busy={busy}
        message={message}
        onToggle={toggle}
        onLabel={t.enabled}
        offLabel={t.enable}
      />
    </div>
  );
}
