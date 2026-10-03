import { conjStrings as t } from '../i18n/conjugation';
import { conjRuleTtsKey, type ConjStrategy } from '../lib/conjugationRules';

interface ConjRuleListenButtonProps {
  rule: ConjStrategy;
  /** Lit un MP3, par le `speak` de l'écran qui l'accueille. */
  onSpeak: (key: string) => void;
}

/**
 * Bouton « Écouter » d'une règle de conjugaison (MP3 `conj-rule-<id>`) :
 * l'enfant qui lit encore lentement se fait lire la règle. Icône seule,
 * libellé pour les lecteurs d'écran.
 */
export default function ConjRuleListenButton({ rule, onSpeak }: ConjRuleListenButtonProps) {
  return (
    <button type="button" className="conj-rule-listen-btn" onClick={() => onSpeak(conjRuleTtsKey(rule))} aria-label={t.listenRule}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11 5 L6 9 H3 V15 H6 L11 19 Z M15.5 8.5 A5 5 0 0 1 15.5 15.5 M18.5 5.5 A9 9 0 0 1 18.5 18.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
