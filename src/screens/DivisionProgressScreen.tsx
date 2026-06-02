import type { UserProfile } from '../types';
import DivisionMysteryImage from '../components/DivisionMysteryImage';
import BackChevron from '../components/BackChevron';

interface DivisionProgressScreenProps {
  profile: UserProfile;
  onBack: () => void;
}

export default function DivisionProgressScreen({ profile, onBack }: DivisionProgressScreenProps) {
  const facts = profile.divisionFacts ?? [];
  const theme = profile.divisionMysteryTheme ?? profile.mysteryTheme;
  const introduced = facts.filter((f) => f.introduced).length;
  const mastered = facts.filter((f) => f.box >= 4).length;
  const total = facts.length;

  return (
    <div className="progress-screen">
      <div className="progress-header">
        <button className="progress-back-btn" onClick={onBack} aria-label="Retour">
          <BackChevron />
        </button>
        <div className="progress-title">Mon image des divisions</div>
      </div>

      <div className="progress-stats-summary">
        <div className="progress-stat">
          <div className="progress-stat-value">{introduced}</div>
          <div className="progress-stat-label">découvertes</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{mastered}</div>
          <div className="progress-stat-label">maîtrisées</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{total}</div>
          <div className="progress-stat-label">au total</div>
        </div>
      </div>

      <DivisionMysteryImage facts={facts} theme={theme} />

      <div className="progress-legend">
        Chaque division que tu connais mieux dévoile un peu plus de cette
        nouvelle image. Quand tu les maîtrises toutes, elle est complète&nbsp;!
      </div>
    </div>
  );
}
