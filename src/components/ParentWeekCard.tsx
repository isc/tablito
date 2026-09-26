// « Le point de la semaine », en tête de l'accueil de l'espace parent, sous la
// journée : ce que l'enfant a fait ces 7 derniers jours, en phrases plutôt
// qu'en graphes, et comment ça se compare aux 7 d'avant. C'est aussi ce que le
// recap du dimanche annonce (cf. scripts/send-reminders.mjs) : sa notification
// ouvre l'espace parent, qui s'ouvre sur cette carte.

import { useMemo, type ReactNode } from 'react';
import type { UserProfile } from '../types';
import type { Subject } from '../lib/hardestFacts';
import { weekSummary, type Trend, type Versus } from '../lib/weekSummary';
import { useParentDashboardStrings } from '../i18n/parent';
import { useWeekStrings } from '../i18n/week';
import { CalendarIcon, GrowthIcon, TargetIcon, TimerIcon } from './ParentSettingIcons';

// Même anatomie qu'une ligne de réglage (icône, titre, sous-titre), en liste
// serrée. Seul un progrès colore le sous-titre : un recul reste dans le ton
// neutre, pour ne pas changer une semaine moins bonne en alerte.
function Row({ icon, main, sub }: { icon: ReactNode; main: string; sub?: { text: string; trend?: Trend } | null }) {
  return (
    <li className="parent-week-row">
      <span className="parent-setting-icon parent-week-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="parent-setting-text parent-week-text">
        <span className="parent-setting-title">{main}</span>
        {sub && (
          <span className={`parent-setting-sub${sub.trend === 'better' ? ' is-better' : ''}`}>{sub.text}</span>
        )}
      </span>
    </li>
  );
}

interface ParentWeekCardProps {
  profile: UserProfile;
  today: string;
  // Matières visibles (cf. ParentOverview) : une matière masquée ne compte nulle part.
  subjects: Subject[];
}

export default function ParentWeekCard({ profile, today, subjects }: ParentWeekCardProps) {
  const t = useParentDashboardStrings();
  const w = useWeekStrings();
  const week = useMemo(() => weekSummary(profile, today, subjects), [profile, today, subjects]);
  // Rien à résumer tant que l'enfant n'a fait aucune séance : la journée le dit.
  if (!week) return null;
  const { math, conj, promoted, discovered } = week;

  // La comparaison avec la semaine d'avant, quand elle est juste (cf.
  // weekSummary) ; sinon la rangée s'en tient au chiffre de la semaine.
  const versus = (vs: Versus | null, say: (trend: Trend, amount: number) => string) =>
    vs && { text: say(vs.trend, Math.abs(vs.delta)), trend: vs.trend };

  return (
    <div className="parent-section parent-week">
      <h2 className="parent-overline">{w.title}</h2>
      <div className="parent-card">
        <ul className="parent-week-rows">
          <Row
            icon={<CalendarIcon />}
            main={week.days > 0 ? w.days(week.days) : w.noSession}
            sub={week.days > 0 ? versus(week.daysVs, w.daysVsBefore) : null}
          />
          {math && (
            <>
              <Row
                icon={<TargetIcon />}
                main={w.mathAccuracy(t.formatPercent(math.accuracy))}
                sub={versus(math.accuracyVs, w.accuracyVsBefore)}
              />
              <Row
                icon={<TimerIcon />}
                main={w.speed(t.formatSeconds(math.seconds))}
                sub={versus(math.secondsVs, (trend, amount) => w.speedVsBefore(trend, t.formatSeconds(amount)))}
              />
            </>
          )}
          {conj && (
            <Row
              icon={<TargetIcon />}
              main={w.conjAccuracy(t.formatPercent(conj.accuracy))}
              sub={versus(conj.accuracyVs, w.accuracyVsBefore)}
            />
          )}
          {(promoted > 0 || discovered > 0) && (
            <Row
              icon={<GrowthIcon />}
              main={promoted > 0 ? w.promoted(promoted) : w.discovered(discovered)}
              sub={promoted > 0 && discovered > 0 ? { text: w.discoveredToo(discovered) } : null}
            />
          )}
        </ul>
      </div>
      <p className="parent-section-subtitle parent-note">{w.note}</p>
    </div>
  );
}
