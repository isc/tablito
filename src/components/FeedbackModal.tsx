import { useState } from 'react';
import { submitFeedback, buildContext, feedbackEnabled } from '../lib/feedback';
import type { UserProfile } from '../types';
import Modal from './Modal';
import { useFeedbackModalStrings } from '../i18n/parent';

interface FeedbackModalProps {
  profile: UserProfile | null;
  onClose: () => void;
}

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function FeedbackModal({ profile, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [includeProfile, setIncludeProfile] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const t = useFeedbackModalStrings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await submitFeedback({
        message: message.trim(),
        email: email.trim() || undefined,
        context: buildContext(profile, includeProfile),
      });
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
            <label className="feedback-checkbox">
              <input
                type="checkbox"
                checked={includeProfile}
                onChange={(e) => setIncludeProfile(e.currentTarget.checked)}
                disabled={status === 'sending'}
              />
              <span>
                <strong>{t.attachHistory}</strong>
                <span className="feedback-checkbox-hint">
                  {t.attachHistoryHint}
                </span>
              </span>
            </label>
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
