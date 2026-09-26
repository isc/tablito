// Accueil de l'espace parent, partie progression : la journée, une carte par
// matière qui ouvre sa page, et les points à retravailler toutes matières
// confondues. Le détail (grille, courbes, historique) vit sur la page de la
// matière (ParentSubjectDetail) : l'accueil garde la même taille quel que soit
// le nombre de niveaux débloqués, là où l'ancien écran unique empilait un
// onglet de plus par niveau.
//
// Comme la page de matière, rendu à l'identique sur un profil LOCAL ou SUIVI À
// DISTANCE (instantané déchiffré, cf. lib/watch) : le parent voit la même
// chose de son enfant que s'il tenait son appareil. Ce qui dépend de
// l'appareil (sauvegarde, suivi, notifications, profils) reste dans
// ParentDashboard.

import { memo, useMemo } from 'react';
import type { UserProfile } from '../types';
import { activeLevel, isConjVisible, unlockedMathLevels } from '../lib/badges';
import { countMastered } from '../lib/leitner';
import { getHardestFacts, type Subject } from '../lib/hardestFacts';
import { getActiveStreak } from '../lib/streak';
import { todayISO } from '../lib/utils';
import { useLang } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import ActivityStrip from './ActivityStrip';
import MasteryBar from './ParentMastery';
import HardFactList from './ParentHardFacts';

// Même fenêtre que la liste de la page de matière : « difficile en ce moment »,
// pas « difficile un jour ».
const HARD_FACTS_WINDOW = 10;
const OVERVIEW_HARD_FACTS = 3;

type MathLevel = 'mult' | 'div' | 'rem';

interface ParentOverviewProps {
  profile: UserProfile;
  onOpenSubject: (subject: Subject) => void;
}

