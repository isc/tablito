import { Component, type ReactNode } from 'react';
import { STORAGE_KEY } from '../lib/storage';

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
      const raw = localStorage.getItem(STORAGE_KEY);
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
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <h1 className="error-boundary-title">Oups, un petit bug</h1>
          <p className="error-boundary-text">
            L'application a rencontré un problème. Ta progression est enregistrée
            sur cet appareil — rechargez la page pour reprendre.
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="error-boundary-primary" onClick={this.handleReload}>
              Recharger
            </button>
            <button type="button" className="error-boundary-secondary" onClick={this.handleDownloadBackup}>
              Télécharger une sauvegarde
            </button>
          </div>
          {this.state.message && (
            <details className="error-boundary-details">
              <summary>Détails techniques</summary>
              <pre>{this.state.message}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
