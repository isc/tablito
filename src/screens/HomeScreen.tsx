import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { UserProfile } from '../types';
import Mascot from '../components/Mascot';
import Feather from '../components/Feather';
import ParentGate from '../components/ParentGate';
import StreakDetailModal from '../components/StreakDetailModal';
import FlameIcon from '../components/FlameIcon';
import { getActiveStreak, isStreakProtectedByFreeze } from '../lib/streak';
import { todayISO } from '../lib/utils';
import { useHomeStrings } from '../i18n/home';

interface HomeScreenProps {
  profile: UserProfile;
  hasSessionAvailable: boolean;
  hasNewRule: boolean;
  // Niveau 2 — division (cf. specs §11). divisionUnlocked = les 8 badges de
  // table obtenus (toutes les tables maîtrisées) : la tuile « Mon image »
  // devient « Mes images » (l'écran progression montre alors les deux images,
  // multiplication et division).
  divisionUnlocked: boolean;
  // === Matière conjugaison (spec Verbito §9 : « l'accueil devient un choix de
  // matière »). Faux hors français : la matière est fr-only et RIEN n'en
  // transparaît alors — l'accueil reste exactement celui d'avant.
  conjAvailable: boolean;
  // La séance de conjugaison du jour reste-t-elle à faire ? (Indépendante de
  // celle de maths : faire l'une ne ferme pas l'autre.)
  hasConjSessionAvailable: boolean;
  // La matière a-t-elle déjà été ouverte ? Faux + `conjAvailable` = elle est
  // là mais jamais touchée : c'est la pastille discrète de découverte
  // (révélation différée, comme la règle bonus ×11 — jamais de modale).
  conjVisible: boolean;
  onStartConj: () => void;
  onStart: () => void;
  onShowProgress: () => void;
  onShowBadges: () => void;
  onShowRules: () => void;
  onShowParent: () => void;
  // Présent uniquement quand l'appareil héberge plusieurs profils : ouvre
  // l'écran « Qui joue ? ». Absent en mono-profil (pas de bouton).
  onSwitchProfile?: () => void;
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

function buildStreakLabel(
  t: ReturnType<typeof useHomeStrings>,
  activeStreak: number,
  protectedByFreeze: boolean,
  freezes: number,
): string {
  if (activeStreak === 0) return t.streakBroken;
  const days = t.days(activeStreak);
  if (protectedByFreeze) return t.streakProtected(days);
  const reserve = freezes > 0 ? t.streakReserve(freezes) : '';
  return t.streakNormal(days, reserve);
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

function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.5 14.2c2.2.1 3.7 1.4 4.2 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Icônes des deux matières. Volontairement sobres et de même facture (même
// cadre, même trait) : c'est un choix entre deux pairs, pas une hiérarchie.
function IconMaths() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6" fill="var(--indigo-soft)" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M11 11 L 15 15 M 15 11 L 11 15" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 20 H 23" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20.5" cy="17" r="1.2" fill="var(--ink)" />
      <circle cx="20.5" cy="23" r="1.2" fill="var(--ink)" />
    </svg>
  );
}

function IconVerb() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6" fill="var(--honey-soft)" stroke="var(--ink)" strokeWidth="1.6" />
      {/* Un « mot » coupé en deux : radical en encre, terminaison en couleur —
          la segmentation radical|terminaison est LA signature de la matière
          (§2.3), et elle se lit même à 30 px, contrairement à des lettres. */}
      <rect x="8.5" y="12" width="9" height="3.2" rx="1.6" fill="var(--ink)" />
      <rect x="19" y="12" width="4.5" height="3.2" rx="1.6" fill="var(--coral)" />
      <rect x="8.5" y="18" width="6" height="3.2" rx="1.6" fill="var(--ink)" opacity="0.35" />
      <rect x="16" y="18" width="4.5" height="3.2" rx="1.6" fill="var(--coral)" opacity="0.45" />
    </svg>
  );
}

function IconRuler() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="22" height="12" rx="2" fill="var(--sage-soft)" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M10 10 L 10 14 M 14 10 L 14 15 M 18 10 L 18 14 M 22 10 L 22 15" stroke="var(--ink)" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Tuile de matière (spec Verbito §9). Une matière dont la séance du jour est
 * faite n'est pas grisée-punie : elle porte un ✓ tranquille et ne se relance
 * pas — même esprit que « c'est fait pour aujourd'hui » du mono-matière.
 */
