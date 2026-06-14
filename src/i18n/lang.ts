import { createContext, useContext } from 'react';

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

/** Langue courante, lisible depuis n'importe quel module (lib/*). */
export function getLang(): Lang {
  return currentLang;
}

// Locale BCP-47 par langue : source de vérité unique pour le formatage des
// dates (Intl/toLocaleDateString). En-GB plutôt qu'en-US pour garder l'ordre
// jour-mois proche du français. La langue de reconnaissance vocale a sa propre
// résolution (lib/parseSpokenNumber) car elle a d'autres contraintes.
const LOCALE: Record<Lang, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
};

/** Locale BCP-47 pour le formatage des dates de la langue donnée. */
export function localeFor(lang: Lang): string {
  return LOCALE[lang];
}

/** Locale BCP-47 de la langue courante (consommateur hors-React). */
export function getLocale(): string {
  return LOCALE[currentLang];
}

/** Applique une langue : met à jour le singleton + persiste. Cf. LangProvider. */
export function applyLang(lang: Lang): void {
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
}

export interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

// Le contexte vit ici (module sans JSX → pas de frontière fast-refresh) ; le
// composant `LangProvider` est dans son propre fichier (LangProvider.tsx).
export const LangContext = createContext<LangContextValue>({
  lang: currentLang,
  setLang: () => {},
});

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Locale BCP-47 de la langue courante du contexte (pour les composants React). */
export function useLocale(): string {
  return LOCALE[useContext(LangContext).lang];
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
