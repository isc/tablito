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
import type { BoxLevel, FactKind, UserProfile } from '../types';
import { activeLevel, unlockedMathLevels } from '../lib/badges';
import { countMastered } from '../lib/leitner';
import { getHardestFacts, sessionsOfSubject, type Subject } from '../lib/hardestFacts';
import { useGuideBase } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import ProgressGrid from './ProgressGrid';
import DivisionProgressGrid from './DivisionProgressGrid';
import RemainderProgressGrid from './RemainderProgressGrid';
import ConjProgressGrid from './ConjProgressGrid';
import EvolutionChart from './EvolutionChart';
import MasteryBar from './ParentMastery';
import HardFactList from './ParentHardFacts';

const HARD_FACTS_WINDOW = 10;
const HARD_FACTS_LIMIT = 5;
const EVOLUTION_WINDOW = 20;
// Historique replié : les dernières séances suffisent au coup d'œil, le reste
// est à un tap.
const HISTORY_PREVIEW = 5;

type MathLevel = 'mult' | 'div' | 'rem';
type Metric = 'accuracy' | 'speed';

interface ParentSubjectDetailProps {
  profile: UserProfile;
  subject: Subject;
}

// Tout ce qui change quand le parent bascule d'un niveau à l'autre.
interface LevelView {
  facts: { introduced: boolean; box: BoxLevel }[];
  masteredLabel: string;
  opSingular: string;
  grid: ReactNode;
}

