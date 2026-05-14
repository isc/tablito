import { medallionColorFor, progressPercent } from '../lib/badges';

interface BadgeProps {
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string;
  };
  earned: boolean;
  earnedDate?: string;
  progress?: { current: number; target: number };
  onClick?: () => void;
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="badge-lock" aria-hidden="true">
      <rect x="3" y="6" width="6" height="5" rx="1" fill="currentColor" />
      <path d="M4 6 L 4 4.5 C 4 3, 5 2.5, 6 2.5 C 7 2.5, 8 3, 8 4.5 L 8 6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function Badge({ badge, earned, earnedDate, progress, onClick }: BadgeProps) {
  const color = earned ? medallionColorFor(badge.id) : 'var(--ink-muted)';
  const showProgress = !earned && progress && progress.target > 0;
  const percent = showProgress ? progressPercent(progress) : 0;
  const label = earned
    ? `${badge.name}, débloqué — voir les détails`
    : showProgress
      ? `${badge.name}, verrouillé, progression ${percent}% — voir comment le débloquer`
      : `${badge.name}, verrouillé — voir comment le débloquer`;
  return (
    <button
      type="button"
      className={`badge ${earned ? 'earned' : 'locked'}`}
      onClick={onClick}
      aria-label={label}
    >
      <div
        className="badge-medallion"
        style={{ '--medallion-color': color } as React.CSSProperties}
      >
        {badge.icon}
      </div>
      <div className="badge-name">{badge.name}</div>
      {earned && earnedDate ? (
        <div className="badge-date">
          {new Date(earnedDate).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
          })}
        </div>
      ) : showProgress ? (
        <div className="badge-progress" aria-hidden="true">
          <div className="badge-progress-bar">
            <div className="badge-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="badge-progress-label">
            {progress.current}/{progress.target}
          </div>
        </div>
      ) : (
        <div className="badge-date">—</div>
      )}
      {!earned && <LockIcon />}
    </button>
  );
}
