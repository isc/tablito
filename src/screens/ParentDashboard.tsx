import { useState, useMemo } from 'react';
import type { UserProfile } from '../types';
import { getFactKey } from '../lib/facts';
import { getActiveStreak } from '../lib/streak';
import { todayISO } from '../lib/utils';
import ProgressGrid from '../components/ProgressGrid';
import BackChevron from '../components/BackChevron';
import FeedbackModal from '../components/FeedbackModal';
import EvolutionChart from '../components/EvolutionChart';

const HARD_FACTS_WINDOW = 10;
const EVOLUTION_WINDOW = 20;

interface ParentDashboardProps {
  profile: UserProfile;
  onBack: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onResetProfile: () => void;
  onShowPrivacy: () => void;
  onShowChangelog: () => void;
}

export default function ParentDashboard({
  profile,
  onBack,
  onExport,
  onImport,
  onResetProfile,
  onShowPrivacy,
  onShowChangelog,
}: ParentDashboardProps) {
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const { boxCounts, maxBoxCount, hardFacts } = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const fact of profile.facts) {
      if (!fact.introduced) counts[0]++;
      else counts[fact.box]++;
    }

    // Sans fenêtre, un fait galéré il y a longtemps mais désormais en
    // boîte 5 resterait dans le top — la boîte reflète l'état courant,
    // pas le compteur d'erreurs.
    const sessions = profile.sessionHistory;
    const cutoff =
      sessions.length > HARD_FACTS_WINDOW
        ? sessions[sessions.length - HARD_FACTS_WINDOW].date
        : null;

    const hard = profile.facts
      .filter((f) => f.introduced)
      .map((f) => ({
        ...f,
        errorCount: f.history.filter(
          (h) => !h.correct && (cutoff === null || h.date >= cutoff),
        ).length,
      }))
      .sort((a, b) => b.errorCount - a.errorCount || a.box - b.box)
      .slice(0, 5)
      .filter((f) => f.errorCount > 0);

    return {
      boxCounts: counts,
      maxBoxCount: Math.max(...counts, 1),
      hardFacts: hard,
    };
  }, [profile.facts, profile.sessionHistory]);

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
      const date = new Date(s.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
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
  }, [profile.sessionHistory]);

  const boxColors = [
    'var(--box-gray)', 'var(--box-red)', 'var(--box-orange)',
    'var(--box-yellow)', 'var(--box-lightgreen)', 'var(--box-green)',
  ];
  const boxLabels = ['N/A', 'B1', 'B2', 'B3', 'B4', 'B5'];

  const handleImport = () => {
    if (importJson.trim()) {
      onImport(importJson.trim());
      setShowImport(false);
      setImportJson('');
    }
  };

  return (
    <div className="parent-dashboard">
      <div className="parent-header">
        <button className="parent-back-btn" onClick={onBack} aria-label="Retour">
          <BackChevron />
        </button>
        <div className="parent-header-titles">
          <div className="parent-eyebrow">Espace parent</div>
          <div className="parent-title">{profile.name}{' \u00b7 '}profil</div>
        </div>
      </div>

      {/* General stats */}
      <div className="parent-section">
        <h3>Vue d'ensemble</h3>
        <div className="parent-stats-grid">
          <div className="parent-stat-card">
            <div className="parent-stat-value">{profile.totalSessions}</div>
            <div className="parent-stat-label">Séances</div>
          </div>
          <div className="parent-stat-card">
            <div className="parent-stat-value">{getActiveStreak(profile, todayISO())}</div>
            <div className="parent-stat-label">Série actuelle</div>
          </div>
          <div className="parent-stat-card">
            <div className="parent-stat-value">{profile.longestStreak}</div>
            <div className="parent-stat-label">Meilleure série</div>
          </div>
          <div className="parent-stat-card">
            <div className="parent-stat-value">
              {profile.facts.filter((f) => f.box >= 4).length}/
              {profile.facts.length}
            </div>
            <div className="parent-stat-label">Faits maîtrisés</div>
          </div>
        </div>
      </div>

      {/* Box histogram */}
      <div className="parent-section">
        <h3>
          Répartition par boîte
          <a
            className="parent-section-help"
            href={`${import.meta.env.BASE_URL}guide/#principes`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="En savoir plus sur le système de Leitner"
          >
            ?
          </a>
        </h3>
        <p className="parent-section-subtitle">
          Combien de multiplications dans chaque boîte de révision (B1 = à
          réviser souvent, B5 = bien ancrées).
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
          Grille Leitner
          <a
            className="parent-section-help"
            href={`${import.meta.env.BASE_URL}guide/#principes`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="En savoir plus sur le système de Leitner"
          >
            ?
          </a>
        </h3>
        <p className="parent-section-subtitle">
          Une case par multiplication, colorée selon sa boîte. Le rouge signale
          les faits récents ou en difficulté, le vert ceux bien ancrés.
        </p>
        <ProgressGrid facts={profile.facts} />
      </div>

      {/* Evolution: accuracy + response time */}
      {evolution && (
        <>
          <div className="parent-section">
            <h3>Taux de bonnes réponses</h3>
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
            <h3>Temps de réponse moyen</h3>
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
          <h3>Faits les plus difficiles</h3>
          <p className="parent-section-subtitle">
            Sur les {HARD_FACTS_WINDOW} dernières séances.
          </p>
          <div className="parent-hard-facts">
            {hardFacts.map((f) => (
              <div key={getFactKey(f.a, f.b)} className="parent-hard-fact">
                <span className="parent-hard-fact-name">
                  {f.a} {'\u00D7'} {f.b} = {f.product}
                </span>
                <span className="parent-hard-fact-errors">
                  {f.errorCount} erreur{f.errorCount > 1 ? 's' : ''} | Boîte{' '}
                  {f.box}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history */}
      {profile.sessionHistory.length > 0 && (
        <div className="parent-section">
          <h3>Historique des séances</h3>
          <div className="parent-session-history">
            {recentSessions.map((session) => {
              const dateStr = new Date(session.date).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              });
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

      {/* Actions */}
      <div className="parent-section">
        <h3>Sauvegarde</h3>
        <div className="parent-actions">
          <button className="parent-action-btn" onClick={onExport}>
            Exporter
          </button>
          <button
            className="parent-action-btn"
            onClick={() => setShowImport(!showImport)}
          >
            Importer
          </button>
        </div>
      </div>

      <div className="parent-section">
        <h3>Aide & retours</h3>
        <div className="parent-actions">
          <a
            className="parent-action-btn"
            href={`${import.meta.env.BASE_URL}guide/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Guide utilisateur
          </a>
          <button
            className="parent-action-btn"
            onClick={() => setShowFeedback(true)}
          >
            Envoyer un avis
          </button>
        </div>
      </div>

      <div className="parent-section">
        <h3>À propos</h3>
        <div className="parent-actions">
          <button
            className="parent-action-btn"
            onClick={onShowChangelog}
          >
            Nouveautés
          </button>
          <button
            className="parent-action-btn"
            onClick={onShowPrivacy}
          >
            Confidentialité
          </button>
        </div>
      </div>

      <div className="parent-section">
        <h3>Réinitialisation</h3>
        <p className="parent-section-subtitle">
          Efface le profil et relance le test de placement. Utile pour
          recommencer à zéro ou changer d'enfant.
        </p>
        <div className="parent-actions">
          <button
            className="parent-action-btn parent-action-btn--danger"
            onClick={onResetProfile}
          >
            Réinitialiser le profil
          </button>
        </div>
      </div>

      {showImport && (
        <div className="parent-import-area">
          <textarea
            className="parent-import-textarea"
            placeholder="Collez le JSON ici..."
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <button
            className="parent-import-confirm"
            onClick={handleImport}
            disabled={!importJson.trim()}
          >
            Confirmer l'import
          </button>
        </div>
      )}

      {showFeedback && (
        <FeedbackModal profile={profile} onClose={() => setShowFeedback(false)} />
      )}

      <div className="parent-version" aria-label="Version de l'app">v{import.meta.env.VITE_APP_VERSION}</div>
    </div>
  );
}
