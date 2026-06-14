import type { BadgeDefinition } from '../lib/badges';
import { getBadgeDetail, medallionColorFor, progressPercent } from '../lib/badges';
import type { UserProfile } from '../types';
import Modal from './Modal';
import { useBadgeDetailStrings } from '../i18n/progress';

interface BadgeDetailModalProps {
  badge: BadgeDefinition;
  earned: boolean;
  earnedDate?: string;
  profile: UserProfile;
  onClose: () => void;
}

export default function BadgeDetailModal({
  badge,
  earned,
  earnedDate,
  profile,
  onClose,
}: BadgeDetailModalProps) {
  const t = useBadgeDetailStrings();
  const hintFor = (current: number, remaining: number): string => {
    if (current === 0) return t.hintNotStarted;
    if (remaining === 1) return t.hintOneLeft;
    if (remaining <= 3) return t.hintFewLeft(remaining);
    return t.hintMoreLeft(remaining);
  };
  const detail = getBadgeDetail(badge.id, profile);
  const color = earned ? medallionColorFor(badge.id) : 'var(--ink-muted)';
  const progress = detail.progress;
  // Badge à objectif unique (target === 1) : pas de fraction « 0 / 1 » ni de
  // barre — il n'y a rien à compter. Le texte de condition suffit, on ajoute
  // juste un encouragement.
  const showProgress = !earned && progress && progress.target > 1;
  const showCallToAction = !earned && progress && progress.target === 1;
  const percent = showProgress ? progressPercent(progress) : 0;
  const remaining = progress ? Math.max(0, progress.target - progress.current) : 0;

  return (
    <Modal onClose={onClose} labelledBy="badge-detail-title" className="badge-detail-modal">
      <div
        className={`badge-detail-medallion ${earned ? 'earned' : 'locked'}`}
        style={{ '--medallion-color': color } as React.CSSProperties}
      >
        {badge.icon}
      </div>

      <h2 id="badge-detail-title" className="badge-detail-title">
        {badge.name}
      </h2>

      <p className="badge-detail-condition">{detail.conditionText}</p>

      {showProgress && (
        <div className="badge-detail-progress">
          <div className="badge-detail-progress-bar">
            <div
              className="badge-detail-progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="badge-detail-progress-label">
            {progress.current} / {progress.target} {progress.unitLabel}
          </div>
          <div className="badge-detail-hint">{hintFor(progress.current, remaining)}</div>
        </div>
      )}

      {showCallToAction && (
        <p className="badge-detail-hint badge-detail-cta">{t.callToAction}</p>
      )}

      {earned && earnedDate && (
        <div className="badge-detail-earned">
          <span className="badge-detail-earned-check" aria-hidden="true">✓</span>
          {t.unlockedOn(
            new Date(earnedDate).toLocaleDateString(t.dateLocale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          )}
        </div>
      )}

      <button type="button" className="modal-close-btn" onClick={onClose}>
        {t.close}
      </button>
    </Modal>
  );
}
