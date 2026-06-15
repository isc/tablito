import { pickStrings } from '../i18n/lang';
import { changelogData } from '../i18n/changelog';

export interface ChangelogEntry {
  date: string; // ISO YYYY-MM-DD
  items: string[];
}

// Le contenu (traduit) vit dans i18n/changelog.ts ; ici on ne garde que la
// forme (ChangelogEntry) et l'accès language-aware. Ordre antéchronologique
// (plus récent en haut). Les entrées sont écrites pour un parent qui consulte
// la page de temps en temps : on regroupe par jour de publication, on ne
// mentionne pas les détails techniques (refactos, CI, lint), seulement ce qui
// change l'expérience visible côté enfant ou parent. Garder court et concret.
export function getChangelog(): ChangelogEntry[] {
  return pickStrings(changelogData);
}
