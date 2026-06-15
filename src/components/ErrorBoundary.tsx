import { Component, type ReactNode } from 'react';
import { getActiveProfileRaw } from '../lib/storage';
import { getLang } from '../i18n/lang';

// ErrorBoundary est un composant classe : pas de hooks, donc pas de
// useStrings(). On lit la langue courante via le singleton getLang() au moment
// du render et on sélectionne dans un dico local { fr, en } (même forme).
const strings = {
  fr: {
    title: 'Oups, un petit bug',
    text: "L'application a rencontré un problème. Ta progression est enregistrée sur cet appareil — rechargez la page pour reprendre.",
    reload: 'Recharger',
    downloadBackup: 'Télécharger une sauvegarde',
    technicalDetails: 'Détails techniques',
  },
  en: {
    title: 'Oops, a little bug',
    text: 'The app ran into a problem. Your progress is saved on this device — reload the page to continue.',
    reload: 'Reload',
    downloadBackup: 'Download a backup',
    technicalDetails: 'Technical details',
  },
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): ErrorBoundaryState {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }

  componentDidCatch(err: unknown): void {
    console.error('[ErrorBoundary]', err);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleDownloadBackup = (): void => {
    try {
      const raw = getActiveProfileRaw();
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tablito-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so Safari has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      /* pas de fallback — le bouton Recharger reste disponible */
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const t = strings[getLang()];
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <h1 className="error-boundary-title">{t.title}</h1>
          <p className="error-boundary-text">{t.text}</p>
          <div className="error-boundary-actions">
            <button type="button" className="error-boundary-primary" onClick={this.handleReload}>
              {t.reload}
            </button>
            <button type="button" className="error-boundary-secondary" onClick={this.handleDownloadBackup}>
              {t.downloadBackup}
            </button>
          </div>
          {this.state.message && (
            <details className="error-boundary-details">
              <summary>{t.technicalDetails}</summary>
              <pre>{this.state.message}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
