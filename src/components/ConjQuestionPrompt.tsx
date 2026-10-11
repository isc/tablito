import ConjForm from './ConjForm';
import ListenButton from './ListenButton';
import type { ConjQuestionView } from '../lib/conjugationFacts';
import { conjStrings as t } from '../i18n/conjugation';

interface ConjQuestionPromptProps {
  view: ConjQuestionView;
  /** La saisie en cours, écrite sur le trait (cf. ConjForm `typed`). */
  typed: string;
  /** Le clavier attend : curseur au bout de la saisie. */
  caret: boolean;
  /** Relit l'énoncé. */
  onReplay: () => void;
}

/**
 * L'énoncé d'une question de conjugaison (§15.5), dans l'ordre où l'enfant s'en
 * sert : le verbe à conjuguer, en tête et en grand, puis la phrase où le mettre.
 * La réponse s'écrit sur le trait de la phrase : il n'y a pas d'autre ardoise,
 * et l'enfant relit la phrase entière avant de valider.
 */
export default function ConjQuestionPrompt({ view, typed, caret, onReplay }: ConjQuestionPromptProps) {
  return (
    <div className="conj-prompt">
      <div className="conj-prompt-verb-row">
        <span className="conj-verb-tag">{view.verb}</span>
        <ListenButton label={t.replay} onClick={onReplay} />
      </div>
      <ConjForm
        stacked
        before={view.carrier.before}
        subject={view.subject}
        segment={[view.displayedStem, '']}
        blank
        typed={typed}
        caret={caret}
        after={view.tail}
      />
    </div>
  );
}
