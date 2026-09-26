// Page d'une matière dans l'espace parent : l'état de chaque niveau (maîtrise,
// grille Leitner), puis tout ce qui se lit par séance (évolution, points à
// retravailler, historique).
//
// La page EST la matière, ce qui règle la question de portée qui brouillait
// l'ancien écran unique : son sélecteur ×/÷/reste/conjugaison pilotait à la
// fois des sections par niveau (grille) et des sections par matière (courbes,
// historique), d'où un « Séances de maths uniquement » répété sous chacune.
// Ici, le sélecteur de niveau ne touche que la maîtrise et la grille ; les
// séances sont celles de la matière, sous un seul titre. Rappeler 7 × 8 et
// écrire une forme verbale ne se mesurent pas au même mètre, alors qu'à
// l'intérieur des maths une séance est mixte par construction (entretien des
// tables mêlé au niveau actif).
//
// Rendue à l'identique sur un profil local ou suivi à distance, comme
// l'accueil (cf. ParentOverview).

import { memo, useMemo, useState, type ReactNode } from 'react';
import type { FactKind, SessionResult, UserProfile } from '../types';
import { activeLevel, unlockedMathLevels, type MathLevel } from '../lib/badges';
import { factsOf, masteryBuckets } from '../lib/leitner';
import {
  getHardestFacts,
  HARD_FACTS_WINDOW,
  sessionsOfSubject,
  type Subject,
} from '../lib/hardestFacts';
import { useGuideBase } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import ProgressGrid from './ProgressGrid';
import DivisionProgressGrid from './DivisionProgressGrid';
import RemainderProgressGrid from './RemainderProgressGrid';
import ConjProgressGrid from './ConjProgressGrid';
import EvolutionChart from './EvolutionChart';
import MasteryBar from './ParentMastery';
import HardFactList from './ParentHardFacts';
import ParentSegmented from './ParentSegmented';

const HARD_FACTS_LIMIT = 5;
const EVOLUTION_WINDOW = 20;
// Historique replié : les dernières séances suffisent au coup d'œil, le reste
// est à un tap.
const HISTORY_PREVIEW = 5;

type Metric = 'accuracy' | 'speed';

interface ParentSubjectDetailProps {
  profile: UserProfile;
  subject: Subject;
}

// Une seule courbe, à bascule réussite / rapidité. Composant à part pour que la
// bascule ne re-rende que sa carte, pas la grille Leitner.
function EvolutionCard({ sessions }: { sessions: SessionResult[] }) {
  const t = useParentDashboardStrings();
  const [metric, setMetric] = useState<Metric>('accuracy');

  const series = useMemo(() => {
    const recent = sessions.slice(-EVOLUTION_WINDOW);
    if (recent.length < 2) return null;
    const dates = recent.map((s) => t.formatShortDate(new Date(s.date)));
    const accuracy = recent.map((s) => Math.round((s.correctCount / s.questionsCount) * 100));
    const speed = recent.map((s) => s.averageTimeMs / 1000);
    const points = (values: number[]) => values.map((value, i) => ({ date: dates[i], value }));
    const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
    // Au moins 4 s d'amplitude pour qu'une variation de 0,2 s ne paraisse pas
    // dramatique chez un enfant déjà rapide.
    const speedYMax = Math.max(Math.ceil(Math.max(...speed)), 4);
    return {
      accuracy: {
        data: points(accuracy),
        yMax: 100,
        yTicks: [0, 50, 100],
        formatY: t.formatPercent,
        color: 'var(--indigo)',
        mean: t.formatPercent(Math.round(mean(accuracy))),
      },
      speed: {
        data: points(speed),
        yMax: speedYMax,
        yTicks: [0, speedYMax / 2, speedYMax],
        formatY: t.formatSeconds,
        color: 'var(--sage)',
        mean: t.formatSeconds(mean(speed)),
      },
    };
  }, [sessions, t]);

  if (!series) return null;
  const { mean, ...chart } = series[metric];

  return (
    <div className="parent-section">
      <div className="parent-card parent-evolution">
        <div className="parent-card-head">
          <h3 className="parent-card-title">{t.evolution}</h3>
          <ParentSegmented
            pill
            label={t.evolution}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'accuracy', label: t.accuracy },
              { value: 'speed', label: t.speed },
            ]}
          />
        </div>
        <EvolutionChart yMin={0} {...chart} />
        <p className="parent-card-caption">{t.evolutionCaption(chart.data.length, mean)}</p>
      </div>
    </div>
  );
}

