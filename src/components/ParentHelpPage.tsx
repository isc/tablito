// Page « Aide et infos » de l'espace parent : ce qui concerne l'app elle-même
// plutôt que l'enfant ou l'appareil — et qu'on ouvre rarement.

import { useState } from 'react';
import type { UserProfile } from '../types';
import type { FeedbackSource } from '../lib/feedback';
import { useGuideBase } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import FeedbackModal from './FeedbackModal';
import { SettingList, SettingRow } from './ParentSettingRow';

interface ParentHelpPageProps {
  // Le profil que l'avis joint : celui qu'on REGARDE sur l'accueil, pas celui
  // de l'appareil. Un parent qui signale un souci depuis l'onglet de son enfant
  // suivi à distance parle de l'enfant, et joindre son propre profil rendait
  // l'avis indébuggable (vécu : « 12 divisions bloquées » impossible à
  // reproduire faute du bon historique).
  //
  // null pendant « Récupération… » : surtout pas de repli sur le profil local,
  // qui serait joint sous un libellé nommant l'enfant distant. FeedbackModal
  // masque alors la case — l'avis part sans historique, ce qui est vrai.
  feedbackProfile: UserProfile | null;
  feedbackSource: FeedbackSource;
  onShowChangelog: () => void;
  onShowPrivacy: () => void;
}

export default function ParentHelpPage({
  feedbackProfile,
  feedbackSource,
  onShowChangelog,
  onShowPrivacy,
}: ParentHelpPageProps) {
  const t = useParentDashboardStrings();
  const guideBase = useGuideBase();
  const { copied, copy } = useCopyFeedback();
  // Ici et non dans l'espace parent : la fenêtre se referme avec la page, par
  // quelque chemin qu'on la quitte (geste retour compris).
  const [showFeedback, setShowFeedback] = useState(false);

  const handleShareApp = async () => {
    const url = window.location.origin + import.meta.env.BASE_URL;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tablito', text: t.shareText, url });
      } catch {
        // Annulation utilisateur : pas de repli sur le presse-papiers, sinon on
        // copierait un lien que l'utilisateur a explicitement refusé de partager.
      }
      return;
    }
    await copy(url);
  };

  return (
    <div className="parent-section">
      <SettingList>
        <SettingRow title={t.userGuide} sub={t.guideSubtitle} href={guideBase} />
        <SettingRow title={t.sendFeedback} sub={t.feedbackSubtitle} onClick={() => setShowFeedback(true)} />
        <SettingRow
          title={t.shareTablito}
          sub={copied ? t.linkCopied : t.shareSubtitle}
          onClick={() => void handleShareApp()}
        />
        <SettingRow title={t.whatsNew} onClick={onShowChangelog} />
        <SettingRow title={t.privacy} onClick={onShowPrivacy} />
      </SettingList>
      {showFeedback && (
        <FeedbackModal
          profile={feedbackProfile}
          source={feedbackSource}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
