import type { UserProfile } from '../types';
import FlameIcon from './FlameIcon';
import Modal from './Modal';
import {
  getActiveStreak,
  isStreakProtectedByFreeze,
  STREAK_FREEZE_INTERVAL,
} from '../lib/streak';
import { todayISO } from '../lib/utils';
import { useStreakDetailStrings } from '../i18n/progress';

interface StreakDetailModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export default function StreakDetailModal({ profile, onClose }: StreakDetailModalProps) {
  const t = useStreakDetailStrings();
  const today = todayISO();
  const streak = getActiveStreak(profile, today);
  const record = profile.longestStreak;
  const active = streak > 0;
  const doneToday = profile.lastSessionDate === today;
  const showRecord = record > streak;
  const freezes = profile.streakFreezes;
  const protectedByFreeze = isStreakProtectedByFreeze(profile, today);

  const title = active ? t.titleActive(streak) : t.titleInactive;

  let explanation: string;
  if (!active) {
    explanation = t.explanationInactive;
  } else if (protectedByFreeze) {
    explanation = t.explanationFreeze;
  } else if (doneToday) {
    explanation = t.explanationDoneToday;
  } else {
    explanation = t.explanationActive;
  }

  return (
    <Modal onClose={onClose} labelledBy="streak-detail-title" className="streak-detail-modal">
      <div className={`streak-detail-flame ${active ? '' : 'is-muted'}`}>
        <FlameIcon size={64} muted={!active} />
      </div>

      <h2 id="streak-detail-title" className="streak-detail-title">
        {title}
      </h2>

      <p className="streak-detail-explanation">{explanation}</p>

      {showRecord && (
        <div className="streak-detail-record">
          <span className="streak-detail-record-label">{t.recordLabel}</span>
          <span className="streak-detail-record-value">
            {t.recordValue(record)}
          </span>
        </div>
      )}

      <div className="streak-detail-freezes">
        <div className="streak-detail-freezes-row">
          <span className="streak-detail-freezes-icon" aria-hidden="true">❄️</span>
          <span className="streak-detail-freezes-label">
            {freezes === 0 ? t.noFreezes : t.freezesCount(freezes)}
          </span>
        </div>
        <p className="streak-detail-freezes-explanation">
          {t.freezeExplanation(STREAK_FREEZE_INTERVAL)}
        </p>
      </div>

      <button type="button" className="modal-close-btn" onClick={onClose}>
        {t.close}
      </button>
    </Modal>
  );
}
