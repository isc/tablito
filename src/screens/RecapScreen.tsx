import { useEffect, useRef } from 'react';
import type { SessionResult, Badge as BadgeType } from '../types';
import { BADGE_IDS } from '../types';
import Mascot from '../components/Mascot';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useConfetti } from '../hooks/useConfetti';
import { useRecapStrings } from '../i18n/recap';
import { badgeName, medallionColorFor } from '../lib/badges';

interface RecapScreenProps {
  name: string;
  result: SessionResult;
  newBadges: BadgeType[];
  newlyCompletedTables: number[];
  // Mode mult uniquement : le 8e badge de table vient de tomber → déblocage du
  // niveau 2 division. Découplé de « Génie de la multiplication » (boîte 5
  // partout), qui reste un trophée décroché plus tard, pendant le niveau 2.
  divisionJustUnlocked: boolean;
  // Mode div uniquement : le 8e badge « Divisions par N » vient de tomber →
  // déblocage du niveau 3 (division avec reste). Même logique, translatée
  // d'un niveau (specs §12.3).
  remainderJustUnlocked?: boolean;
  currentStreak: number;
  freezeJustUsed: boolean;
  freezeJustEarned: boolean;
  knownFactsCount: number;
  totalFacts: number;
  onFinish: () => void;
  onShowProgress: () => void;
  // 'div'/'rem' selon la séance : change le nom affiché et le jalon surveillé
  // (specs §11, §12). Défaut 'mult'.
  mode?: 'mult' | 'div' | 'rem';
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
  divisionJustUnlocked,
  remainderJustUnlocked = false,
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
  const t = useRecapStrings();
  const hasPlayedRef = useRef(false);

  const noun = mode === 'rem' ? t.remainders : mode === 'div' ? t.divisions : t.multiplications;
  // Jalon majeur de la séance, par mode :
  // — mult : déblocage du niveau 2 (8e badge de table). PAS « Génie » : Génie
  //   (boîte 5 partout) arrive plus tard, pendant le niveau 2, et n'affiche
  //   qu'une carte « Nouveau badge » classique ;
  // — div : déblocage du niveau 3 (8e badge « Divisions par N »), sinon
  //   « Maître de la division » (toutes les divisions en boîte 5) ;
  // — rem : « Grand maître de la division » (les 64 zones en boîte 5, image
  //   complète — le jalon ultime du parcours).
  const milestone =
    mode === 'rem'
      ? newBadges.some((b) => b.id === BADGE_IDS.REM_GENIE)
        ? { icon: '👑', title: t.milestoneRemTitle, subtitle: t.milestoneRemSubtitle }
        : null
      : mode === 'div'
        ? remainderJustUnlocked
          ? { icon: '🧮', title: t.milestoneRemUnlockTitle, subtitle: t.milestoneRemUnlockSubtitle }
          : newBadges.some((b) => b.id === BADGE_IDS.DIV_GENIE)
            ? { icon: '🎓', title: t.milestoneDivTitle, subtitle: t.milestoneDivSubtitle }
            : null
        : divisionJustUnlocked
          ? { icon: '➗', title: t.milestoneMultTitle, subtitle: t.milestoneMultSubtitle }
          : null;
  const milestoneReached = milestone !== null;
  const imageChanged = result.factsPromoted > 0;

  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    if (milestoneReached) {
      playImageComplete();
      triggerConfetti();
    } else if (newlyCompletedTables.length > 0) {
      playTableComplete();
      triggerConfetti();
    } else if (newBadges.length > 0) {
      playBadge();
      triggerConfetti();
    }
  }, [milestoneReached, newBadges, newlyCompletedTables, playBadge, playImageComplete, playTableComplete, triggerConfetti]);

  useEffect(() => {
    speak('recap-done');
  }, [speak]);

  const mascotMood =
    milestoneReached || newlyCompletedTables.length > 0
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
        <div className="recap-title">{t.title}</div>
        <div className="recap-message">{t.message(name)}</div>
      </div>

      {/* Carte « jalon » du niveau (déblocage du niveau suivant ou complétion
          d'image) — même carte, contenu et teinte par mode, cf. `milestone`. */}
      {milestone && (
        <div className={`recap-card recap-milestone recap-milestone--${mode}`}>
          <div className="recap-milestone-icon" aria-hidden="true">
            {milestone.icon}
          </div>
          <div className="recap-milestone-text">
            <div className="recap-milestone-title">{milestone.title}</div>
            <div className="recap-milestone-subtitle">{milestone.subtitle}</div>
          </div>
        </div>
      )}

      {newlyCompletedTables.length > 0 && (
        <div className="recap-card recap-table-complete">
          <div className="recap-table-complete-title">
            {mode === 'rem'
              ? t.tableCompleteRemTitle(newlyCompletedTables)
              : mode === 'div'
                ? t.tableCompleteDivTitle(newlyCompletedTables)
                : t.tableCompleteMultTitle(newlyCompletedTables)}
          </div>
          <div className="recap-table-complete-subtitle">
            {mode === 'rem'
              ? t.tableCompleteRemSubtitle
              : mode === 'div'
                ? t.tableCompleteDivSubtitle
                : t.tableCompleteMultSubtitle}
          </div>
        </div>
      )}

      {freezeJustUsed && (
        <FreezeCard title={t.freezeUsedTitle} subtitle={t.freezeUsedSubtitle(currentStreak)} />
      )}

      {freezeJustEarned && (
        <FreezeCard title={t.freezeEarnedTitle} subtitle={t.freezeEarnedSubtitle} />
      )}

      {imageChanged && (
        <button className="recap-card recap-image-link" onClick={onShowProgress}>
          <div className="recap-image-link-icon">
            <ImageCardIcon />
          </div>
          <div className="recap-image-link-text">
            <div className="recap-image-link-teaser">{t.imageChangedTeaser}</div>
            <div className="recap-image-link-cta">{t.imageChangedCta}</div>
          </div>
        </button>
      )}

      <div className="recap-card recap-progress-card">
        <div className="recap-progress-row">
          <span className="recap-progress-eyebrow">{t.progressEyebrow}</span>
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
              <div
                className="medallion recap-new-badge-medallion"
                style={{ '--medallion-color': medallionColorFor(badge.id) } as React.CSSProperties}
              >
                {badge.icon}
              </div>
              <div>
                <div className="recap-new-badge-eyebrow">{t.newBadgeEyebrow}</div>
                <div className="recap-new-badge-name">{badgeName(badge.id)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!imageChanged && (
        <button className="recap-image-link-plain" onClick={onShowProgress}>
          {t.seeImage}
        </button>
      )}

      <button className="recap-btn" onClick={onFinish}>
        {t.finish}
      </button>
    </div>
  );
}
