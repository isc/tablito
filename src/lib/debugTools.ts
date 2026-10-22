// Boîte à outils des diagnostics activables (voiceDebug aujourd'hui) :
// flag par URL persisté en localStorage + overlay bandeau fixe avec bouton
// « Copier », utilisables sur téléphone sans câble ni chrome://inspect.
// Volontairement en DOM vanilla : appelé depuis du code non-React,
// avant/hors du cycle de vie des composants. Un seul module (nobuild :
// chaque fichier est une requête HTTP à part).

// Ouvrir l'app avec ?<param>=1 active le flag durablement, ?<param>=0 le
// coupe. Flag éteint, les outils de debug doivent être des no-ops totaux.
export function readDebugFlag(param: string, storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const value = new URLSearchParams(window.location.search).get(param);
    if (value === '1') setDebugFlag(storageKey, true);
    if (value === '0') setDebugFlag(storageKey, false);
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

/** Le même flag, levé ou coupé depuis l'app (cf. l'easter egg de l'espace parent). */
export function setDebugFlag(storageKey: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(storageKey, '1');
    else localStorage.removeItem(storageKey);
  } catch {
    // Stockage indisponible : le flag ne vaut que pour la page en cours.
  }
}

interface DebugOverlayOptions {
  // Libellé du bouton de copie.
  copyLabel: string;
  // Contenu complet à copier (l'overlay n'affiche que les dernières lignes).
  copyText: () => string;
  // Position du bandeau — le voice debug vit en bas, le layout debug en haut
  // pour ne pas masquer ce qu'on mesure.
  position: 'top' | 'bottom';
  // Bouton « Désactiver » : coupe le flag sans repasser par l'URL.
  onDisable: () => void;
}

export interface DebugOverlay {
  // Zone des dernières lignes.
  log: HTMLElement;
  remove: () => void;
}

export function createDebugOverlay(opts: DebugOverlayOptions): DebugOverlay {
  const root = document.createElement('div');
  root.style.cssText =
    `position:fixed;left:0;right:0;${opts.position}:0;z-index:99999;`
    + 'background:rgba(0,0,0,.82);color:#8f8;font:10px/1.35 monospace;'
    + 'padding:4px 6px;pointer-events:none;white-space:pre-wrap;word-break:break-all;';

  const button = (label: string, onClick: () => void) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      'pointer-events:auto;font:inherit;color:#fff;background:#444;'
      + 'border:1px solid #888;border-radius:4px;padding:2px 8px;margin:0 6px 2px 0;';
    btn.onclick = onClick;
    return btn;
  };
  const copyBtn = button(opts.copyLabel, () => {
    void navigator.clipboard?.writeText(opts.copyText()).then(
      () => { copyBtn.textContent = 'Copié ✓'; },
      () => { copyBtn.textContent = 'Échec de la copie'; },
    );
  });

  const log = document.createElement('div');
  root.append(copyBtn, button('Désactiver', opts.onDisable), log);
  document.body.append(root);
  return { log, remove: () => root.remove() };
}
