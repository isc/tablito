import Mascot from '../components/Mascot';
import type { ProfileSummary } from '../lib/storage';
import { useProfileSelectStrings } from '../i18n/onboarding';

interface ProfileSelectScreenProps {
  profiles: ProfileSummary[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}

// Couleur d'avatar stable par prénom : chaque enfant retrouve « sa »
// pastille d'un lancement à l'autre, sans rien stocker. Palette limitée aux
// teintes assez foncées pour porter une initiale blanche.
const AVATAR_COLORS = ['var(--indigo)', 'var(--sage)', 'var(--coral)'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
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
            <span
              className="profile-select-avatar"
              style={{ background: avatarColor(p.name) }}
              aria-hidden="true"
            >
              {p.name.trim().charAt(0).toUpperCase()}
            </span>
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
