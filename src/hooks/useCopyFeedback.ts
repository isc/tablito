import { useCallback, useState } from 'react';

/**
 * Copie un texte dans le presse-papiers et signale « Copié ✓ » pendant 2 s.
 * Échec silencieux : presse-papiers indisponible (contexte non sécurisé),
 * l'utilisateur a d'autres chemins (QR, feuille de partage).
 */
export function useCopyFeedback(): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);
  return { copied, copy };
}
