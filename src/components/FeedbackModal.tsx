import { useEffect, useState } from 'react';
import { setBusy as setSwBusy } from 'virtual:pwa-register';
import { submitFeedback, buildContext, feedbackEnabled, type FeedbackSource } from '../lib/feedback';
import { clearVoiceLog, getVoiceLog } from '../lib/voiceDebug';
import type { UserProfile } from '../types';
import Modal from './Modal';
import { useFeedbackModalStrings } from '../i18n/parent';

interface FeedbackModalProps {
  /** Le profil AFFICHÉ par l'espace parent — local, ou enfant suivi. */
  profile: UserProfile | null;
  /**
   * D'où vient ce profil. Depuis qu'un enfant suivi à distance peut être joint,
   * l'appareil décrit par le user-agent n'est plus forcément celui qui a produit
   * l'historique : le triage a besoin de le savoir.
   */
  source?: FeedbackSource;
  onClose: () => void;
}

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function FeedbackModal({ profile, source, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [includeProfile, setIncludeProfile] = useState(false);
  // Lu à l'ouverture : sans réponse à voix haute sur cet appareil, rien à joindre.
  const [hasVoiceLog] = useState(() => getVoiceLog().length > 0);
  const [includeVoiceLog, setIncludeVoiceLog] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const t = useFeedbackModalStrings();

  // Une mise à jour de l'app ne recharge pas la page sous un avis en cours de
  // saisie : l'accueil parent d'un appareil qui ne fait que suivre l'autorise.
  useEffect(() => {
    setSwBusy(true, 'feedback');
    return () => setSwBusy(false, 'feedback');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await submitFeedback({
        message: message.trim(),
        email: email.trim() || undefined,
        context: buildContext(profile, includeProfile, source, includeVoiceLog),
      });
      // Parti avec l'avis : il n'a plus à rester sur l'appareil, et un prochain
      // avis ne joindra que ce qui s'est passé depuis.
      if (includeVoiceLog) clearVoiceLog();
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : t.sendFailed);
    }
  };

  if (!feedbackEnabled) {
    return (
      <Modal onClose={onClose} className="feedback-modal">
        <p className="feedback-unavailable">{t.notConfigured}</p>
        <button type="button" className="modal-close-btn" onClick={onClose}>{t.close}</button>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy="feedback-title"
      className="feedback-modal"
      disableClose={status === 'sending'}
    >
      <h2 id="feedback-title" className="feedback-title">{t.title}</h2>

      {status === 'success' ? (
        <div className="feedback-success">
          <p className="feedback-success-text">{t.thanks}</p>
          <button type="button" className="modal-close-btn" onClick={onClose}>{t.close}</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="feedback-form">
          <label className="feedback-label" htmlFor="feedback-message">
            {t.messageLabel}
          </label>
          <textarea
            id="feedback-message"
            className="feedback-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.messagePlaceholder}
            maxLength={5000}
            rows={6}
            required
            disabled={status === 'sending'}
          />

          <label className="feedback-label" htmlFor="feedback-email">
            {t.emailLabel}
          </label>
          <input
            id="feedback-email"
            type="email"
            className="feedback-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            maxLength={320}
            disabled={status === 'sending'}
          />

          {profile && (
            <AttachBox
              checked={includeProfile}
              onChange={setIncludeProfile}
              disabled={status === 'sending'}
              label={t.attachHistory(profile.name)}
              hint={t.attachHistoryHint}
            />
          )}

          {hasVoiceLog && (
            <AttachBox
              checked={includeVoiceLog}
              onChange={setIncludeVoiceLog}
              disabled={status === 'sending'}
              label={t.attachVoiceLog}
              hint={t.attachVoiceLogHint}
            />
          )}

          {status === 'error' && (
            <p className="feedback-error">{t.errorPrefix(errorMsg)}</p>
          )}

          <div className="feedback-actions">
            <button
              type="button"
              className="feedback-cancel-btn"
              onClick={onClose}
              disabled={status === 'sending'}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="feedback-submit-btn"
              disabled={!message.trim() || status === 'sending'}
            >
              {status === 'sending' ? t.sending : t.send}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Une pièce jointe de l'avis, décochée par défaut (opt-in). */
function AttachBox({ checked, onChange, disabled, label, hint }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="feedback-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        disabled={disabled}
      />
      <span>
        <strong>{label}</strong>
        <span className="feedback-checkbox-hint">{hint}</span>
      </span>
    </label>
  );
}
