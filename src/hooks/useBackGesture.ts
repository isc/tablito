import { useEffect, useRef, useState } from 'react';

/**
 * Geste « retour » du système (Android) : sans entrée d'historique, il ferme la
 * PWA. Tant que `onBack` est fourni, une entrée factice est empilée ; le
 * popstate qui la consomme appelle `onBack`, et l'entrée est ré-empilée si
 * l'écran garde un retour (Nouveautés → aide → espace parent → accueil, ou la
 * confirmation d'arrêt de séance qu'un second geste referme). Quitter l'écran
 * par l'UI, ou passer `null`, retire l'entrée.
 *
 * Un seul appelant actif à la fois, sinon un geste déclencherait les deux :
 * App pour ses écrans à retour, la séance pour sa confirmation (App ne donne
 * aucun retour à la séance, cf. backTarget).
 */
export function useBackGesture(onBack: (() => void) | null): void {
  // Écrite au rendu, comme dans NumPad : via un effet, un geste arrivé juste
  // après un changement d'état appellerait encore l'ancien `onBack`.
  const handler = useRef(onBack);
  // eslint-disable-next-line react-hooks/refs
  handler.current = onBack;
  const enabled = onBack !== null;
  const [pops, setPops] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    window.history.pushState({ tablitoBack: true }, '');
    const onPop = () => {
      handler.current?.();
      setPops((n) => n + 1);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Entrée encore là = sortie par l'UI, pas par le geste : la dépiler.
      if (window.history.state?.tablitoBack) window.history.back();
    };
  }, [enabled, pops]);
}
