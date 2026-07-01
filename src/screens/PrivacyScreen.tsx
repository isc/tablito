import BackChevron from '../components/BackChevron';
import { usePrivacyStrings } from '../i18n/privacy';

interface PrivacyScreenProps {
  onBack: () => void;
}

export default function PrivacyScreen({ onBack }: PrivacyScreenProps) {
  const t = usePrivacyStrings();
  return (
    <div className="privacy-screen">
      <button className="privacy-back-btn" onClick={onBack} aria-label={t.back}>
        <BackChevron />
      </button>

      <div className="privacy-content">
        <h1 className="privacy-title">{t.title}</h1>
        <p className="privacy-subtitle">{t.subtitle}</p>

        <section className="privacy-section">
          <h2>{t.onDeviceTitle}</h2>
          <p>{t.onDeviceBody}</p>
        </section>

        <section className="privacy-section">
          <h2>{t.feedbackTitle}</h2>
          <p>{t.feedbackIntro}</p>
          <ul>
            {t.feedbackItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{t.feedbackOutro}</p>
        </section>

        <section className="privacy-section">
          <h2>{t.reminderTitle}</h2>
          <p>{t.reminderIntro}</p>
          <ul>
            {t.reminderItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{t.reminderOutro}</p>
        </section>

        <section className="privacy-section">
          <h2>{t.transferTitle}</h2>
          <p>{t.transferBody}</p>
        </section>

        <section className="privacy-section">
          <h2>{t.notCollectedTitle}</h2>
          <ul>
            {t.notCollectedItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="privacy-section">
          <h2>{t.rightsTitle}</h2>
          <p>{t.rightsIntro}</p>
          <ul>
            {t.rightsItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{t.rightsOutro}</p>
        </section>

        <section className="privacy-section">
          <h2>{t.contactTitle}</h2>
          <p>{t.contactBody}</p>
        </section>

        <p className="privacy-updated">{t.updated}</p>
      </div>
    </div>
  );
}
