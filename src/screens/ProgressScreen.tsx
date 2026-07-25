import { useState } from 'react';
import type { UserProfile } from '../types';
import MysteryImage from '../components/MysteryImage';
import DivisionMysteryImage from '../components/DivisionMysteryImage';
import RemainderMysteryImage from '../components/RemainderMysteryImage';
import BackChevron from '../components/BackChevron';
import { isDivisionUnlocked, isRemainderUnlocked } from '../lib/badges';
import { useProgressScreenStrings } from '../i18n/progress';

type ProgressView = 'mult' | 'div' | 'rem';

interface ProgressScreenProps {
  profile: UserProfile;
  onBack: () => void;
  // Onglet ouvert par défaut : l'image du niveau actif (depuis le récap d'une
  // séance, on ouvre directement sur l'image correspondante).
  initialView?: ProgressView;
}

export default function ProgressScreen({ profile, onBack, initialView = 'mult' }: ProgressScreenProps) {
  const t = useProgressScreenStrings();
  const divUnlocked = isDivisionUnlocked(profile);
  const remUnlocked = isRemainderUnlocked(profile);
  const [view, setView] = useState<ProgressView>(() => {
    if (initialView === 'rem' && !remUnlocked) return 'mult';
    if (initialView === 'div' && !divUnlocked) return 'mult';
    return initialView;
  });

  const divFacts = profile.divisionFacts ?? [];
  const remFacts = profile.remainderFacts ?? [];
  const showDiv = divUnlocked && view === 'div';
  const showRem = remUnlocked && view === 'rem';

  const facts = showRem ? remFacts : showDiv ? divFacts : profile.facts;
  const introduced = facts.filter((f) => f.introduced).length;
  const mastered = facts.filter((f) => f.box >= 4).length;
  const total = facts.length;

  const tabs: Array<{ key: ProgressView; label: string }> = [
    { key: 'mult' as const, label: t.multiplications },
    { key: 'div' as const, label: t.divisions },
    ...(remUnlocked ? [{ key: 'rem' as const, label: t.remainders }] : []),
  ];

  return (
    <div className="progress-screen">
      <div className="progress-header">
        <button className="progress-back-btn" onClick={onBack} aria-label={t.back}>
          <BackChevron />
        </button>
        <div className="progress-title">{divUnlocked ? t.myPictures : t.myMysteryPicture}</div>
      </div>

      {divUnlocked && (
        <div className="progress-tabs" role="tablist">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`progress-tab ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="progress-stats-summary">
        <div className="progress-stat">
          <div className="progress-stat-value">{introduced}</div>
          <div className="progress-stat-label">
            {showDiv || showRem ? t.discoveredDiv : t.discoveredMult}
          </div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{mastered}</div>
          <div className="progress-stat-label">
            {showDiv || showRem ? t.masteredDiv : t.masteredMult}
          </div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{total}</div>
          <div className="progress-stat-label">{t.total}</div>
        </div>
      </div>

      {showRem ? (
        <RemainderMysteryImage
          facts={remFacts}
          theme={profile.remainderMysteryTheme ?? profile.mysteryTheme}
        />
      ) : showDiv ? (
        <DivisionMysteryImage facts={divFacts} theme={profile.divisionMysteryTheme ?? profile.mysteryTheme} />
      ) : (
        <MysteryImage facts={profile.facts} theme={profile.mysteryTheme} />
      )}

      <div className="progress-legend">
        {showRem ? t.legendRem : showDiv ? t.legendDiv : t.legendMult}
      </div>
    </div>
  );
}
