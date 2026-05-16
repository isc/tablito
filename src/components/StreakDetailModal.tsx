import type { UserProfile } from '../types';
import FlameIcon from './FlameIcon';
import Modal from './Modal';
import {
  getActiveStreak,
  isStreakProtectedByFreeze,
  STREAK_FREEZE_INTERVAL,
} from '../lib/streak';
import { todayISO, pluralize } from '../lib/utils';

interface StreakDetailModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export default function StreakDetailModal({ profile, onClose }: StreakDetailModalProps) {
  const today = todayISO();
  const streak = getActiveStreak(profile, today);
  const record = profile.longestStreak;
  const active = streak > 0;
  const doneToday = profile.lastSessionDate === today;
  const showRecord = record > streak;
  const freezes = profile.streakFreezes;
  const protectedByFreeze = isStreakProtectedByFreeze(profile, today);

  const title = active
    ? `${streak} ${pluralize(streak, 'jour')} d’affilée`
    : 'Lance une nouvelle série !';

  let explanation: string;
  if (!active) {
    explanation = 'Ta série de jours d’affilée est à zéro. Tes progrès sur les multiplications sont conservés : joue aujourd’hui pour repartir.';
  } else if (protectedByFreeze) {
    explanation = 'Tu n’as pas joué hier, mais un de tes gels protège ta série. Joue aujourd’hui pour le consommer et la prolonger.';
  } else if (doneToday) {
    explanation = 'Bravo, ta séance d’aujourd’hui est faite ! Reviens demain pour faire +1.';
  } else {
    explanation = 'Ta série est encore active. N’oublie pas de faire ta séance aujourd’hui pour la prolonger — sinon elle repartira à zéro demain.';
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
          <span className="streak-detail-record-label">Ton record</span>
          <span className="streak-detail-record-value">
            {record} {pluralize(record, 'jour')}
          </span>
        </div>
      )}

      <div className="streak-detail-freezes">
        <div className="streak-detail-freezes-row">
          <span className="streak-detail-freezes-icon" aria-hidden="true">❄️</span>
          <span className="streak-detail-freezes-label">
            {freezes === 0
              ? 'Aucun gel pour le moment'
              : `${freezes} ${pluralize(freezes, 'gel')} de série`}
          </span>
        </div>
        <p className="streak-detail-freezes-explanation">
          Un gel sauve ta série si tu manques un jour. Tu en gagnes un tous les {STREAK_FREEZE_INTERVAL} jours d’affilée.
        </p>
      </div>

      <button type="button" className="modal-close-btn" onClick={onClose}>
        Fermer
      </button>
    </Modal>
  );
}
