// Page « Aide et infos » de l'espace parent : ce qui concerne l'app elle-même
// plutôt que l'enfant ou l'appareil — et qu'on ouvre rarement.

import { useGuideBase } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { SettingRow } from './ParentSettingRow';

interface ParentHelpPageProps {
  onFeedback: () => void;
  onShowChangelog: () => void;
  onShowPrivacy: () => void;
}

export default function ParentHelpPage({ onFeedback, onShowChangelog, onShowPrivacy }: ParentHelpPageProps) {
  const t = useParentDashboardStrings();
  const guideBase = useGuideBase();
  const { copied, copy } = useCopyFeedback();

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
      <div className="parent-card parent-card--list">
        <ul className="parent-settings">
          <SettingRow title={t.userGuide} sub={t.guideSubtitle} href={guideBase} />
          <SettingRow title={t.sendFeedback} sub={t.feedbackSubtitle} onClick={onFeedback} />
          <SettingRow
            title={t.shareTablito}
            sub={copied ? t.linkCopied : t.shareSubtitle}
            onClick={() => void handleShareApp()}
          />
          <SettingRow title={t.whatsNew} onClick={onShowChangelog} />
          <SettingRow title={t.privacy} onClick={onShowPrivacy} />
        </ul>
      </div>
    </div>
  );
}
