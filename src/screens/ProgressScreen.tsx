import { useState } from 'react';
import type { UserProfile } from '../types';
import MysteryImage from '../components/MysteryImage';
import DivisionMysteryImage from '../components/DivisionMysteryImage';
import RemainderMysteryImage from '../components/RemainderMysteryImage';
import ConjMysteryImage from '../components/ConjMysteryImage';
import BackChevron from '../components/BackChevron';
import { isConjVisible, isDivisionUnlocked, isRemainderUnlocked } from '../lib/badges';
import { useLang } from '../i18n/lang';
import { useProgressScreenStrings } from '../i18n/progress';

// La conjugaison est une MATIÈRE, pas un niveau : son onglet ne s'ouvre pas par
// la progression des maths mais par le simple fait d'avoir ouvert la matière —
// et jamais en anglais (matière fr-only, cf. isConjVisible).
type ProgressView = 'mult' | 'div' | 'rem' | 'conj';

interface ProgressScreenProps {
  profile: UserProfile;
  onBack: () => void;
  // Onglet ouvert par défaut : l'image du niveau actif (depuis le récap d'une
  // séance, on ouvre directement sur l'image correspondante).
  initialView?: ProgressView;
}

export default function ProgressScreen({ profile, onBack, initialView = 'mult' }: ProgressScreenProps) {
  const t = useProgressScreenStrings();
  const { lang } = useLang();
  const divUnlocked = isDivisionUnlocked(profile);
  const remUnlocked = isRemainderUnlocked(profile);
  const conjVisible = isConjVisible(profile, lang);
  const [view, setView] = useState<ProgressView>(() => {
    if (initialView === 'rem' && !remUnlocked) return 'mult';
    if (initialView === 'div' && !divUnlocked) return 'mult';
    if (initialView === 'conj' && !conjVisible) return 'mult';
    return initialView;
  });

  const divFacts = profile.divisionFacts ?? [];
  const remFacts = profile.remainderFacts ?? [];
  const conjFacts = profile.conjFacts ?? [];
  const showConj = conjVisible && view === 'conj';
  const showDiv = !showConj && divUnlocked && view === 'div';
  const showRem = !showConj && remUnlocked && view === 'rem';

  const facts = showConj ? conjFacts : showRem ? remFacts : showDiv ? divFacts : profile.facts;
  const introduced = facts.filter((f) => f.introduced).length;
  const mastered = facts.filter((f) => f.box >= 4).length;
  const total = facts.length;

  // Onglets : les niveaux de maths débloqués, puis la matière conjugaison —
  // en dernier, séparée, parce que ce n'en est pas un de plus.
  const tabs: Array<{ key: ProgressView; label: string }> = [
    ...(divUnlocked
      ? [
          { key: 'mult' as const, label: t.multiplications },
          { key: 'div' as const, label: t.divisions },
          ...(remUnlocked ? [{ key: 'rem' as const, label: t.remainders }] : []),
        ]
      : conjVisible
        ? [{ key: 'mult' as const, label: t.multiplications }]
        : []),
    ...(conjVisible ? [{ key: 'conj' as const, label: t.conjugations }] : []),
  ];

  return (
    <div className="progress-screen">
      <div className="progress-header">
        <button className="progress-back-btn" onClick={onBack} aria-label={t.back}>
          <BackChevron />
        </button>
        {/* « Mes images » dès qu'il y en a plusieurs à voir — niveau 2 ou
            matière conjugaison. */}
        <div className="progress-title">{tabs.length > 1 ? t.myPictures : t.myMysteryPicture}</div>
      </div>

      {tabs.length > 1 && (
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
            {showConj ? t.discoveredConj : showDiv || showRem ? t.discoveredDiv : t.discoveredMult}
          </div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{mastered}</div>
          <div className="progress-stat-label">
            {showConj ? t.masteredConj : showDiv || showRem ? t.masteredDiv : t.masteredMult}
          </div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-value">{total}</div>
          <div className="progress-stat-label">{t.total}</div>
        </div>
      </div>

      {showConj ? (
        <ConjMysteryImage
          facts={conjFacts}
          theme={profile.conjMysteryTheme ?? profile.mysteryTheme}
        />
      ) : showRem ? (
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
        {showConj ? t.legendConj : showRem ? t.legendRem : showDiv ? t.legendDiv : t.legendMult}
      </div>
    </div>
  );
}
