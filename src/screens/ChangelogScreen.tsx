import BackChevron from '../components/BackChevron';
import { getChangelog } from '../lib/changelog';
import { useLang } from '../i18n/lang';
import { useChangelogUiStrings } from '../i18n/privacy';

interface ChangelogScreenProps {
  onBack: () => void;
}

function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export default function ChangelogScreen({ onBack }: ChangelogScreenProps) {
  const { lang } = useLang();
  const t = useChangelogUiStrings();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  return (
    <div className="changelog-screen">
      <button className="changelog-back-btn" onClick={onBack} aria-label={t.back}>
        <BackChevron />
      </button>

      <div className="changelog-content">
        <h1 className="changelog-title">{t.title}</h1>
        <p className="changelog-subtitle">{t.subtitle}</p>

        {getChangelog().map((entry) => (
          <section key={entry.date} className="changelog-entry">
            <h2>{formatDate(entry.date, locale)}</h2>
            <ul>
              {entry.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
