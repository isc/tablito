// Boîte à outils des diagnostics activables (voiceDebug, layoutDebug) :
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
    if (value === '1') localStorage.setItem(storageKey, '1');
    if (value === '0') localStorage.removeItem(storageKey);
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
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
}

export function createDebugOverlay(opts: DebugOverlayOptions): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText =
    `position:fixed;left:0;right:0;${opts.position}:0;z-index:99999;`
    + 'background:rgba(0,0,0,.82);color:#8f8;font:10px/1.35 monospace;'
    + 'padding:4px 6px;pointer-events:none;white-space:pre-wrap;word-break:break-all;';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = opts.copyLabel;
  copyBtn.style.cssText =
    'pointer-events:auto;font:inherit;color:#fff;background:#444;'
    + 'border:1px solid #888;border-radius:4px;padding:2px 8px;margin-bottom:2px;';
  copyBtn.onclick = () => {
    void navigator.clipboard?.writeText(opts.copyText()).then(
      () => { copyBtn.textContent = 'Copié ✓'; },
      () => { copyBtn.textContent = 'Échec de la copie'; },
    );
  };

  const logEl = document.createElement('div');
  root.append(copyBtn, logEl);
  document.body.append(root);
  return logEl;
}