function ParentSubjectDetail({ profile, subject }: ParentSubjectDetailProps) {
  const t = useParentDashboardStrings();
  const guideBase = useGuideBase();

  const levels = useMemo(
    () => (subject === 'math' ? unlockedMathLevels(profile) : []),
    [profile, subject],
  );
  // Niveau affiché par défaut : le niveau actif, l'objet de l'attention du
  // parent au quotidien (les niveaux passés sont maîtrisés par hypothèse).
  const [level, setLevel] = useState<MathLevel>(() => activeLevel(profile));
  // Un niveau absent de la liste (profil suivi dont l'instantané a changé)
  // retombe sur la multiplication plutôt que d'afficher un niveau fermé.
  const kind: FactKind = subject === 'conj' ? 'conj' : levels.includes(level) ? level : 'mult';

  // Seule la vue du niveau affiché est construite (une seule grille).
  const views: Record<FactKind, () => LevelView> = {
    mult: () => ({
      facts: profile.facts,
      masteredLabel: t.multiplicationsMastered,
      opSingular: t.opMultiplication,
      grid: <ProgressGrid facts={profile.facts} />,
    }),
    div: () => ({
      facts: profile.divisionFacts ?? [],
      masteredLabel: t.divisionsMastered,
      opSingular: t.opDivision,
      grid: <DivisionProgressGrid facts={profile.divisionFacts ?? []} />,
    }),
    rem: () => ({
      facts: profile.remainderFacts ?? [],
      masteredLabel: t.remaindersMastered,
      opSingular: t.opRemainder,
      grid: <RemainderProgressGrid facts={profile.remainderFacts ?? []} />,
    }),
    conj: () => ({
      facts: profile.conjFacts ?? [],
      masteredLabel: t.conjugationsMastered,
      opSingular: t.opConjugation,
      grid: <ConjProgressGrid facts={profile.conjFacts ?? []} />,
    }),
  };
  const view = views[kind]();
  const levelLabel: Record<MathLevel, string> = {
    mult: t.multiplications,
    div: t.divisions,
    rem: t.remainders,
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

  const [metric, setMetric] = useState<Metric>('accuracy');
  const evolution = useMemo(() => {
    const recent = sessions.slice(-EVOLUTION_WINDOW);
    if (recent.length < 2) return null;
    const accuracy = recent.map((s) => ({
      date: t.formatShortDate(new Date(s.date)),
      value: Math.round((s.correctCount / s.questionsCount) * 100),
    }));
    const speed = recent.map((s) => ({
      date: t.formatShortDate(new Date(s.date)),
      value: s.averageTimeMs / 1000,
    }));
    const mean = (points: { value: number }[]) =>
      points.reduce((sum, p) => sum + p.value, 0) / points.length;
    // Au moins 4 s d'amplitude pour qu'une variation de 0,2 s ne paraisse pas
    // dramatique chez un enfant déjà rapide.
    const speedYMax = Math.max(Math.ceil(Math.max(...speed.map((p) => p.value))), 4);
    return { accuracy, speed, speedYMax, meanAccuracy: mean(accuracy), meanSpeed: mean(speed) };
  }, [sessions, t]);

  // Deux séances de la même matière peuvent tomber le même jour : la date ne
  // suffit pas à identifier une ligne, le rang dans la liste si.
  const history = useMemo(() => [...sessions].reverse(), [sessions]);
  const [showAll, setShowAll] = useState(false);
  const shownHistory = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <>
      {levels.length > 1 && (
        <div className="parent-section">
          <div className="parent-segmented" role="group" aria-label={t.level}>
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                className={`parent-segmented-option${l === kind ? ' is-active' : ''}`}
                aria-pressed={l === kind}
                onClick={() => setLevel(l)}
              >
                {levelLabel[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="parent-section">
        <div className="parent-card parent-mastery">
          <div className="parent-mastery-count">
            <span className="parent-mastery-number">{countMastered(view.facts)}</span>
            <span className="parent-mastery-total">/ {view.facts.length}</span>
          </div>
          <div className="parent-mastery-label">{view.masteredLabel}</div>
          <MasteryBar facts={view.facts} legend />
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
          <p className="parent-section-subtitle">{t.leitnerGridSubtitle(view.opSingular)}</p>
          {view.grid}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="parent-section">
          <h2 className="parent-overline">{subject === 'conj' ? t.conjSessions : t.mathSessions}</h2>
          {subject === 'math' && levels.length > 1 && (
            <p className="parent-section-subtitle">{t.mathSessionsMixed}</p>
          )}
        </div>
      )}

      {evolution && (
        <div className="parent-section">
          <div className="parent-card parent-evolution">
            <div className="parent-card-head">
              <h3 className="parent-card-title">{t.evolution}</h3>
              <div className="parent-toggle" role="group" aria-label={t.evolution}>
                <button
                  type="button"
                  className={`parent-toggle-option${metric === 'accuracy' ? ' is-active' : ''}`}
                  aria-pressed={metric === 'accuracy'}
                  onClick={() => setMetric('accuracy')}
                >
                  {t.accuracy}
                </button>
                <button
                  type="button"
                  className={`parent-toggle-option${metric === 'speed' ? ' is-active' : ''}`}
                  aria-pressed={metric === 'speed'}
                  onClick={() => setMetric('speed')}
                >
                  {t.speed}
                </button>
              </div>
            </div>
            {metric === 'accuracy' ? (
              <EvolutionChart
                data={evolution.accuracy}
                yMin={0}
                yMax={100}
                yTicks={[0, 50, 100]}
                formatY={(v) => t.formatPercent(v)}
                color="var(--indigo)"
              />
            ) : (
              <EvolutionChart
                data={evolution.speed}
                yMin={0}
                yMax={evolution.speedYMax}
                yTicks={[0, evolution.speedYMax / 2, evolution.speedYMax]}
                formatY={(v) => t.formatSeconds(v)}
                color="var(--sage)"
              />
            )}
            <p className="parent-card-caption">
              {t.evolutionCaption(
                evolution.accuracy.length,
                metric === 'accuracy'
                  ? t.formatPercent(Math.round(evolution.meanAccuracy))
                  : t.formatSeconds(evolution.meanSpeed),
              )}
            </p>
          </div>
        </div>
      )}

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

      {history.length > 0 && (
        <div className="parent-section">
          <div className="parent-card parent-card--list">
            <div className="parent-card-head">
              <h3 className="parent-card-title">{t.sessionHistory}</h3>
            </div>
            <ul className="parent-session-history">
              {shownHistory.map((session, i) => (
                <li key={i} className="parent-session-row">
                  <span className="parent-session-date">{t.formatLongDate(new Date(session.date))}</span>
                  <span className="parent-session-score">
                    {session.correctCount}/{session.questionsCount}
                  </span>
                  <span className="parent-session-time">
                    {t.formatSeconds(session.averageTimeMs / 1000)}
                  </span>
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
      )}
    </>
  );
}

export default memo(ParentSubjectDetail);
