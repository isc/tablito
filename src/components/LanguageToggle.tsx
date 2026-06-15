import { useLang, SUPPORTED_LANGS, type Lang } from '../i18n/lang';
import { useLanguageStrings } from '../i18n/language';

// Sélecteur de langue de l'interface (globale). Contrôle segmenté simple :
// changer la langue re-render toute l'app immédiatement (via le contexte) et
// persiste le choix (cf. lang.tsx). Placé dans l'espace parent.
const LANG_LABELS: Record<Lang, string> = {
  fr: 'Français',
  en: 'English',
};

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  const t = useLanguageStrings();

  return (
    <div className="language-toggle">
      <span className="language-toggle-label">{t.label}</span>
      <div className="language-toggle-options" role="group" aria-label={t.label}>
        {SUPPORTED_LANGS.map((code) => (
          <button
            key={code}
            type="button"
            className={`language-toggle-option${code === lang ? ' is-active' : ''}`}
            aria-pressed={code === lang}
            onClick={() => setLang(code)}
          >
            {LANG_LABELS[code]}
          </button>
        ))}
      </div>
    </div>
  );
}
