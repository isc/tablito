import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import Mascot from '../components/Mascot';
import Feather from '../components/Feather';
import ParentGate from '../components/ParentGate';
import StreakDetailModal from '../components/StreakDetailModal';
import FlameIcon from '../components/FlameIcon';
import { getActiveStreak, isStreakProtectedByFreeze } from '../lib/streak';
import { todayISO, pluralize } from '../lib/utils';

interface HomeScreenProps {
  profile: UserProfile;
  hasSessionAvailable: boolean;
  hasNewRule: boolean;
  // Niveau 2 — division (cf. specs §11). divisionUnlocked = les 8 badges de
  // table obtenus (toutes les tables maîtrisées) : la tuile « Mon image »
  // devient « Mes images » (l'écran progression montre alors les deux images,
  // multiplication et division).
  divisionUnlocked: boolean;
  onStart: () => void;
  onShowProgress: () => void;
  onShowBadges: () => void;
  onShowRules: () => void;
  onShowParent: () => void;
}

function IconGear() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.43 12.98c.04-.32.07-.65.07-.98 0-.33-.03-.66-.07-.98l2.11-1.65a.5.5 0 00.12-.64l-2-3.46a.5.5 0 00-.61-.22l-2.49 1a7.03 7.03 0 00-1.69-.98l-.38-2.65A.5.5 0 0014 2h-4a.5.5 0 00-.5.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1a.5.5 0 00-.61.22l-2 3.46a.5.5 0 00.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65a.5.5 0 00-.12.64l2 3.46c.14.22.39.31.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.05.24.26.42.5.42h4c.24 0 .45-.18.5-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.22.09.47 0 .61-.22l2-3.46a.5.5 0 00-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1115.5 12 3.5 3.5 0 0112 15.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="7" width="22" height="18" rx="2.5" stroke="var(--ink)" strokeWidth="1.6" fill="var(--sage-soft)" />
      <circle cx="11" cy="13" r="2" fill="var(--sage)" />
      <path d="M6 23l7-7 5 4 7-6" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconBadge() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="14" r="9" fill="var(--honey)" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M9 22 L 6 30 L 11 27 L 13 30 L 16 22" fill="var(--coral)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M23 22 L 26 30 L 21 27 L 19 30 L 16 22" fill="var(--coral)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 10 L 17.2 12.5 L 20 13 L 18 15 L 18.4 17.8 L 16 16.5 L 13.6 17.8 L 14 15 L 12 13 L 14.8 12.5 Z" fill="var(--cream)" />
    </svg>
  );
}

function buildStreakLabel(activeStreak: number, protectedByFreeze: boolean, freezes: number): string {
  if (activeStreak === 0) return 'Série interrompue — voir les détails';
  const days = `${activeStreak} ${pluralize(activeStreak, 'jour')}`;
  if (protectedByFreeze) return `Série de ${days} protégée par un gel — voir les détails`;
  const reserve = freezes > 0 ? `, ${freezes} ${pluralize(freezes, 'gel')} en réserve` : '';
  return `Série de ${days}${reserve} — voir les détails`;
}

// Easter egg : chatouiller Piou 4 fois sur la home le fait s'envoler. Il
// laisse une plume au sol et revient au bout de 15 min. État au niveau
// module pour survivre aux unmounts de HomeScreen pendant la navigation,
// mais pas persisté : un reload de l'app réarme l'easter egg.
type MascotMood = 'idle' | 'happy' | 'celebrate' | 'flyaway';
const TICKLE_MOODS: MascotMood[] = ['happy', 'celebrate', 'happy', 'flyaway'];
const HIDDEN_DURATION_MS = 15 * 60 * 1000;
const FLYAWAY_ANIMATION_MS = 900;
const MOOD_RESET_MS = 1500;
let easterTickleCount = 0;
let easterHiddenUntil = 0;

function IconRuler() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="22" height="12" rx="2" fill="var(--sage-soft)" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M10 10 L 10 14 M 14 10 L 14 15 M 18 10 L 18 14 M 22 10 L 22 15" stroke="var(--ink)" strokeWidth="1.4" />
    </svg>
  );
}

