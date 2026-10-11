// Bandeau d'activité de l'espace parent : l'état du jour en une phrase, puis
// les 14 derniers jours en colonnes. Répond à la question que les compteurs
// cumulés (« Séances », « Série ») ne posent pas — « a-t-il travaillé
// aujourd'hui, et sur quoi ? ».
//
// Une colonne = un jour, un segment = une matière (maths en haut, puis
// conjugaison et verbes anglais quand elles sont ouvertes). Comme une matière ne peut être faite qu'une fois par jour, un
// segment est plein ou vide : rien à compter, rien à plafonner.

import { useMemo, type ReactNode } from 'react';
import type { UserProfile } from '../types';
import { buildActivityDays } from '../lib/activity';
import { daysBetween } from '../lib/utils';
import { useParentDashboardStrings } from '../i18n/parent';

interface ActivityStripProps {
  profile: UserProfile;
  today: string;
  // Matière conjugaison ouverte : sans elle le bandeau n'a qu'une ligne, et la
  // phrase du jour parle de « la » séance plutôt que de nommer les matières.
  conjVisible: boolean;
  // Matière verbes irréguliers ouverte (specs §16), même rôle.
  irrVisible?: boolean;
  // Bas de carte : les compteurs cumulés (séances, séries) de l'accueil de
  // l'espace parent, qui complètent la journée sans prendre une carte de plus.
  children?: ReactNode;
}

export default function ActivityStrip({
  profile,
  today,
  conjVisible,
  irrVisible = false,
  children,
}: ActivityStripProps) {
  const t = useParentDashboardStrings();
  const days = useMemo(() => buildActivityDays(profile, today), [profile, today]);
  // Initiales des jours calculées avec la fenêtre, pas au rendu : chaque appel
  // à `toLocaleDateString` avec des options construit un `Intl.DateTimeFormat`,
  // et le bandeau se re-rend avec l'accueil de l'espace parent.
  const labels = useMemo(
    () => days.map((d) => t.formatWeekdayNarrow(new Date(`${d.date}T00:00:00`))),
    [days, t],
  );
  const current = days[days.length - 1];
  // Matières montrées, maths en tête. Une matière masquée (jamais ouverte, ou
  // langue où elle n'existe pas) est ignorée partout, sinon la phrase du jour
  // pourrait mentionner une séance dont le bandeau ne montre pas la ligne.
  const subjects = [
    { key: 'math', name: t.math, today: current.math as boolean | null, done: t.activityMathDone, pending: t.activityMathPending },
    ...(conjVisible
      ? [{ key: 'conj', name: t.conjugations, today: current.conj, done: t.activityConjDone, pending: t.activityConjPending }]
      : []),
    ...(irrVisible
      ? [{ key: 'irr', name: t.irregularVerbs, today: current.irr, done: t.activityIrrDone, pending: t.activityIrrPending }]
      : []),
  ];
  const doneToday = subjects.filter((s) => s.today === true);
  // `false` seulement : une matière ouverte aujourd'hui même mais pas encore
  // faite. `null` (pas encore ouverte ce jour-là) n'est pas « à faire ».
  const pendingToday = subjects.filter((s) => s.today === false);

  function todayState(): string {
    if (subjects.length === 1) return current.math ? t.activitySessionDone : t.activityNothingYet;
    if (doneToday.length === 0) return t.activityNothingYet;
    if (pendingToday.length === 0 && doneToday.length === subjects.length) {
      return subjects.length === 2 && conjVisible ? t.activityBothDone : t.activityAllDone;
    }
    return doneToday.map((s) => s.done).join(', ');
  }

  // Sous-titre : ce que le titre laisse en suspens. Quand une matière est
  // faite, les autres restent à faire — et quand rien n'est fait, ce qui manque
  // au parent est la date de la dernière séance, pas la liste des matières.
  function subtitle(): string | null {
    if (doneToday.length === 0) {
      const last = profile.lastSessionDate;
      return last ? t.activityLastSession(daysBetween(last, today)) : t.activityNoSessionEver;
    }
    if (pendingToday.length === 0) return null;
    return pendingToday.map((s) => s.pending).join(' ');
  }

  // `null` = matière pas encore ouverte ce jour-là : ni case pleine ni case
  // vide, pour ne pas afficher un jour manqué là où il n'y avait pas de matière.
  const segClass = (subject: string, done: boolean | null) =>
    `parent-activity-seg parent-activity-seg--${subject}${
      done === null ? ' is-void' : done ? ' is-done' : ''
    }`;

  const sub = subtitle();

  return (
    <div className="parent-card parent-activity">
      <div className="parent-activity-heading">{t.activityHeading(todayState())}</div>
      {sub && <div className="parent-section-subtitle parent-activity-sub">{sub}</div>}
      <div className="parent-activity-strip" role="img" aria-label={t.activityAlt(days.length)}>
        {days.map((day, i) => (
          <div
            key={day.date}
            className={`parent-activity-day${i === days.length - 1 ? ' is-today' : ''}`}
          >
            <div className="parent-activity-cell">
              <span className={segClass('math', day.math)} />
              {conjVisible && <span className={segClass('conj', day.conj)} />}
              {irrVisible && <span className={segClass('irr', day.irr)} />}
            </div>
            <div className="parent-activity-label">{labels[i]}</div>
          </div>
        ))}
      </div>
      {subjects.length > 1 && (
        <div className="parent-activity-legend">
          {subjects.map((s) => (
            <span key={s.key} className="parent-activity-legend-item">
              <span className={`parent-activity-swatch parent-activity-swatch--${s.key}`} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
