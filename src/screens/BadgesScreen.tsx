import { useState } from 'react';
import type { UserProfile } from '../types';
import BadgeComponent from '../components/Badge';
import BadgeDetailModal from '../components/BadgeDetailModal';
import BackChevron from '../components/BackChevron';
import ParentSegmented from '../components/ParentSegmented';
import {
  visibleBadges,
  visibleBadgeDefinitions,
  getBadgeDetail,
  type BadgeDefinition,
} from '../lib/badges';
import type { Subject } from '../lib/hardestFacts';
import { useBadgesScreenStrings } from '../i18n/progress';

interface BadgesScreenProps {
  profile: UserProfile;
  onBack: () => void;
}

export default function BadgesScreen({ profile, onBack }: BadgesScreenProps) {
  const t = useBadgesScreenStrings();
  const earnedMap = new Map(profile.badges.map((b) => [b.id, b]));
  const [selected, setSelected] = useState<BadgeDefinition | null>(null);
  // Un onglet par matière, comme l'écran Règles : avec la conjugaison et les
  // verbes anglais, une seule grille dépassait les soixante badges. Les badges
  // de toutes les matières restent au-dessus des onglets.
  const [tab, setTab] = useState<Subject>('math');
  const { general, bySubject } = visibleBadges(profile);
  const subjects = [...bySubject.keys()];
  const total = visibleBadgeDefinitions(profile).length;
  const selectedEarned = selected ? earnedMap.get(selected.id) : undefined;

  const renderSection = (key: string, title: string | undefined, defs: BadgeDefinition[]) => (
    <section key={key} className="badges-section">
      {title && <h2 className="eyebrow">{title}</h2>}
      <div className="badges-grid">
        {defs.map((def) => {
          const earned = earnedMap.get(def.id);
          const progress = earned ? undefined : getBadgeDetail(def.id, profile).progress;
          return (
            <BadgeComponent
              key={def.id}
              badge={def}
              earned={!!earned}
              earnedDate={earned?.earnedDate}
              progress={progress}
              onClick={() => setSelected(def)}
            />
          );
        })}
      </div>
    </section>
  );

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
          <span>/ {total} {t.badges}</span>
        </div>
      </div>

      <div className="badges-content">
        {renderSection('general', t.general, general)}
        {subjects.length > 1 && (
          <ParentSegmented
            kid
            label={t.myBadges}
            options={subjects.map((s) => ({ value: s, label: t.subjects[s] }))}
            value={tab}
            onChange={setTab}
          />
        )}
        {bySubject.get(tab)?.map((g) => renderSection(g.section, t.sections[g.section], g.defs))}
      </div>

      {selected && (
        <BadgeDetailModal
          badge={selected}
          earned={!!selectedEarned}
          earnedDate={selectedEarned?.earnedDate}
          profile={profile}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