function SubjectTile({
  icon,
  label,
  available,
  isNew = false,
  onStart,
  t,
}: {
  icon: ReactNode;
  label: string;
  available: boolean;
  isNew?: boolean;
  onStart: () => void;
  t: ReturnType<typeof useHomeStrings>;
}) {
  return (
    <button
      type="button"
      className={`home-subject-btn${available ? '' : ' is-done'}`}
      onClick={onStart}
      disabled={!available}
      aria-label={available ? t.subjectStart(label) : t.subjectDoneLabel(label)}
    >
      <span className="home-subject-icon">{icon}</span>
      <span className="home-subject-label">{label}</span>
      <span className="home-subject-state">{available ? `▶ ${t.letsGo}` : t.subjectDone}</span>
      {isNew && (
        <span className="home-subject-dot" aria-label={t.subjectNewLabel(label)} role="status" />
      )}
    </button>
  );
}

export default function HomeScreen({
  profile,
  hasSessionAvailable,
  hasNewRule,
  divisionUnlocked,
  conjAvailable = false,
  hasConjSessionAvailable = false,
  conjVisible = false,
  onStartConj,
  onStart,
  onShowProgress,
  onShowBadges,
  onShowRules,
  onShowParent,
  onSwitchProfile,
}: HomeScreenProps) {
  const t = useHomeStrings();
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
  const streakLabel = buildStreakLabel(t, activeStreak, protectedByFreeze, freezes);
  // Le prénom est mis en couleur via un <span> : on découpe le libellé
  // localisé autour du prénom pour garder le markup tout en traduisant.
  const [greetingBefore, greetingAfter] = t.greeting(profile.name).split(profile.name);
  const greetingParts = { before: greetingBefore, after: greetingAfter ?? '' };

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
                    {t.days(activeStreak).replace(`${activeStreak} `, '')}
                  </span>
                  {showFreezeBadge && (
                    <span className="home-streak-pill-freeze" aria-hidden="true">
                      <span className="home-streak-pill-freeze-icon">❄️</span>
                      {freezes > 1 && <span className="home-streak-pill-freeze-count">{freezes}</span>}
                    </span>
                  )}
                </>
              ) : (
                <span className="home-streak-pill-prompt">{t.backToIt}</span>
              )}
            </button>
          )}
        </div>
        <div className="home-top-bar-right">
          {onSwitchProfile && (
            <button
              className="home-chrome-btn home-switch-btn"
              onClick={onSwitchProfile}
              aria-label={t.switchPlayer}
            >
              <IconUsers />
            </button>
          )}
          <button
            className="home-chrome-btn home-parent-btn"
            onClick={() => setShowParentGate(true)}
            aria-label={t.parentAccess}
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
                  aria-label={t.tickleMascot}
                >
                  <Mascot mood={mascotMood} />
                </button>
              </>
            )}
            <div className="home-greeting">
              {greetingParts.before}<span>{profile.name}</span>{greetingParts.after}
            </div>
          </div>
        </div>

        <div className="home-cta-wrap">
          {conjAvailable ? (
            // Deux matières ⇒ deux tuiles jumelles. Chacune porte l'état de SA
            // séance du jour ; la flamme de série, elle, reste partagée (§7.2 :
            // une séance quelconque la maintient).
            <div className="home-subjects">
              <SubjectTile
                icon={<IconMaths />}
                label={t.subjectMaths}
                available={hasSessionAvailable}
                onStart={onStart}
                t={t}
              />
              <SubjectTile
                icon={<IconVerb />}
                label={t.subjectConj}
                available={hasConjSessionAvailable}
                isNew={!conjVisible}
                onStart={onStartConj}
                t={t}
              />
            </div>
          ) : hasSessionAvailable ? (
            <button className="btn btn--indigo home-start-btn" onClick={onStart}>
              {'▶'} {t.letsGo}
            </button>
          ) : (
            <div className="home-done-msg">{t.doneForToday}</div>
          )}
        </div>

        <div className="home-nav">
          <button className="home-nav-btn" onClick={onShowProgress}>
            <span className="home-nav-btn-icon"><IconImage /></span>
            {/* Plusieurs images dès qu'un 2ᵉ inventaire existe : niveau 2
                débloqué OU matière conjugaison ouverte. */}
            <span className="home-nav-btn-label">
              {divisionUnlocked || conjVisible ? t.myPictures : t.myPicture}
            </span>
          </button>
          <button className="home-nav-btn" onClick={onShowBadges}>
            <span className="home-nav-btn-icon"><IconBadge /></span>
            <span className="home-nav-btn-label">{t.badges}</span>
          </button>
          <button
            className="home-nav-btn"
            onClick={onShowRules}
            aria-label={hasNewRule ? t.rulesWithNew : t.rules}
          >
            <span className="home-nav-btn-icon"><IconRuler /></span>
            <span className="home-nav-btn-label">{t.rules}</span>
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
