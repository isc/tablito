import ListenButton from './ListenButton';
import { conjStrings as t } from '../i18n/conjugation';
import { conjRuleTtsKey, type ConjStrategy } from '../lib/conjugationRules';

interface ConjRuleListenButtonProps {
  rule: ConjStrategy;
  /** Lit un MP3, par le `speak` de l'écran qui l'accueille. */
  onSpeak: (key: string) => void;
}

/**
 * Bouton « Écouter » d'une règle de conjugaison (MP3 `conj-rule-<id>`) :
 * l'enfant qui lit encore lentement se fait lire la règle.
 */
export default function ConjRuleListenButton({ rule, onSpeak }: ConjRuleListenButtonProps) {
  return (
    <ListenButton
      className="conj-rule-listen-btn"
      label={t.listenRule}
      onClick={() => onSpeak(conjRuleTtsKey(rule))}
    />
  );
}
