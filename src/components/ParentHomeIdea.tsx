// Une idée pour aider l'enfant à la maison, sous « À retravailler » de
// l'accueil de l'espace parent : tirée du fait qui lui résiste le plus, le
// premier de la liste (cf. lib/homeIdea).

import type { HardFact } from '../lib/hardestFacts';
import { homeIdea } from '../lib/homeIdea';
import { useHomeIdeaStrings } from '../i18n/homeIdea';
import { BulbIcon } from './ParentSettingIcons';

export default function ParentHomeIdea({ fact }: { fact: HardFact }) {
  const t = useHomeIdeaStrings();
  const idea = homeIdea(fact);
  if (!idea) return null;
  return (
    <div className="parent-idea">
      <span className="parent-idea-icon" aria-hidden="true">
        <BulbIcon />
      </span>
      <div className="parent-idea-text">
        <div className="parent-idea-heading">{t.heading}</div>
        <p className="parent-idea-body">{t.idea(idea)}</p>
      </div>
    </div>
  );
}
