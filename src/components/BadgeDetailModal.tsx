import type { BadgeDefinition } from '../lib/badges';
import { getBadgeDetail, medallionColorFor, progressPercent } from '../lib/badges';
import type { UserProfile } from '../types';
import Modal from './Modal';

interface BadgeDetailModalProps {
  badge: BadgeDefinition;
  earned: boolean;
  earnedDate?: string;
  profile: UserProfile;
  onClose: () => void;
}

function hintFor(current: number, remaining: number): string {
  if (current === 0) return 'Tu n’as pas encore commencé celui-ci. À toi de jouer !';
  if (remaining === 1) return 'Plus qu’un seul ! Tu y es presque.';
  if (remaining <= 3) return `Plus que ${remaining} ! Tu y es presque.`;
  return `Encore ${remaining} pour le débloquer.`;
}

export default function BadgeDetailModal({
  badge,
  earned,
  earnedDate,
  profile,
  onClose,
}: BadgeDetailModalProps) {
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
        <p className="badge-detail-hint badge-detail-cta">À toi de jouer !</p>
      )}

      {earned && earnedDate && (
        <div className="badge-detail-earned">
          <span className="badge-detail-earned-check" aria-hidden="true">✓</span>
          Débloqué le{' '}
          {new Date(earnedDate).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      )}

      <button type="button" className="modal-close-btn" onClick={onClose}>
        Fermer
      </button>
    </Modal>
  );
}
