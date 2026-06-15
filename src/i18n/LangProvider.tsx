import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LangContext, applyLang, getLang, type Lang } from './lang';

// Provider React de la langue d'interface. Isolé du module `lang.ts` (qui ne
// contient aucun composant) pour respecter la frontière fast-refresh de Vite.
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang());

  const setLang = useCallback((next: Lang) => {
    applyLang(next);
    setLangState(next);
  }, []);

  // Garde le <html lang> en phase dès le montage (et au changement).
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}
