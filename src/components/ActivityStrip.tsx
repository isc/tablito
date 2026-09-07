// Bandeau d'activité de l'espace parent : l'état du jour en une phrase, puis
// les 14 derniers jours en colonnes. Répond à la question que ni les cartes
// cumulatives (« Séances », « Série ») ni le sélecteur d'opération ne
// posaient — « a-t-il travaillé aujourd'hui, et sur quoi ? ».
//
// Une colonne = un jour, un segment = une matière (maths en haut, conjugaison
// en dessous). Comme une matière ne peut être faite qu'une fois par jour, un
// segment est plein ou vide : rien à compter, rien à plafonner.

import { useMemo } from 'react';
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
}

export default function ActivityStrip({ profile, today, conjVisible }: ActivityStripProps) {
  const t = useParentDashboardStrings();
  const days = useMemo(() => buildActivityDays(profile, today), [profile, today]);
  // Initiales des jours calculées avec la fenêtre, pas au rendu : chaque appel
  // à `toLocaleDateString` avec des options construit un `Intl.DateTimeFormat`,
  // et le bandeau se re-rend à chaque clic d'onglet d'opération au-dessus.
  const labels = useMemo(
    () => days.map((d) => t.formatWeekdayNarrow(new Date(`${d.date}T00:00:00`))),
    [days, t],
  );
  const current = days[days.length - 1];
  // Matière masquée (jamais ouverte, ou langue anglaise où elle n'existe pas) :
  // on l'ignore partout, sinon la phrase du jour pourrait mentionner une séance
  // dont le bandeau ne montre pas la ligne.
  const conjToday = conjVisible ? current.conj : null;

  function todayState(): string {
    if (!conjVisible) return current.math ? t.activitySessionDone : t.activityNothingYet;
    if (current.math && conjToday) return t.activityBothDone;
    if (current.math) return t.activityMathDone;
    if (conjToday) return t.activityConjDone;
    return t.activityNothingYet;
  }

  // Sous-titre : ce que le titre laisse en suspens. Quand une seule matière est
  // faite, l'autre reste à faire — et quand rien n'est fait, ce qui manque au
  // parent est la date de la dernière séance, pas la liste des matières.
  function subtitle(): string | null {
    if (!current.math && !conjToday) {
      const last = profile.lastSessionDate;
      return last ? t.activityLastSession(daysBetween(last, today)) : t.activityNoSessionEver;
    }
    if (conjToday === false) return t.activityConjPending;
    if (conjVisible && !current.math) return t.activityMathPending;
    return null;
  }

  // `null` = matière pas encore ouverte ce jour-là : ni case pleine ni case
  // vide, pour ne pas afficher un jour manqué là où il n'y avait pas de matière.
  const segClass = (subject: string, done: boolean | null) =>
    `parent-activity-seg parent-activity-seg--${subject}${
      done === null ? ' is-void' : done ? ' is-done' : ''
    }`;

  const sub = subtitle();

  return (
    <div className="parent-stat-card parent-activity">
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
            </div>
            <div className="parent-activity-label">{labels[i]}</div>
          </div>
        ))}
      </div>
      {conjVisible && (
        <div className="parent-activity-legend">
          <span className="parent-activity-legend-item">
            <span className="parent-activity-swatch parent-activity-swatch--math" />
            {t.activityMath}
          </span>
          <span className="parent-activity-legend-item">
            <span className="parent-activity-swatch parent-activity-swatch--conj" />
            {t.conjugations}
          </span>
        </div>
      )}
    </div>
  );
}
