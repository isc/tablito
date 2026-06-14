import { useState } from 'react';
import type { UserProfile } from '../types';
import BadgeComponent from '../components/Badge';
import BadgeDetailModal from '../components/BadgeDetailModal';
import BackChevron from '../components/BackChevron';
import { visibleBadgeDefinitions, getBadgeDetail } from '../lib/badges';
import { useBadgesScreenStrings } from '../i18n/progress';

interface BadgesScreenProps {
  profile: UserProfile;
  onBack: () => void;
}

export default function BadgesScreen({ profile, onBack }: BadgesScreenProps) {
  const t = useBadgesScreenStrings();
  const earnedMap = new Map(profile.badges.map((b) => [b.id, b]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const badgeDefinitions = visibleBadgeDefinitions(profile);

  const selectedDef = selectedId
    ? badgeDefinitions.find((d) => d.id === selectedId) ?? null
    : null;
  const selectedEarned = selectedId ? earnedMap.get(selectedId) : undefined;

  return (
    <div className="badges-screen">
      <div className="badges-header">
        <button className="badges-back-btn" onClick={onBack} aria-label={t.back}>
          <BackChevron />
        </button>
        <div className="badges-title">{t.myBadges}</div>
      </div>

      <div className="badges-banner">
        <div className="badges-banner-eyebrow">{t.collection}</div>
        <div className="badges-banner-count">
          {profile.badges.length}
          <span>/ {badgeDefinitions.length} {t.badges}</span>
        </div>
      </div>

      <div className="badges-grid">
        {badgeDefinitions.map((def) => {
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
