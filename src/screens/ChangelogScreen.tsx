import BackChevron from '../components/BackChevron';
import { CHANGELOG } from '../lib/changelog';

interface ChangelogScreenProps {
  onBack: () => void;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return DATE_FORMATTER.format(new Date(y, m - 1, d));
}

export default function ChangelogScreen({ onBack }: ChangelogScreenProps) {
  return (
    <div className="changelog-screen">
      <button className="changelog-back-btn" onClick={onBack} aria-label="Retour">
        <BackChevron />
      </button>

      <div className="changelog-content">
        <h1 className="changelog-title">Nouveautés</h1>
        <p className="changelog-subtitle">
          Les changements récents de Tablito.
        </p>

        {CHANGELOG.map((entry) => (
          <section key={entry.date} className="changelog-entry">
            <h2>{formatDate(entry.date)}</h2>
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
