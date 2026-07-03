// Détection du contexte d'exécution et de la plateforme (module de référence
// pour tout sniffing iOS/Android), historiquement pour piloter le parcours
// d'installation PWA. Côté iOS Safari, l'utilisateur DOIT installer manuellement
// via le menu de partage ; côté Android/Chromium, on capture beforeinstallprompt.
// isAndroid() sert aussi à la stratégie micro de la saisie vocale (VoiceInput).

// ⚠ Cette clé est aussi référencée en dur dans l'inline script de
// index.html (pour décider si la landing statique doit s'afficher).
// Si tu la renommes, mets à jour les deux.
const SKIP_INSTALL_KEY = 'multiplix-skip-install';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // Safari iOS legacy : navigator.standalone n'est pas dans le standard.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se déclare comme Mac : on combine plateforme + multitouch.
  if (/iPad/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOSSafari(): boolean {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // ⚠ Cette denylist est aussi dupliquée dans l'inline script de index.html
  // (détection pré-paint `ios-other-browser`). Si tu la modifies, mets à jour
  // les deux.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
}

export function hasSkippedInstall(): boolean {
  try {
    return localStorage.getItem(SKIP_INSTALL_KEY) === '1';
  } catch {
    return false;
  }
}

export function markInstallSkipped(): void {
  try {
    localStorage.setItem(SKIP_INSTALL_KEY, '1');
  } catch {
    // localStorage indisponible (mode privé strict) — on ignore, l'utilisateur
    // reverra simplement la landing au prochain chargement.
  }
}

export function clearInstallSkipped(): void {
  try {
    localStorage.removeItem(SKIP_INSTALL_KEY);
  } catch {
    // idem
  }
}
