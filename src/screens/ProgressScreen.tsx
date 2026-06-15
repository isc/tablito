import { useState } from 'react';
import type { UserProfile } from '../types';
import MysteryImage from '../components/MysteryImage';
import DivisionMysteryImage from '../components/DivisionMysteryImage';
import BackChevron from '../components/BackChevron';
import { isDivisionUnlocked } from '../lib/badges';

interface ProgressScreenProps {
  profile: UserProfile;
  onBack: () => void;
  // Onglet ouvert par défaut quand la division est débloquée (depuis le récap
  // d'une séance de division, on ouvre directement sur l'image division).
  initialView?: 'mult' | 'div';
}

export default function ProgressScreen({ profile, onBack, initialView = 'mult' }: ProgressScreenProps) {
  const unlocked = isDivisionUnlocked(profile);
  const [view, setView] = useState<'mult' | 'div'>(unlocked ? initialView : 'mult');

  const divFacts = profile.divisionFacts ?? [];
  const showDiv = unlocked && view === 'div';

  const facts = showDiv ? divFacts : profile.facts;
  const introduced = facts.filter((f) => f.introduced).length;
  const mastered = facts.filter((f) => f.box >= 4).length;
  const total = facts.length;

  return (
    <div className="progress-screen">
      <div className="progress-header">
        <button className="progress-back-btn" onClick={onBack} aria-label="Retour">
          <BackChevron />
        </button>
        <div className="progress-title">{unlocked ? 'Mes images' : 'Mon image mystère'}</div>
      </div>

      {unlocked && (
        <div className="progress-tabs" role="tablist">
          <button
            type="button"
            className={`progress-tab ${view === 'mult' ? 'active' : ''}`}
            onClick={() => setView('mult')}
          >
            Multiplications
          </button>
          <button
            type="button"
            className={`progress-tab ${view === 'div' ? 'active' : ''}`}
            onClick={() => setView('div')}
          >
            Divisions
          </button>
        </div>
      )}

      <div className="progress-stats-summary">
        <div className="progress-stat">
          <div className="progress-stat-value">{introduced}</div>
          <div className="progress-stat-label">{showDiv ? 'découvertes' : 'découverts'}</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{mastered}</div>
          <div className="progress-stat-label">{showDiv ? 'maîtrisées' : 'maîtrisés'}</div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{total}</div>
          <div className="progress-stat-label">au total</div>
        </div>
      </div>

      {showDiv ? (
        <DivisionMysteryImage facts={divFacts} theme={profile.divisionMysteryTheme ?? profile.mysteryTheme} />
      ) : (
        <MysteryImage facts={profile.facts} theme={profile.mysteryTheme} />
      )}

      <div className="progress-legend">
        {showDiv
          ? "Chaque division que tu connais mieux dévoile un peu plus de cette image. Et si un fait a besoin d'être revu, sa case se brouille à nouveau : l'image montre toujours où tu en es. Continue, et elle se complétera !"
          : "Chaque multiplication que tu connais mieux dévoile un peu plus de l'image. Et si un fait a besoin d'être revu, sa case se brouille à nouveau : l'image montre toujours où tu en es. Continue, et elle se complétera !"}
      </div>
    </div>
  );
}
