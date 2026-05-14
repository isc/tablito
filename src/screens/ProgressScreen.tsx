import type { UserProfile } from '../types';
import MysteryImage from '../components/MysteryImage';
import BackChevron from '../components/BackChevron';

interface ProgressScreenProps {
  profile: UserProfile;
  onBack: () => void;
}

export default function ProgressScreen({ profile, onBack }: ProgressScreenProps) {
  const introduced = profile.facts.filter((f) => f.introduced).length;
  const mastered = profile.facts.filter((f) => f.box >= 4).length;
  const total = profile.facts.length;

  return (
    <div className="progress-screen">
      <div className="progress-header">
        <button className="progress-back-btn" onClick={onBack} aria-label="Retour">
          <BackChevron />
        </button>
        <div className="progress-title">Mon image mystère</div>
      </div>

      <div className="progress-stats-summary">
        <div className="progress-stat">
          <div className="progress-stat-value">{introduced}</div>
          <div className="progress-stat-label">découverts</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{mastered}</div>
          <div className="progress-stat-label">maîtrisés</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{total}</div>
          <div className="progress-stat-label">au total</div>
        </div>
      </div>

      <MysteryImage facts={profile.facts} theme={profile.mysteryTheme} />

      <div className="progress-legend">
        Chaque multiplication que tu connais mieux dévoile un peu plus de l'image.
        Quand tu les maîtrises toutes, l'image est complète&nbsp;!
      </div>
    </div>
  );
}
