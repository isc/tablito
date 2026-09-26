// « Le point de la semaine », en tête de l'accueil de l'espace parent, sous la
// journée : ce que l'enfant a fait ces 7 derniers jours, en phrases plutôt
// qu'en graphes, et comment ça se compare aux 7 d'avant. C'est aussi ce que le
// recap du dimanche annonce (cf. scripts/send-reminders.mjs) : sa notification
// ouvre l'espace parent, qui s'ouvre sur cette carte.

import { useMemo, type ReactNode } from 'react';
import type { UserProfile } from '../types';
import { accuracyTrend, speedTrend, weekSummary, type Trend } from '../lib/weekSummary';
import { useParentDashboardStrings } from '../i18n/parent';
import { useWeekStrings } from '../i18n/week';
import { CalendarIcon, GrowthIcon, TargetIcon, TimerIcon } from './ParentSettingIcons';

// Seconde ligne d'une rangée : la comparaison avec la semaine d'avant (et son
// sens, qui la colore quand c'est un progrès), ou un complément.
interface Sub {
  text: string;
  trend?: Trend;
}

function Row({ icon, main, sub }: { icon: ReactNode; main: string; sub?: Sub | null }) {
  return (
    <li className="parent-week-row">
      <span className="parent-week-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="parent-week-text">
        <span className="parent-week-main">{main}</span>
        {sub && <span className={`parent-week-sub${sub.trend ? ` is-${sub.trend}` : ''}`}>{sub.text}</span>}
      </span>
    </li>
  );
}

interface ParentWeekCardProps {
  profile: UserProfile;
  today: string;
  conjVisible: boolean;
}

export default function ParentWeekCard({ profile, today, conjVisible }: ParentWeekCardProps) {
  const t = useParentDashboardStrings();
  const w = useWeekStrings();
  const week = useMemo(() => weekSummary(profile, today, conjVisible), [profile, today, conjVisible]);
  const { math, conj, daysDelta, promoted, discovered } = week;

  // Chaque comparaison n'existe que si elle est juste (cf. weekSummary) : sinon,
  // la rangée s'en tient au chiffre de la semaine.
  const daysSub = (): Sub | null =>
    daysDelta === null
      ? null
      : { text: w.daysVsBefore(daysDelta), trend: daysDelta > 0 ? 'better' : daysDelta < 0 ? 'worse' : 'same' };
  const accuracySub = (delta: number | null): Sub | null =>
    delta === null ? null : { text: w.accuracyVsBefore(accuracyTrend(delta), delta), trend: accuracyTrend(delta) };
  const speedSub = (delta: number | null): Sub | null =>
    delta === null
      ? null
      : { text: w.speedVsBefore(speedTrend(delta), t.formatSeconds(Math.abs(delta))), trend: speedTrend(delta) };

  return (
    <div className="parent-section">
      <h2 className="parent-overline">{w.title}</h2>
      <div className="parent-card">
        <ul className="parent-week-rows">
          {week.days === 0 ? (
            <Row icon={<CalendarIcon />} main={w.noSession} />
          ) : (
            <>
              <Row icon={<CalendarIcon />} main={w.days(week.days)} sub={daysSub()} />
              {math && (
                <>
                  <Row
                    icon={<TargetIcon />}
                    main={w.mathAccuracy(t.formatPercent(math.accuracy))}
                    sub={accuracySub(math.accuracyDelta)}
                  />
                  <Row
                    icon={<TimerIcon />}
                    main={w.speed(t.formatSeconds(math.seconds))}
                    sub={speedSub(math.secondsDelta)}
                  />
                </>
              )}
              {conj && (
                <Row
                  icon={<TargetIcon />}
                  main={w.conjAccuracy(t.formatPercent(conj.accuracy))}
                  sub={accuracySub(conj.accuracyDelta)}
                />
              )}
              {(promoted > 0 || discovered > 0) && (
                <Row
                  icon={<GrowthIcon />}
                  main={promoted > 0 ? w.promoted(promoted) : w.discovered(discovered)}
                  sub={promoted > 0 && discovered > 0 ? { text: w.discoveredToo(discovered) } : null}
                />
              )}
            </>
          )}
        </ul>
      </div>
      <p className="parent-section-subtitle parent-note">{w.note}</p>
    </div>
  );
}
