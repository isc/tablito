import { useEffect, useRef } from 'react';
import type { SessionResult, Badge as BadgeType } from '../types';
import { BADGE_IDS } from '../types';
import Mascot from '../components/Mascot';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useConfetti } from '../hooks/useConfetti';
import { pluralize } from '../lib/utils';

interface RecapScreenProps {
  name: string;
  result: SessionResult;
  newBadges: BadgeType[];
  newlyCompletedTables: number[];
  currentStreak: number;
  freezeJustUsed: boolean;
  freezeJustEarned: boolean;
  knownFactsCount: number;
  totalFacts: number;
  onFinish: () => void;
  onShowProgress: () => void;
  // 'div' pour une séance de division : change le nom affiché et le badge de
  // complétion d'image surveillé (specs §11). Défaut 'mult'.
  mode?: 'mult' | 'div';
}

function ImageCardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="var(--sage)" strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.6" fill="var(--sage)" />
      <path d="M4 17 L 10 11 L 14 14 L 20 9" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function FreezeCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="recap-card recap-freeze">
      <div className="recap-freeze-icon" aria-hidden="true">❄️</div>
      <div className="recap-freeze-text">
        <div className="recap-freeze-title">{title}</div>
        <div className="recap-freeze-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <svg width="160" height="60" viewBox="0 0 160 60" aria-hidden="true" className="recap-confetti">
      <path d="M20 35 Q 30 12 40 28 Q 50 6 60 24 Q 70 2 80 22 Q 90 0 100 20 Q 110 -2 120 18 Q 130 0 140 16" stroke="var(--honey)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="35" r="2.5" fill="var(--coral)" />
      <circle cx="60" cy="24" r="2.5" fill="var(--indigo)" />
      <circle cx="120" cy="18" r="2.5" fill="var(--sage)" />
    </svg>
  );
}

export default function RecapScreen({
  name,
  result,
  newBadges,
  newlyCompletedTables,
  currentStreak,
  freezeJustUsed,
  freezeJustEarned,
  knownFactsCount,
  totalFacts,
  onFinish,
  onShowProgress,
  mode = 'mult',
}: RecapScreenProps) {
  const { playBadge, playTableComplete, playImageComplete } = useSound();
  const { speak } = useTTS();
  const { triggerConfetti } = useConfetti();
  const hasPlayedRef = useRef(false);

  const noun = mode === 'div' ? 'divisions' : 'multiplications';
  const completionBadgeId = mode === 'div' ? BADGE_IDS.DIV_GENIE : BADGE_IDS.GENIE_MATHS;
  const imageJustCompleted = newBadges.some((b) => b.id === completionBadgeId);
  const imageChanged = result.factsPromoted > 0;

  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    if (imageJustCompleted) {
      playImageComplete();
      triggerConfetti();
    } else if (newlyCompletedTables.length > 0) {
      playTableComplete();
      triggerConfetti();
    } else if (newBadges.length > 0) {
      playBadge();
      triggerConfetti();
    }
  }, [imageJustCompleted, newBadges, newlyCompletedTables, playBadge, playImageComplete, playTableComplete, triggerConfetti]);

  useEffect(() => {
    speak('recap-done');
  }, [speak]);

  const mascotMood =
    imageJustCompleted || newlyCompletedTables.length > 0
      ? 'celebrate'
      : newBadges.length > 0
        ? 'happy'
        : 'idle';

  const progressPct = Math.max(0, Math.min(1, knownFactsCount / Math.max(totalFacts, 1))) * 100;

  return (
    <div className="recap-screen">
      <div className="recap-head">
        <Confetti />
        <div className="recap-mascot-wrap">
          <Mascot mood={mascotMood} />
        </div>
        <div className="recap-title">Séance terminée&nbsp;!</div>
        <div className="recap-message">Bravo {name}, tu as bien travaillé.</div>
      </div>

      {/* Déblocage de la division : la séance qui complète l'image des tables
          (badge Génie des maths) révèle le niveau 2. Une seule fois. */}
      {mode === 'mult' && imageJustCompleted && (
        <div className="recap-card recap-division-unlock">
          <div className="recap-division-unlock-icon" aria-hidden="true">➗</div>
          <div className="recap-division-unlock-text">
            <div className="recap-division-unlock-title">Tu débloques les divisions&nbsp;!</div>
            <div className="recap-division-unlock-subtitle">
              Tu connais toutes tes tables&nbsp;! Tu vas maintenant les réviser
              autrement : en divisions (comme 56&nbsp;÷&nbsp;7). Une nouvelle image
              mystère t'attend.
            </div>
          </div>
        </div>
      )}

      {newlyCompletedTables.length > 0 && (
        <div className="recap-card recap-table-complete">
          <div className="recap-table-complete-title">
            {newlyCompletedTables.length === 1
              ? `Tu as maîtrisé la table de ${newlyCompletedTables[0]} !`
              : `Tu as maîtrisé les tables de ${newlyCompletedTables.join(' et ')} !`}
          </div>
          <div className="recap-table-complete-subtitle">
            Toutes les multiplications sont en boîte 5.
          </div>
        </div>
      )}

      {freezeJustUsed && (
        <FreezeCard
          title="Ton gel a sauvé ta série !"
          subtitle={`Tu n'as pas joué hier, mais ta série de ${currentStreak} ${pluralize(currentStreak, 'jour')} continue.`}
        />
      )}

      {freezeJustEarned && (
        <FreezeCard
          title="Tu as gagné un gel de série !"
          subtitle="Il te protégera la prochaine fois que tu manqueras un jour."
        />
      )}

      {imageChanged && (
        <button className="recap-card recap-image-link" onClick={onShowProgress}>
          <div className="recap-image-link-icon">
            <ImageCardIcon />
          </div>
          <div className="recap-image-link-text">
            <div className="recap-image-link-teaser">Ton image a changé&nbsp;!</div>
            <div className="recap-image-link-cta">Viens la voir →</div>
          </div>
        </button>
      )}

      <div className="recap-card recap-progress-card">
        <div className="recap-progress-row">
          <span className="recap-progress-eyebrow">Tu connais</span>
          <span className="recap-progress-count">
            <b>{knownFactsCount}</b> / {totalFacts} {noun}
          </span>
        </div>
        <div className="recap-progress-bar">
          <div className="recap-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {newBadges.length > 0 && (
        <div className="recap-new-badges">
          {newBadges.map((badge) => (
            <div key={badge.id} className="recap-card recap-new-badge">
              <div className="recap-new-badge-medallion">{badge.icon}</div>
              <div>
                <div className="recap-new-badge-eyebrow">Nouveau badge</div>
                <div className="recap-new-badge-name">{badge.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!imageChanged && (
        <button className="recap-image-link-plain" onClick={onShowProgress}>
          Voir mon image →
        </button>
      )}

      <button className="recap-btn" onClick={onFinish}>
        À demain&nbsp;!
      </button>
    </div>
  );
}