function Chevron() {
  return (
    <svg className="parent-subject-chevron" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mémoïsé pour la même raison qu'avant la découpe : `profile` est une référence
// stable, alors que ParentDashboard se re-rend à chaque frappe dans ses zones
// de texte (import, lien de suivi) et à chaque « Copié ✓ ».
function ParentOverview({ profile, onOpenSubject }: ParentOverviewProps) {
  const t = useParentDashboardStrings();
  const { lang } = useLang();
  const today = todayISO();

  // Conjugaison : visible dès qu'elle a été ouverte, jamais en anglais (spec
  // Verbito §9, matière fr-only).
  const conjVisible = useMemo(() => isConjVisible(profile, lang), [profile, lang]);
  const levels = useMemo(() => unlockedMathLevels(profile), [profile]);
  const current = activeLevel(profile);

  const factsOf = (level: MathLevel) =>
    level === 'mult'
      ? profile.facts
      : level === 'div'
        ? profile.divisionFacts ?? []
        : profile.remainderFacts ?? [];
  const levelName: Record<MathLevel, string> = {
    mult: t.multiplications,
    div: t.divisions,
    rem: t.remaindersLong,
  };
  const currentLabel: Record<MathLevel, string> = {
    mult: t.currentMult,
    div: t.currentDiv,
    rem: t.currentRem,
  };
  const currentFacts = factsOf(current);
  const conjFacts = profile.conjFacts ?? [];

  // Trois points toutes matières confondues, triés comme la liste de chaque
  // page (erreurs décroissantes, puis boîte la plus basse). Chaque matière est
  // lue sur SA fenêtre de séances : une journée de conjugaison ne doit pas
  // chasser les erreurs de maths de la veille.
  const hardFacts = useMemo(() => {
    const math = getHardestFacts(profile, HARD_FACTS_WINDOW, OVERVIEW_HARD_FACTS, 'math');
    const conj = conjVisible
      ? getHardestFacts(profile, HARD_FACTS_WINDOW, OVERVIEW_HARD_FACTS, 'conj')
      : [];
    return [...math, ...conj]
      .sort((a, b) => b.errorCount - a.errorCount || a.box - b.box)
      .slice(0, OVERVIEW_HARD_FACTS);
  }, [profile, conjVisible]);

  return (
    <>
      <div className="parent-section">
        {/* La journée en tête : « a-t-il fait sa séance aujourd'hui ? » est la
            question qu'on vient poser ici en premier. Les compteurs cumulés
            ferment la même carte plutôt que d'en ouvrir trois autres. */}
        <ActivityStrip profile={profile} today={today} conjVisible={conjVisible}>
          <div className="parent-kpis">
            <div className="parent-kpi">
              <div className="parent-stat-value">{profile.totalSessions}</div>
              <div className="parent-stat-label">{t.sessions}</div>
            </div>
            <div className="parent-kpi parent-kpi--streak">
              <div className="parent-stat-value">{getActiveStreak(profile, today)}</div>
              <div className="parent-stat-label">{t.currentStreak}</div>
            </div>
            <div className="parent-kpi parent-kpi--best">
              <div className="parent-stat-value">{profile.longestStreak}</div>
              <div className="parent-stat-label">{t.bestStreak}</div>
            </div>
          </div>
        </ActivityStrip>
      </div>

      <div className="parent-section">
        <h2 className="parent-overline">{t.subjects}</h2>
        <div className="parent-subject-cards">
          <button
            type="button"
            className="parent-subject-card parent-subject-card--math"
            onClick={() => onOpenSubject('math')}
          >
            <span className="parent-subject-head">
              <span className="parent-subject-icon parent-subject-icon--math" aria-hidden="true">
                ×÷
              </span>
              <span className="parent-subject-titles">
                <span className="parent-subject-title">{t.math}</span>
                <span className="parent-subject-sub">{currentLabel[current]}</span>
              </span>
              <Chevron />
            </span>
            {/* Niveaux passés : une pastille chacun. Cochée tant que tout y
                reste maîtrisé ; sinon le compte, pour qu'un fait retombé en
                révision ne passe pas inaperçu. */}
            {levels.length > 1 && (
              <span className="parent-level-pills">
                {levels
                  .filter((level) => level !== current)
                  .map((level) => {
                    const facts = factsOf(level);
                    const mastered = countMastered(facts);
                    const done = mastered === facts.length;
                    return (
                      <span key={level} className={`parent-level-pill${done ? ' is-done' : ''}`}>
                        {done && <Check />}
                        {done ? levelName[level] : `${levelName[level]} ${mastered}/${facts.length}`}
                      </span>
                    );
                  })}
              </span>
            )}
            <span className="parent-level-row">
              <span className="parent-level-name">{levelName[current]}</span>
              <span className="parent-level-count">
                {countMastered(currentFacts)} / {currentFacts.length}
              </span>
            </span>
            <MasteryBar facts={currentFacts} />
          </button>

          {conjVisible && (
            <button
              type="button"
              className="parent-subject-card parent-subject-card--conj"
              onClick={() => onOpenSubject('conj')}
            >
              <span className="parent-subject-head">
                <span className="parent-subject-icon parent-subject-icon--conj" aria-hidden="true">
                  {t.conjSymbol}
                </span>
                <span className="parent-subject-titles">
                  <span className="parent-subject-title">{t.conjugations}</span>
                  <span className="parent-subject-sub">{t.conjTenses}</span>
                </span>
                <Chevron />
              </span>
              <span className="parent-level-row">
                <span className="parent-level-name">{t.verbForms}</span>
                <span className="parent-level-count">
                  {countMastered(conjFacts)} / {conjFacts.length}
                </span>
              </span>
              <MasteryBar facts={conjFacts} />
            </button>
          )}
        </div>
      </div>

      {hardFacts.length > 0 && (
        <div className="parent-section">
          <h2 className="parent-overline">{t.toPractise}</h2>
          <div className="parent-card parent-card--list">
            <HardFactList facts={hardFacts} />
          </div>
          <p className="parent-section-subtitle parent-overview-note">
            {t.hardestFactsSubtitle(HARD_FACTS_WINDOW)}
          </p>
        </div>
      )}
    </>
  );
}

export default memo(ParentOverview);
