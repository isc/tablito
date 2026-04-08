import { useEffect, useRef } from 'react';
import type { SessionResult, Badge as BadgeType } from '../types';
import Mascot from '../components/Mascot';
import Badge from '../components/Badge';
import { useSound } from '../hooks/useSound';
import { useConfetti } from '../hooks/useConfetti';
import './RecapScreen.css';

interface RecapScreenProps {
  result: SessionResult;
  newBadges: BadgeType[];
  newlyCompletedTables: number[];
  mascotLevel: number;
  previousMascotLevel: number;
  onFinish: () => void;
}

function getEncouragingMessage(result: SessionResult): string {
  const ratio = result.correctCount / result.questionsCount;

  if (ratio >= 0.9) {
    return 'Incroyable ! Tu es une vraie championne !';
  }
  if (ratio >= 0.7) {
    return 'Très bien ! Tu progresses super bien !';
  }
  if (ratio >= 0.5) {
    return "C'est bien ! Continue comme ça !";
  }
  return "Bravo pour tes efforts ! Chaque essai te rend plus forte !";
}

function getStarCount(result: SessionResult): number {
  const ratio = result.correctCount / result.questionsCount;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}

export default function RecapScreen({
  result,
  newBadges,
  newlyCompletedTables,
  mascotLevel,
  previousMascotLevel,
  onFinish,
}: RecapScreenProps) {
  const starCount = getStarCount(result);
  const message = getEncouragingMessage(result);
  const { playBadge, playLevelUp } = useSound();
  const { triggerConfetti } = useConfetti();
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    const leveledUp = mascotLevel > previousMascotLevel;

    if (newlyCompletedTables.length > 0) {
      playLevelUp();
      triggerConfetti();
    } else if (leveledUp) {
      playLevelUp();
      triggerConfetti();
    } else if (newBadges.length > 0) {
      playBadge();
      triggerConfetti();
    } else if (starCount >= 3) {
      triggerConfetti();
    }
  }, [mascotLevel, previousMascotLevel, newBadges.length, newlyCompletedTables.length, starCount, playBadge, playLevelUp, triggerConfetti]);
  const mascotMood =
    newlyCompletedTables.length > 0
      ? 'celebrate'
      : starCount >= 3
        ? 'celebrate'
        : starCount >= 2
          ? 'happy'
          : 'idle';

  return (
    <div className="recap-screen">
      {newlyCompletedTables.length > 0 && (
        <div className="recap-table-complete">
          <div className="recap-table-complete-icon">
            {newlyCompletedTables.length === 1 ? '\u2B50' : '\u{1F31F}'}
          </div>
          <div className="recap-table-complete-title">
            {newlyCompletedTables.length === 1
              ? `Tu as maîtrisé la table de ${newlyCompletedTables[0]}\u202F!`
              : `Tu as maîtrisé les tables de ${newlyCompletedTables.join(' et ')}\u202F!`}
          </div>
          <div className="recap-table-complete-subtitle">
            Tous les faits sont en boîte 5 !
          </div>
        </div>
      )}

      <Mascot level={mascotLevel} mood={mascotMood as 'celebrate' | 'happy' | 'idle'} size="normal" />

      <div className="recap-title">Séance terminée !</div>

      <div className="recap-score">
        <div className="recap-score-number">
          {result.correctCount}/{result.questionsCount}
        </div>
        <div className="recap-score-label">bonnes réponses</div>
      </div>

      <div className="recap-stars">
        {Array.from({ length: 3 }, (_, i) => (
          <span
            key={i}
            className="recap-star"
            style={{
              animationDelay: `${i * 0.2}s`,
              opacity: i < starCount ? 1 : 0.2,
            }}
          >
            {i < starCount ? '\u2B50' : '\u2606'}
          </span>
        ))}
      </div>

      <div className="recap-message">{message}</div>

      <div className="recap-stats">
        {result.newFactsIntroduced > 0 && (
          <div className="recap-stat">
            <div className="recap-stat-value">{result.newFactsIntroduced}</div>
            <div>nouveau{result.newFactsIntroduced > 1 ? 'x' : ''}</div>
          </div>
        )}
        {result.factsPromoted > 0 && (
          <div className="recap-stat">
            <div className="recap-stat-value">{result.factsPromoted}</div>
            <div>progrès</div>
          </div>
        )}
      </div>

      {newBadges.length > 0 && (
        <div className="recap-badges">
          {newBadges.map((badge, i) => (
            <div
              key={badge.id}
              className="recap-new-badge"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <Badge badge={badge} earned earnedDate={badge.earnedDate} />
            </div>
          ))}
        </div>
      )}

      <button className="recap-btn" onClick={onFinish}>
        À demain !
      </button>
    </div>
  );
}
