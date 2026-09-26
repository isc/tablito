// Accueil de l'espace parent, partie progression : la journée, le point de la
// semaine, une carte par matière qui ouvre sa page, et les points à retravailler
// toutes matières confondues, avec une idée pour aider à la maison. Le détail
// (grille, courbes, historique) vit sur la page de la matière
// (ParentSubjectDetail) : l'accueil garde la même taille quel que soit le
// nombre de niveaux débloqués, là où l'ancien écran unique empilait un onglet
// de plus par niveau.
//
// Comme la page de matière, rendu à l'identique sur un profil LOCAL ou SUIVI À
// DISTANCE (instantané déchiffré, cf. lib/watch) : le parent voit la même
// chose de son enfant que s'il tenait son appareil. Ce qui dépend de
// l'appareil (sauvegarde, suivi, notifications, profils) reste dans
// ParentDashboard.

import { useMemo, type ReactNode } from 'react';
import type { BoxLevel, UserProfile } from '../types';
import { isConjVisible, unlockedMathLevels, type MathLevel } from '../lib/badges';
import { CONJ_TENSES } from '../lib/conjugationFacts';
import { countMastered, factsOf, masteryBuckets } from '../lib/leitner';
import { getHardestFactsAcross, HARD_FACTS_WINDOW, type Subject } from '../lib/hardestFacts';
import { getActiveStreak } from '../lib/streak';
import { todayISO } from '../lib/utils';
import { useLang } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import { TENSE_NAMES } from '../i18n/tense';
import ActivityStrip from './ActivityStrip';
import { ForwardChevron } from './BackChevron';
import MasteryBar from './ParentMastery';
import HardFactList from './ParentHardFacts';
import ParentHomeIdea from './ParentHomeIdea';
import ParentWeekCard from './ParentWeekCard';

const OVERVIEW_HARD_FACTS = 3;

// Sous-titre de la carte Conjugaison, tiré des noms de temps partagés
// (i18n/tense) : « Présent, imparfait, futur ». Matière fr-only.
const CONJ_TENSES_LABEL = (() => {
  const names = CONJ_TENSES.map((tense) => TENSE_NAMES.fr[tense]).join(', ');
  return names.charAt(0).toUpperCase() + names.slice(1);
})();

interface ParentOverviewProps {
  profile: UserProfile;
  onOpenSubject: (subject: Subject) => void;
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SubjectCardProps {
  subject: Subject;
  icon: string;
  title: string;
  sub: string;
  // Ligne chiffrée : le niveau en cours (maths) ou la matière entière.
  rowName: string;
  facts: Array<{ box: BoxLevel; introduced: boolean }>;
  onOpen: () => void;
  children?: ReactNode;
}

// Une carte de matière : la carte entière est le bouton qui ouvre sa page.
function SubjectCard({ subject, icon, title, sub, rowName, facts, onOpen, children }: SubjectCardProps) {
  const buckets = masteryBuckets(facts);
  return (
    <button type="button" className={`parent-card parent-subject-card parent-subject-card--${subject}`} onClick={onOpen}>
      <span className="parent-subject-head">
        <span className={`parent-subject-icon parent-subject-icon--${subject}`} aria-hidden="true">
          {icon}
        </span>
        <span className="parent-subject-titles">
          <span className="parent-subject-title">{title}</span>
          <span className="parent-subject-sub">{sub}</span>
        </span>
        <span className="parent-subject-chevron" aria-hidden="true">
          <ForwardChevron />
        </span>
      </span>
      {children}
      <span className="parent-level-row">
        <span className="parent-level-name">{rowName}</span>
        <span className="parent-level-count">
          {buckets.mastered} / {facts.length}
        </span>
      </span>
      <MasteryBar buckets={buckets} total={facts.length} />
    </button>
  );
}

export default function ParentOverview({ profile, onOpenSubject }: ParentOverviewProps) {
  const t = useParentDashboardStrings();
  const { lang } = useLang();
  const today = todayISO();

  // Conjugaison : visible dès qu'elle a été ouverte, jamais en anglais (spec
  // Verbito §9, matière fr-only).
  const conjVisible = isConjVisible(profile, lang);
  // Le niveau en cours est le dernier débloqué ; les précédents sont passés.
  const levels = unlockedMathLevels(profile);
  const current = levels[levels.length - 1];
  const past = levels.slice(0, -1);

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

  // Les matières que l'accueil lit : une matière masquée ne compte nulle part.
  const subjects = useMemo<Subject[]>(() => (conjVisible ? ['math', 'conj'] : ['math']), [conjVisible]);

  // Trois points toutes matières confondues, triés comme la liste de chaque
  // page de matière.
  const hardFacts = useMemo(
    () => getHardestFactsAcross(profile, subjects, HARD_FACTS_WINDOW, OVERVIEW_HARD_FACTS),
    [profile, subjects],
  );

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

      <ParentWeekCard profile={profile} today={today} subjects={subjects} />

      <div className="parent-section">
        <h2 className="parent-overline">{t.subjects}</h2>
        <div className="parent-subject-cards">
          <SubjectCard
            subject="math"
            icon="×÷"
            title={t.math}
            sub={currentLabel[current]}
            rowName={levelName[current]}
            facts={factsOf(profile, current)}
            onOpen={() => onOpenSubject('math')}
          >
            {/* Niveaux passés : une pastille chacun. Cochée tant que tout y
                reste maîtrisé ; sinon le compte, pour qu'un fait retombé en
                révision ne passe pas inaperçu. */}
            {past.length > 0 && (
              <span className="parent-level-pills">
                {past.map((level) => {
                  const facts = factsOf(profile, level);
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
          </SubjectCard>

          {conjVisible && (
            <SubjectCard
              subject="conj"
              icon={t.conjSymbol}
              title={t.conjugations}
              sub={CONJ_TENSES_LABEL}
              rowName={t.verbForms}
              facts={factsOf(profile, 'conj')}
              onOpen={() => onOpenSubject('conj')}
            />
          )}
        </div>
      </div>

      {hardFacts.length > 0 && (
        <div className="parent-section">
          <h2 className="parent-overline">{t.toPractise}</h2>
          <div className="parent-card parent-card--list">
            <HardFactList facts={hardFacts} />
          </div>
          <p className="parent-section-subtitle parent-note">
            {t.hardestFactsSubtitle(HARD_FACTS_WINDOW)}
          </p>
          <ParentHomeIdea fact={hardFacts[0]} />
        </div>
      )}
    </>
  );
}
