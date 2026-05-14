import { useState } from 'react';
import type { UserProfile } from '../types';
import BadgeComponent from '../components/Badge';
import BadgeDetailModal from '../components/BadgeDetailModal';
import BackChevron from '../components/BackChevron';
import { ALL_BADGE_DEFINITIONS, getBadgeDetail } from '../lib/badges';

interface BadgesScreenProps {
  profile: UserProfile;
  onBack: () => void;
}

export default function BadgesScreen({ profile, onBack }: BadgesScreenProps) {
  const earnedMap = new Map(profile.badges.map((b) => [b.id, b]));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedDef = selectedId
    ? ALL_BADGE_DEFINITIONS.find((d) => d.id === selectedId) ?? null
    : null;
  const selectedEarned = selectedId ? earnedMap.get(selectedId) : undefined;

  return (
    <div className="badges-screen">
      <div className="badges-header">
        <button className="badges-back-btn" onClick={onBack} aria-label="Retour">
          <BackChevron />
        </button>
        <div className="badges-title">Mes badges</div>
      </div>

      <div className="badges-banner">
        <div className="badges-banner-eyebrow">Collection</div>
        <div className="badges-banner-count">
          {profile.badges.length}
          <span>/ {ALL_BADGE_DEFINITIONS.length} badges</span>
        </div>
      </div>

      <div className="badges-grid">
        {ALL_BADGE_DEFINITIONS.map((def) => {
          const earned = earnedMap.get(def.id);
          const progress = earned ? undefined : getBadgeDetail(def.id, profile).progress;
          return (
            <BadgeComponent
              key={def.id}
              badge={def}
              earned={!!earned}
              earnedDate={earned?.earnedDate}
              progress={progress}
              onClick={() => setSelectedId(def.id)}
            />
          );
        })}
      </div>

      {selectedDef && (
        <BadgeDetailModal
          badge={selectedDef}
          earned={!!selectedEarned}
          earnedDate={selectedEarned?.earnedDate}
          profile={profile}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
