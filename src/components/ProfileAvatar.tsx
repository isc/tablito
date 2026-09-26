// Pastille d'un enfant : son initiale, sur « sa » couleur.
//
// Couleur stable par prénom : chaque enfant retrouve sa pastille d'un écran et
// d'un lancement à l'autre (« Qui joue ? », espace parent), sans rien stocker.
// Palette limitée aux teintes assez foncées pour porter une initiale blanche.
const AVATAR_COLORS = ['var(--indigo)', 'var(--sage)', 'var(--coral)'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface ProfileAvatarProps {
  name: string;
  // Taille et forme, propres à chaque écran.
  className: string;
}

export default function ProfileAvatar({ name, className }: ProfileAvatarProps) {
  return (
    <span className={className} style={{ background: avatarColor(name) }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
