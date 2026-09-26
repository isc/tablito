// Sélecteur d'enfant de l'espace parent : un seul, pour les enfants de cet
// appareil comme pour ceux suivis à distance. Voir la progression de Tom sur
// la tablette de Léa ne demande plus de repasser par « Qui joue ? » — et ne
// change pas l'enfant qui joue : le parent regarde, il ne prend pas la main.

import { useParentDashboardStrings } from '../i18n/parent';
import ProfileAvatar from './ProfileAvatar';

export interface PickableChild {
  key: string;
  name: string;
  // Suivi à distance : la progression affichée est un instantané, relu en ligne.
  remote: boolean;
}

interface ParentChildPickerProps {
  items: PickableChild[];
  selected: string | null;
  onSelect: (key: string) => void;
}

export default function ParentChildPicker({ items, selected, onSelect }: ParentChildPickerProps) {
  const t = useParentDashboardStrings();
  return (
    <div className="parent-children" role="group" aria-label={t.sourceLabel}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`parent-child${item.key === selected ? ' is-active' : ''}`}
          aria-pressed={item.key === selected}
          onClick={() => onSelect(item.key)}
        >
          <ProfileAvatar name={item.name} className="parent-child-avatar" />
          <span className="parent-child-name">{item.name}</span>
          {item.remote && <span className="parent-child-remote">{t.remoteTag}</span>}
        </button>
      ))}
    </div>
  );
}