export default function HomeScreen({
  profile,
  hasSessionAvailable,
  hasNewRule,
  divisionUnlocked,
  onStart,
  onShowProgress,
  onShowBadges,
  onShowRules,
  onShowParent,
}: HomeScreenProps) {
  const [showParentGate, setShowParentGate] = useState(false);
  const [showStreakDetail, setShowStreakDetail] = useState(false);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const [hiddenUntil, setHiddenUntil] = useState(() =>
    easterHiddenUntil > Date.now() ? easterHiddenUntil : 0,
  );
  const tickleTimerRef = useRef<number | null>(null);
  const isHidden = hiddenUntil > 0;

  useEffect(() => {
    return () => {
      if (tickleTimerRef.current) clearTimeout(tickleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hiddenUntil === 0) return;
    const t = window.setTimeout(() => {
      easterHiddenUntil = 0;
      easterTickleCount = 0;
      setHiddenUntil(0);
      setMascotMood('idle');
    }, hiddenUntil - Date.now());
    return () => clearTimeout(t);
  }, [hiddenUntil]);

  function handleMascotTickle() {
    if (isHidden || mascotMood === 'flyaway') return;
    easterTickleCount += 1;
    const next = TICKLE_MOODS[Math.min(easterTickleCount - 1, TICKLE_MOODS.length - 1)];
    if (tickleTimerRef.current) clearTimeout(tickleTimerRef.current);
    setMascotMood(next);
    if (next === 'flyaway') {
      tickleTimerRef.current = window.setTimeout(() => {
        easterHiddenUntil = Date.now() + HIDDEN_DURATION_MS;
        setHiddenUntil(easterHiddenUntil);
        tickleTimerRef.current = null;
      }, FLYAWAY_ANIMATION_MS);
      return;
    }
    tickleTimerRef.current = window.setTimeout(() => {
      setMascotMood('idle');
      tickleTimerRef.current = null;
    }, MOOD_RESET_MS);
  }

  const today = todayISO();
  const activeStreak = getActiveStreak(profile, today);
  const streakActive = activeStreak > 0;
  const protectedByFreeze = isStreakProtectedByFreeze(profile, today);
  const freezes = profile.streakFreezes;
  const showStreakPill = streakActive || profile.totalSessions > 0;
  const showFreezeBadge = streakActive && freezes > 0;
  const streakLabel = buildStreakLabel(activeStreak, protectedByFreeze, freezes);

  return (
    <div className="home-screen">
      <div className="home-top-bar">
        <div className="home-top-bar-left">
          {showStreakPill && (
            <button
              type="button"
              className="home-streak-pill"
              onClick={() => setShowStreakDetail(true)}
              aria-label={streakLabel}
            >
              <span className="home-streak-pill-flame"><FlameIcon size={14} muted={!streakActive} /></span>
              {streakActive ? (
                <>
                  <span className="home-streak-pill-count">{activeStreak}</span>
                  <span className="home-streak-pill-label">
                    {pluralize(activeStreak, 'jour')}
                  </span>
                  {showFreezeBadge && (
                    <span className="home-streak-pill-freeze" aria-hidden="true">
                      <span className="home-streak-pill-freeze-icon">❄️</span>
                      {freezes > 1 && <span className="home-streak-pill-freeze-count">{freezes}</span>}
                    </span>
                  )}
                </>
              ) : (
                <span className="home-streak-pill-prompt">On s'y remet&nbsp;?</span>
              )}
            </button>
          )}
        </div>
        <div className="home-top-bar-right">
          <button
            className="home-chrome-btn home-parent-btn"
            onClick={() => setShowParentGate(true)}
            aria-label="Accès parent"
          >
            <IconGear />
          </button>
        </div>
      </div>

      <div className="home-body">
        <div className="home-mascot-section">
          <div className="home-mascot-wrap">
            {isHidden ? (
              <div className="home-mascot-empty" aria-hidden="true">
                <Feather />
              </div>
            ) : (
              <>
                <div className="home-mascot-halo" />
                <button
                  type="button"
                  className="home-mascot-tickle"
                  onClick={handleMascotTickle}
                  aria-label="Chatouiller la mascotte"
                >
                  <Mascot mood={mascotMood} />
                </button>
              </>
            )}
            <div className="home-greeting">
              Salut <span>{profile.name}</span>&nbsp;!
            </div>
          </div>
        </div>

        <div className="home-cta-wrap">
          {hasSessionAvailable ? (
            <button className="btn btn--indigo home-start-btn" onClick={onStart}>
              {'▶'} C'est parti&nbsp;!
            </button>
          ) : (
            <div className="home-done-msg">Bravo, c'est fait pour aujourd'hui&nbsp;!</div>
          )}
        </div>

        <div className="home-nav">
          <button className="home-nav-btn" onClick={onShowProgress}>
            <span className="home-nav-btn-icon"><IconImage /></span>
            <span className="home-nav-btn-label">{divisionUnlocked ? 'Mes images' : 'Mon image'}</span>
          </button>
          <button className="home-nav-btn" onClick={onShowBadges}>
            <span className="home-nav-btn-icon"><IconBadge /></span>
            <span className="home-nav-btn-label">Badges</span>
          </button>
          <button
            className="home-nav-btn"
            onClick={onShowRules}
            aria-label={hasNewRule ? 'Règles — nouvelle règle débloquée' : 'Règles'}
          >
            <span className="home-nav-btn-icon"><IconRuler /></span>
            <span className="home-nav-btn-label">Règles</span>
            {hasNewRule && <span className="home-nav-btn-dot" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {showParentGate && (
        <ParentGate
          onSuccess={() => { setShowParentGate(false); onShowParent(); }}
          onClose={() => setShowParentGate(false)}
        />
      )}

      {showStreakDetail && (
        <StreakDetailModal
          profile={profile}
          onClose={() => setShowStreakDetail(false)}
        />
      )}
    </div>
  );
}