// Historique replié aux dernières séances. Composant à part, comme la courbe :
// « Tout afficher » ne re-rend que la liste.
function SessionHistory({ sessions }: { sessions: SessionResult[] }) {
  const t = useParentDashboardStrings();
  const [showAll, setShowAll] = useState(false);
  // Deux séances de la même matière peuvent tomber le même jour : la date ne
  // suffit pas à identifier une ligne, le rang dans la liste si.
  const history = useMemo(() => [...sessions].reverse(), [sessions]);
  if (history.length === 0) return null;
  const shown = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <div className="parent-section">
      <div className="parent-card parent-card--list">
        <div className="parent-card-head">
          <h3 className="parent-card-title">{t.sessionHistory}</h3>
        </div>
        <ul className="parent-session-history">
          {shown.map((session, i) => (
            <li key={i} className="parent-session-row">
              <span className="parent-session-date">{t.formatLongDate(new Date(session.date))}</span>
              <span className="parent-session-score">
                {session.correctCount}/{session.questionsCount}
              </span>
              <span className="parent-session-time">{t.formatSeconds(session.averageTimeMs / 1000)}</span>
            </li>
          ))}
        </ul>
        {!showAll && history.length > HISTORY_PREVIEW && (
          <button type="button" className="parent-card-more" onClick={() => setShowAll(true)}>
            {t.showAllSessions(history.length)}
          </button>
        )}
      </div>
    </div>
  );
}

function ParentSubjectDetail({ profile, subject }: ParentSubjectDetailProps) {
  const t = useParentDashboardStrings();
  const guideBase = useGuideBase();

  const levels = subject === 'math' ? unlockedMathLevels(profile) : [];
  // Niveau affiché par défaut : le niveau actif, l'objet de l'attention du
  // parent au quotidien (les niveaux passés sont maîtrisés par hypothèse).
  const [level, setLevel] = useState<MathLevel>(() => activeLevel(profile));
  const kind: FactKind = subject === 'conj' ? 'conj' : level;
  const facts = factsOf(profile, kind);
  const buckets = masteryBuckets(facts);

  const levelLabel: Record<MathLevel, string> = {
    mult: t.multiplications,
    div: t.divisions,
    rem: t.remainders,
  };
  const kindText: Record<FactKind, { mastered: string; op: string }> = {
    mult: { mastered: t.multiplicationsMastered, op: t.opMultiplication },
    div: { mastered: t.divisionsMastered, op: t.opDivision },
    rem: { mastered: t.remaindersMastered, op: t.opRemainder },
    conj: { mastered: t.conjugationsMastered, op: t.opConjugation },
  };
  // Chaque grille lit son inventaire typé ; seule celle du niveau affiché est
  // construite.
  const grid = (): ReactNode => {
    switch (kind) {
      case 'mult':
        return <ProgressGrid facts={profile.facts} />;
      case 'div':
        return <DivisionProgressGrid facts={profile.divisionFacts ?? []} />;
      case 'rem':
        return <RemainderProgressGrid facts={profile.remainderFacts ?? []} />;
      case 'conj':
        return <ConjProgressGrid facts={profile.conjFacts ?? []} />;
    }
  };

  // === Séances de la matière ===
  const sessions = useMemo(
    () => sessionsOfSubject(profile.sessionHistory, subject),
    [profile.sessionHistory, subject],
  );
  const hardFacts = useMemo(
    () => getHardestFacts(profile, HARD_FACTS_WINDOW, HARD_FACTS_LIMIT, subject),
    [profile, subject],
  );

  return (
    <>
      {levels.length > 1 && (
        <div className="parent-section">
          <ParentSegmented
            label={t.level}
            value={level}
            onChange={setLevel}
            options={levels.map((l) => ({ value: l, label: levelLabel[l] }))}
          />
        </div>
      )}

      <div className="parent-section">
        <div className="parent-card parent-mastery">
          <div className="parent-mastery-count">
            <span className="parent-mastery-number">{buckets.mastered}</span>
            <span className="parent-mastery-total">/ {facts.length}</span>
          </div>
          <div className="parent-mastery-label">{kindText[kind].mastered}</div>
          <MasteryBar buckets={buckets} total={facts.length} legend />
        </div>
      </div>

      <div className="parent-section">
        <div className="parent-card">
          <h3 className="parent-card-title">
            {t.leitnerGrid}
            <a
              className="parent-section-help"
              href={`${guideBase}#principes`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.learnMoreLeitner}
            >
              ?
            </a>
          </h3>
          <p className="parent-section-subtitle">{t.leitnerGridSubtitle(kindText[kind].op)}</p>
          {grid()}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="parent-section">
          <h2 className="parent-overline">{subject === 'conj' ? t.conjSessions : t.mathSessions}</h2>
          {levels.length > 1 && <p className="parent-section-subtitle">{t.mathSessionsMixed}</p>}
        </div>
      )}

      <EvolutionCard sessions={sessions} />

      {hardFacts.length > 0 && (
        <div className="parent-section">
          <div className="parent-card parent-card--list">
            <div className="parent-card-head">
              <h3 className="parent-card-title">{t.toPractise}</h3>
              <span className="parent-card-aside">{t.hardestFactsSubtitle(HARD_FACTS_WINDOW)}</span>
            </div>
            <HardFactList facts={hardFacts} showBox />
          </div>
        </div>
      )}

      <SessionHistory sessions={sessions} />
    </>
  );
}

export default memo(ParentSubjectDetail);
