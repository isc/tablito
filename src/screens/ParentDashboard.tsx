import { useState, useMemo, useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import { isDivisionUnlocked, isRemainderUnlocked, activeLevel } from '../lib/badges';
import { countMastered } from '../lib/leitner';
import { getHardestFacts } from '../lib/hardestFacts';
import { getActiveStreak } from '../lib/streak';
import { todayISO } from '../lib/utils';
import ProgressGrid from '../components/ProgressGrid';
import DivisionProgressGrid from '../components/DivisionProgressGrid';
import RemainderProgressGrid from '../components/RemainderProgressGrid';
import BackChevron from '../components/BackChevron';
import FeedbackModal from '../components/FeedbackModal';
import EvolutionChart from '../components/EvolutionChart';
import NotificationSettings from '../components/NotificationSettings';
import LanguageToggle from '../components/LanguageToggle';
import { useLang } from '../i18n/lang';
import { useParentDashboardStrings } from '../i18n/parent';
import { createTransfer, transferConfigured, TRANSFER_TTL_MINUTES } from '../lib/transfer';

const HARD_FACTS_WINDOW = 10;
const EVOLUTION_WINDOW = 20;

interface ParentDashboardProps {
  profile: UserProfile;
  onBack: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  // Multi-profils : lance l'onboarding Welcome pour un nouvel enfant.
  onAddProfile: () => void;
  // Supprime le profil actif (avec confirmation côté App).
  onDeleteProfile: () => void;
  onShowPrivacy: () => void;
  onShowChangelog: () => void;
}

export default function ParentDashboard({
  profile,
  onBack,
  onExport,
  onImport,
  onAddProfile,
  onDeleteProfile,
  onShowPrivacy,
  onShowChangelog,
}: ParentDashboardProps) {
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // Transfert vers un autre appareil : un seul état, l'objet {link} valant
  // « prêt, QR à afficher » (cf. lib/transfer) — aucune combinaison incohérente
  // possible entre statut et lien.
  const [transfer, setTransfer] = useState<'idle' | 'loading' | 'error' | { link: string }>('idle');
  const transferLink = typeof transfer === 'object' ? transfer.link : null;
  const [transferCopied, setTransferCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // « Copié ✓ » pendant 2 s — partagé par « Partager l'app » et le lien de
  // transfert. Échec silencieux : clipboard indisponible (contexte non
  // sécurisé), l'utilisateur a d'autres chemins (feuille de partage, QR).
  const copyWithFeedback = async (text: string, setFlag: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch {
      // ignore
    }
  };
  const t = useParentDashboardStrings();
  const { lang } = useLang();
  // Le guide est bilingue : FR à `/guide/`, autres langues sous `/guide/<lang>/`
  // (cf. scripts/generate-user-guide.mjs). On pointe vers la version courante.
  const guideBase = `${import.meta.env.BASE_URL}guide/${lang === 'fr' ? '' : `${lang}/`}`;

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

  const handleShare = async () => {
    const url = window.location.origin + import.meta.env.BASE_URL;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tablito',
          text: t.shareText,
          url,
        });
      } catch {
        // Annulation utilisateur : pas de fallback clipboard, sinon on copie
        // un lien que l'utilisateur a explicitement refusé de partager.
      }
      return;
    }
    await copyWithFeedback(url, setShareCopied);
  };

  const handleTransfer = async () => {
    if (transfer !== 'idle') {
      // Second clic : replie le panneau. Le code déposé expirera tout seul.
      setTransfer('idle');
      setTransferCopied(false);
      return;
    }
    setTransfer('loading');
    const link = await createTransfer(profile);
    setTransfer(link ? { link } : 'error');
  };

  // Dessine le QR quand le lien est prêt. lean-qr est chargé à la demande :
  // inutile d'alourdir le chunk du dashboard pour une action rare.
  useEffect(() => {
    if (!transferLink) return;
    let cancelled = false;
    import('lean-qr')
      .then(({ generate }) => {
        if (!cancelled && qrCanvasRef.current) {
          generate(transferLink).toCanvas(qrCanvasRef.current);
        }
      })
      .catch(() => {
        if (!cancelled) setTransfer('error');
      });
    return () => {
      cancelled = true;
    };
  }, [transferLink]);

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
  const hardFacts = useMemo(
    () => getHardestFacts(profile, HARD_FACTS_WINDOW, 5),
    [profile],
  );

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
        <button className="parent-back-btn" onClick={onBack} aria-label={t.back}>
          <BackChevron />
        </button>
        <div className="parent-header-titles">
          <div className="parent-eyebrow">{t.parentArea}</div>
          <div className="parent-title">{t.profileSuffix(profile.name)}</div>
        </div>
      </div>

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
                    ? t.formatRemFact(
                        f.divisor * f.quotient,
                        f.divisor * f.quotient + f.divisor - 1,
                        f.divisor,
                      )
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

      {/* Actions */}
      <div className="parent-section">
        <h3>{t.backup}</h3>
        <div className="parent-actions">
          {transferConfigured() && (
            <button className="parent-action-btn" onClick={handleTransfer}>
              {t.transfer}
            </button>
          )}
          <button className="parent-action-btn" onClick={onExport}>
            {t.export}
          </button>
          <button
            className="parent-action-btn"
            onClick={() => setShowImport(!showImport)}
          >
            {t.import}
          </button>
        </div>
        {transfer !== 'idle' && (
          <div className="parent-transfer-area">
            {transfer === 'loading' && (
              <p className="parent-transfer-status">{t.transferPreparing}</p>
            )}
            {transfer === 'error' && (
              <p className="parent-transfer-status parent-transfer-status--error">
                {t.transferError}
              </p>
            )}
            {transferLink && (
              <>
                <canvas
                  ref={qrCanvasRef}
                  className="parent-transfer-qr"
                  role="img"
                  aria-label={t.transferQrAlt}
                />
                <p className="parent-transfer-hint">
                  {t.transferHint(TRANSFER_TTL_MINUTES)}
                </p>
                <button
                  className="parent-action-btn"
                  onClick={() => copyWithFeedback(transferLink, setTransferCopied)}
                >
                  {transferCopied ? t.linkCopied : t.transferCopyLink}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="parent-section">
        <h3>{t.helpAndFeedback}</h3>
        <div className="parent-actions">
          <a
            className="parent-action-btn"
            href={guideBase}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.userGuide}
          </a>
          <button
            className="parent-action-btn"
            onClick={() => setShowFeedback(true)}
          >
            {t.sendFeedback}
          </button>
        </div>
      </div>

      <NotificationSettings />

      <div className="parent-section">
        <h3>{t.shareTablito}</h3>
        <p className="parent-section-subtitle">
          {t.shareSubtitle}
        </p>
        <div className="parent-actions">
          <button className="parent-action-btn" onClick={handleShare}>
            {shareCopied ? t.linkCopied : t.shareApp}
          </button>
        </div>
      </div>

      <div className="parent-section">
        <LanguageToggle />
      </div>

      <div className="parent-section">
        <h3>{t.about}</h3>
        <div className="parent-actions">
          <button
            className="parent-action-btn"
            onClick={onShowChangelog}
          >
            {t.whatsNew}
          </button>
          <button
            className="parent-action-btn"
            onClick={onShowPrivacy}
          >
            {t.privacy}
          </button>
        </div>
      </div>

      <div className="parent-section">
        <h3>{t.profiles}</h3>
        <p className="parent-section-subtitle">
          {t.profilesSubtitle(profile.name)}
        </p>
        <div className="parent-actions">
          <button className="parent-action-btn" onClick={onAddProfile}>
            {t.addChild}
          </button>
          <button
            className="parent-action-btn parent-action-btn--danger"
            onClick={onDeleteProfile}
          >
            {t.deleteThisProfile}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="parent-import-area">
          <textarea
            className="parent-import-textarea"
            placeholder={t.pasteJsonHere}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <button
            className="parent-import-confirm"
            onClick={handleImport}
            disabled={!importJson.trim()}
          >
            {t.confirmImport}
          </button>
        </div>
      )}

      {showFeedback && (
        <FeedbackModal profile={profile} onClose={() => setShowFeedback(false)} />
      )}

      <div className="parent-version" aria-label={t.appVersionLabel}>v{import.meta.env.VITE_APP_VERSION}</div>
    </div>
  );
}
