// Détection du contexte d'exécution et de la plateforme : module de référence
// pour tout sniffing iOS/Android. Le parcours d'installation PWA lui-même vit
// dans l'inline script de index.html (c'est lui qui capture
// beforeinstallprompt) ; ici on ne garde que les prédicats dont les modules ont
// besoin — isAndroid() pilote aussi la stratégie micro de la saisie vocale
// (VoiceInput), et isIOS()/isStandalone() les préambules "installe d'abord"
// des réglages de notifications.

// ⚠ Cette clé appartient à l'inline script de index.html, qui l'écrit (le
// visiteur quitte la landing) et la relit (faut-il encore afficher la landing ?).
// Le seul geste côté module est de l'effacer. Si tu la renommes, mets à jour
// les deux.
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

export function clearInstallSkipped(): void {
  try {
    localStorage.removeItem(SKIP_INSTALL_KEY);
  } catch {
    // localStorage indisponible (mode privé strict) — sans importance : au pire
    // le drapeau survit et la landing reste sautée.
  }
}
