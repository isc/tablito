// Corps de statistiques de l'espace parent : tout ce qui se déduit d'un profil
// et rien d'autre (vue d'ensemble, sélecteur d'opération, répartition Leitner,
// grille, évolution, faits difficiles, historique).
//
// Extrait de ParentDashboard pour être rendu à l'identique sur un profil LOCAL
// ou sur un profil SUIVI À DISTANCE (instantané déchiffré, cf. lib/watch) : le
// parent doit voir exactement la même chose de son enfant que s'il tenait son
// appareil. Ce qui dépend de l'appareil (sauvegarde, transfert, notifications,
// suppression de profil) reste dans ParentDashboard.

import { memo, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import { isDivisionUnlocked, isRemainderUnlocked, activeLevel } from '../lib/badges';
import { countMastered } from '../lib/leitner';
import { getHardestFacts } from '../lib/hardestFacts';
import { remainderZoneBounds } from '../lib/remainderFacts';
import { getActiveStreak } from '../lib/streak';
import { todayISO } from '../lib/utils';
import ProgressGrid from './ProgressGrid';
import DivisionProgressGrid from './DivisionProgressGrid';
import RemainderProgressGrid from './RemainderProgressGrid';
import EvolutionChart from './EvolutionChart';
import { useGuideBase } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';

const HARD_FACTS_WINDOW = 10;
const EVOLUTION_WINDOW = 20;

// Mémoïsé : `profile` est une référence stable (prop d'App, ou instantané tenu en
// state), alors que ParentDashboard se re-rend à chaque frappe dans ses zones de
// texte (collage d'une sauvegarde, collage d'un lien de suivi) et à chaque
// « Copié ✓ ». Sans memo, chaque frappe rediffe tout cet arbre : histogramme,
// grille Leitner (~100 cases), deux graphes SVG, historique.
function ParentStats({ profile }: { profile: UserProfile }) {
  const t = useParentDashboardStrings();
  const guideBase = useGuideBase();

  const divisionUnlocked = useMemo(() => isDivisionUnlocked(profile), [profile]);
  const remainderUnlocked = useMemo(() => isRemainderUnlocked(profile), [profile]);
  const divisionFacts = useMemo(() => profile.divisionFacts ?? [], [profile.divisionFacts]);
  const remainderFacts = useMemo(() => profile.remainderFacts ?? [], [profile.remainderFacts]);
  // Onglet par défaut : le niveau actif — c'est l'activité d'apprentissage en
  // cours (les niveaux passés sont déjà en boîte 5 par hypothèse, et surtout
  // l'objet de l'attention du parent au quotidien).
  const [gridView, setGridView] = useState<'mult' | 'div' | 'rem'>(() => activeLevel(profile));
  const showRem = remainderUnlocked && gridView === 'rem';
  const showDiv = divisionUnlocked && gridView === 'div';

  // Descripteur de l'opération sélectionnée par le parent (× / ÷ / reste) —
  // un seul point de vérité pour toutes les sections pilotées par le
  // sélecteur (compteur de maîtrise, répartition par boîte, grille Leitner).
  const activeView = showRem
    ? {
        facts: remainderFacts,
        mastered: `${countMastered(remainderFacts)}/${remainderFacts.length}`,
        masteredLabel: t.remaindersMastered,
        opPlural: t.opRemaindersPlural,
        opSingular: t.opRemainder,
        grid: <RemainderProgressGrid facts={remainderFacts} />,
      }
    : showDiv
      ? {
          facts: divisionFacts,
          mastered: `${countMastered(divisionFacts)}/${divisionFacts.length}`,
          masteredLabel: t.divisionsMastered,
          opPlural: t.opDivisionsPlural,
          opSingular: t.opDivision,
          grid: <DivisionProgressGrid facts={divisionFacts} />,
        }
      : {
          facts: profile.facts,
          mastered: `${countMastered(profile.facts)}/${profile.facts.length}`,
          masteredLabel: t.multiplicationsMastered,
          opPlural: t.opMultiplicationsPlural,
          opSingular: t.opMultiplication,
          grid: <ProgressGrid facts={profile.facts} />,
        };

  // Onglets du sélecteur — même pattern que « Mes images » (ProgressScreen).
  const opTabs: Array<{ key: 'mult' | 'div' | 'rem'; label: string }> = [
    { key: 'mult', label: t.multiplications },
    { key: 'div', label: t.divisions },
    ...(remainderUnlocked ? [{ key: 'rem' as const, label: t.remainders }] : []),
  ];

  // Histogramme de l'opération sélectionnée.
  const { boxCounts, maxBoxCount } = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const fact of activeView.facts) {
      if (!fact.introduced) counts[0]++;
      else counts[fact.box]++;
    }
    return { boxCounts: counts, maxBoxCount: Math.max(...counts, 1) };
  }, [activeView.facts]);

  // Liste UNIFIÉE × + ÷ — indépendante du sélecteur (mélange les deux opérations
  // pour montrer où l'enfant bute en ce moment, cf. lib/hardestFacts).
  const hardFacts = useMemo(() => getHardestFacts(profile, HARD_FACTS_WINDOW, 5), [profile]);

  const recentSessions = useMemo(
    () => [...profile.sessionHistory].reverse().slice(0, 10),
    [profile.sessionHistory],
  );

  const evolution = useMemo(() => {
    const sessions = profile.sessionHistory.slice(-EVOLUTION_WINDOW);
    if (sessions.length < 2) return null;

    const accuracy: Array<{ date: string; value: number }> = [];
    const time: Array<{ date: string; value: number }> = [];
    for (const s of sessions) {
      const date = t.formatShortDate(new Date(s.date));
      accuracy.push({
        date,
        value: Math.round((s.correctCount / s.questionsCount) * 100),
      });
      time.push({ date, value: s.averageTimeMs / 1000 });
    }
    // Au moins 4s d'amplitude pour éviter qu'une variation de 0,2s ne paraisse
    // dramatique sur un enfant déjà rapide.
    const timeYMax = Math.max(Math.ceil(Math.max(...time.map((t) => t.value))), 4);

    return { accuracy, time, timeYMax };
  }, [profile.sessionHistory, t]);

  // Compteurs de maîtrise (× et ÷) au même format — réutilisés par la carte
  // « Faits maîtrisés » (avant déblocage) et la carte de maîtrise (après).
  const multMastered = `${countMastered(profile.facts)}/${profile.facts.length}`;

  const boxColors = [
    'var(--box-gray)', 'var(--box-red)', 'var(--box-orange)',
    'var(--box-yellow)', 'var(--box-lightgreen)', 'var(--box-green)',
  ];
  const boxLabels = ['N/A', 'B1', 'B2', 'B3', 'B4', 'B5'];

  return (
    <>
      {/* Stats transverses (activité / séries) — indépendantes de l'opération,
          donc valables pour × comme pour ÷. Les compteurs de maîtrise, eux,
          vivent plus bas sous le sélecteur (cf. carte de maîtrise). */}
      <div className="parent-section">
        <h3>{t.overview}</h3>
        <div className={`parent-stats-grid${divisionUnlocked ? ' parent-stats-grid--three' : ''}`}>
          <div className="parent-stat-card">
            <div className="parent-stat-value">{profile.totalSessions}</div>
            <div className="parent-stat-label">{t.sessions}</div>
          </div>
          <div className="parent-stat-card">
            <div className="parent-stat-value">{getActiveStreak(profile, todayISO())}</div>
            <div className="parent-stat-label">{t.currentStreak}</div>
          </div>
          <div className="parent-stat-card">
            <div className="parent-stat-value">{profile.longestStreak}</div>
            <div className="parent-stat-label">{t.bestStreak}</div>
          </div>
          {!divisionUnlocked && (
            <div className="parent-stat-card">
              <div className="parent-stat-value">{multMastered}</div>
              <div className="parent-stat-label">{t.masteredFacts}</div>
            </div>
          )}
        </div>
      </div>

      {/* Sélecteur d'opération — partagé par la carte de maîtrise, la Répartition
          et la Grille Leitner ci-dessous. Réutilise les classes du sélecteur
          « Mes images » côté enfant (.progress-tabs, CSS concaténé global).
          Visible uniquement après déblocage : avant, la division ne doit pas
          apparaître (specs §11.3). */}
      {divisionUnlocked && (
        <>
          <div className="progress-tabs parent-op-tabs" role="tablist" aria-label={t.operation}>
            {opTabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`progress-tab ${gridView === key ? 'active' : ''}`}
                onClick={() => setGridView(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Compteur de maîtrise de l'opération sélectionnée — sorti de la
              « Vue d'ensemble » pour vivre dans la section pilotée par le
              sélecteur, au même titre que la Répartition et la Grille. */}
          <div className="parent-section">
            <div className="parent-stat-card parent-mastery-card">
              <div className="parent-stat-value">{activeView.mastered}</div>
              <div className="parent-stat-label">{activeView.masteredLabel}</div>
            </div>
          </div>
        </>
      )}

      {/* Box histogram */}
      <div className="parent-section">
        <h3>
          {t.boxDistribution}
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
        <p className="parent-section-subtitle">
          {t.boxDistributionSubtitle(activeView.opPlural)}
        </p>
        <div className="parent-histogram">
          {boxCounts.map((count, i) => (
            <div key={i} className="parent-histogram-bar">
              <div className="parent-histogram-count">{count}</div>
              <div
                className="parent-histogram-fill"
                style={{
                  height: `${(count / maxBoxCount) * 100}%`,
                  background: boxColors[i],
                }}
              />
              <div className="parent-histogram-label">{boxLabels[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leitner color grid (diagnostic view — complements the child's
          mystery image in §5.1 by showing the raw box state per fact) */}
      <div className="parent-section">
        <h3>
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
        <p className="parent-section-subtitle">
          {t.leitnerGridSubtitle(activeView.opSingular)}
        </p>
        {activeView.grid}
      </div>

      {/* Evolution: accuracy + response time */}
      {evolution && (
        <>
          <div className="parent-section">
            <h3>{t.correctAnswerRate}</h3>
            <EvolutionChart
              data={evolution.accuracy}
              yMin={0}
              yMax={100}
              yTicks={[0, 25, 50, 75, 100]}
              formatY={(v) => `${v}%`}
              color="var(--primary)"
            />
          </div>
          <div className="parent-section">
            <h3>{t.averageResponseTime}</h3>
            <EvolutionChart
              data={evolution.time}
              yMin={0}
              yMax={evolution.timeYMax}
              yTicks={[0, evolution.timeYMax / 2, evolution.timeYMax]}
              formatY={(v) => `${v.toFixed(1)}s`}
              color="var(--sage)"
            />
          </div>
        </>
      )}

      {/* Hardest facts */}
      {hardFacts.length > 0 && (
        <div className="parent-section">
          <h3>{t.hardestFacts}</h3>
          <p className="parent-section-subtitle">
            {t.hardestFactsSubtitle(HARD_FACTS_WINDOW)}
          </p>
          <div className="parent-hard-facts">
            {hardFacts.map((f) => (
              <div key={`${f.kind}-${f.key}`} className="parent-hard-fact">
                <span
                  className={`parent-hard-fact-kind parent-hard-fact-kind--${f.kind}`}
                  aria-label={
                    f.kind === 'rem'
                      ? t.factRemainder
                      : f.kind === 'div'
                        ? t.factDivision
                        : t.factMultiplication
                  }
                >
                  {f.kind === 'rem' ? t.remSymbol : f.kind === 'div' ? t.divSymbol : t.multSymbol}
                </span>
                <span className="parent-hard-fact-name">
                  {f.kind === 'rem'
                    ? t.formatRemFact(...remainderZoneBounds(f), f.divisor)
                    : f.kind === 'div'
                      ? t.formatDivFact(f.dividend, f.divisor, f.quotient)
                      : t.formatMultFact(f.a, f.b, f.product)}
                </span>
                <span className="parent-hard-fact-errors">
                  {t.errors(f.errorCount)} | {t.boxLabel(f.box)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history */}
      {profile.sessionHistory.length > 0 && (
        <div className="parent-section">
          <h3>{t.sessionHistory}</h3>
          <div className="parent-session-history">
            {recentSessions.map((session) => {
              const dateStr = t.formatLongDate(new Date(session.date));
              const avgSec = (session.averageTimeMs / 1000).toFixed(1);
              return (
                <div key={session.date} className="parent-session-row">
                  <span className="parent-session-date">{dateStr}</span>
                  <span className="parent-session-score">
                    {session.correctCount}/{session.questionsCount}
                  </span>
                  <span className="parent-session-time">{avgSec}s</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default memo(ParentStats);
