import { memo } from 'react';
import type { IrrFact } from '../types';
import { irrVerbDefs, irrVerbsInIntroOrder } from '../lib/irregularVerbs';
import { useParentDashboardStrings } from '../i18n/parent';

/** Prochains verbes annoncés sous la liste : de quoi vérifier l'ordre d'un coup d'œil. */
const NEXT_PREVIEW = 4;

// Les 64 verbes par ordre alphabétique : c'est l'ordre des listes d'école, le
// parent y retrouve vite ceux du cahier.
const ALPHABETICAL = [...irrVerbDefs()].map((def) => def.key).sort();

interface IrrClassVerbsProps {
  /** Verbes cochés, dans l'ordre où le parent les a cochés. */
  classVerbs: readonly string[];
  facts: readonly IrrFact[];
  /** Absent = lecture seule (enfant suivi à distance, autre profil). */
  onChange?: (next: string[]) => void;
}

/**
 * « Vus en classe » (specs §16.3) : le parent coche les verbes que la classe a
 * déjà vus, et ils passent devant l'ordre de fréquence. Chaque classe suit sa
 * propre liste (« be, begin, choose, break » pour l'une, « go, see, take »
 * pour une autre) : l'app suit la classe, pas l'inverse.
 */
function IrrClassVerbs({ classVerbs, facts, onChange }: IrrClassVerbsProps) {
  const t = useParentDashboardStrings();
  const introduced = new Set(facts.filter((f) => f.introduced).map((f) => f.key));
  const next = irrVerbsInIntroOrder(classVerbs)
    .filter((def) => !introduced.has(def.key))
    .slice(0, NEXT_PREVIEW)
    .map((def) => def.key);

  const toggle = (key: string) => {
    if (!onChange) return;
    onChange(classVerbs.includes(key) ? classVerbs.filter((k) => k !== key) : [...classVerbs, key]);
  };

  return (
    <div className="parent-card irr-class-verbs">
      <h3 className="parent-card-title">{t.classVerbs}</h3>
      <p className="parent-section-subtitle">{onChange ? t.classVerbsSubtitle : t.classVerbsReadOnly}</p>
      <div className="irr-class-verbs-list" lang="en">
        {ALPHABETICAL.map((key) => {
          const order = classVerbs.indexOf(key);
          const learned = introduced.has(key);
          const className = `irr-class-verb${order >= 0 ? ' is-selected' : ''}${learned ? ' is-learned' : ''}`;
          const content = (
            <>
              {order >= 0 && <span className="irr-class-verb-order">{order + 1}</span>}
              {key}
              {learned && (
                <span className="irr-class-verb-learned" title={t.classVerbsLearned} aria-label={t.classVerbsLearned}>
                  {'✓'}
                </span>
              )}
            </>
          );
          return onChange ? (
            <button key={key} type="button" className={className} aria-pressed={order >= 0} onClick={() => toggle(key)}>
              {content}
            </button>
          ) : (
            <span key={key} className={className}>
              {content}
            </span>
          );
        })}
      </div>
      {next.length > 0 && <p className="parent-card-caption">{t.classVerbsNext(next.join(', '))}</p>}
      {onChange && classVerbs.length > 0 && (
        <button type="button" className="irr-class-verbs-clear" onClick={() => onChange([])}>
          {t.classVerbsClear}
        </button>
      )}
    </div>
  );
}

export default memo(IrrClassVerbs);
