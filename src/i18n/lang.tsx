import { createContext, type ReactNode } from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';

// === i18n — langue de l'interface ===
// Langue GLOBALE (un seul réglage pour toute l'app, pas par profil) : choix
// produit assumé (cf. discussion PR). Persistée à part des profils sous sa
// propre clé localStorage, lue par l'inline script de index.html pour
// localiser la landing statique AVANT que l'app ne charge.
//
// Deux faces d'une même valeur :
//  - un singleton module (`getLang`) pour le code hors-React (lib/*, scripts
//    de strings non-hookés) qui lit la langue au moment de l'appel ;
//  - un contexte React (`LangProvider` / `useLang`) qui re-render l'UI au
//    changement. `setLang` met les deux à jour d'un coup.

export type Lang = 'fr' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['fr', 'en'];

// ⚠️ En dur aussi dans l'inline script de index.html (landing statique) — si
// tu renommes la clé, mets les deux à jour.
export const LANG_STORAGE_KEY = 'multiplix-lang';

function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'en';
}

/**
 * Langue initiale : préférence explicite stockée si elle existe, sinon on
 * suit la langue du navigateur (anglais pour tout tag `en*`, français par
 * défaut — l'app est née francophone).
 */
export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage indisponible (mode privé strict) — on retombe sur navigator.
  }
  try {
    if ((navigator.language || '').toLowerCase().startsWith('en')) return 'en';
  } catch {
    // ignore
  }
  return 'fr';
}

// --- Singleton module pour les consommateurs hors-React ---
let currentLang: Lang = detectLang();
const listeners = new Set<(lang: Lang) => void>();

/** Langue courante, lisible depuis n'importe quel module (lib/*). */
export function getLang(): Lang {
  return currentLang;
}

/** S'abonner aux changements de langue (pour du code hors-React). */
export function subscribeLang(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commitLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // best-effort : au pire la préférence ne survit pas à la session.
  }
  try {
    document.documentElement.lang = lang;
  } catch {
    // ignore (SSR / tests)
  }
  listeners.forEach((fn) => fn(lang));
}

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: currentLang,
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((next: Lang) => {
    commitLang(next);
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

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/**
 * Helper de sélection pour les modules de strings : `pick({ fr, en })`
 * renvoie l'entrée de la langue courante du contexte. Utilisé par les hooks
 * `useXStrings()` de chaque domaine.
 */
export function useStrings<T>(table: Record<Lang, T>): T {
  return table[useContext(LangContext).lang];
}

/** Variante hors-React : sélectionne selon le singleton module. */
export function pickStrings<T>(table: Record<Lang, T>): T {
  return table[currentLang];
}
