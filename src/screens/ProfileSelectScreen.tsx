import Mascot from '../components/Mascot';
import ProfileAvatar from '../components/ProfileAvatar';
import type { ProfileSummary } from '../lib/storage';
import { useProfileSelectStrings } from '../i18n/onboarding';

interface ProfileSelectScreenProps {
  profiles: ProfileSummary[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}

// Écran « Qui joue ? » — affiché au lancement dès qu'il y a au moins deux
// profils sur l'appareil (specs §12). Le parcours mono-profil ne le voit
// jamais : aucune friction ajoutée à la boucle quotidienne d'un enfant seul.
export default function ProfileSelectScreen({ profiles, onSelect, onAdd }: ProfileSelectScreenProps) {
  const t = useProfileSelectStrings();
  return (
    <div className="profile-select-screen">
      <Mascot mood="happy" />
      <div className="profile-select-title">{t.title}</div>
      <div className="profile-select-list">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className="profile-select-btn"
            onClick={() => onSelect(p.id)}
          >
            <ProfileAvatar name={p.name} className="profile-select-avatar" />
            <span className="profile-select-name">{p.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className="profile-select-add" onClick={onAdd}>
        {t.addChild}
      </button>
    </div>
  );
}
