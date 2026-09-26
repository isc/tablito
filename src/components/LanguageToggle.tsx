import { useLang, SUPPORTED_LANGS, type Lang } from '../i18n/lang';
import { useLanguageStrings } from '../i18n/language';
import ParentSegmented from './ParentSegmented';
import { SettingRow } from './ParentSettingRow';
import { GlobeIcon } from './ParentSettingIcons';

// Langue de l'interface (globale), en ligne de la liste de réglages de
// l'espace parent. Changer la langue re-render toute l'app immédiatement (via
// le contexte) et persiste le choix (cf. lang.tsx).
const LANG_LABELS: Record<Lang, string> = {
  fr: 'Français',
  en: 'English',
};

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  const t = useLanguageStrings();

  return (
    <SettingRow
      icon={<GlobeIcon />}
      title={t.label}
      trailing={
        <ParentSegmented
          pill
          label={t.label}
          value={lang}
          onChange={setLang}
          options={SUPPORTED_LANGS.map((code) => ({ value: code, label: LANG_LABELS[code] }))}
        />
      }
    />
  );
}
