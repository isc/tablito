import { useState } from 'react';
import { submitFeedback, buildContext, feedbackEnabled } from '../lib/feedback';
import type { UserProfile } from '../types';
import Modal from './Modal';

interface FeedbackModalProps {
  profile: UserProfile | null;
  onClose: () => void;
}

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function FeedbackModal({ profile, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await submitFeedback({
        message: message.trim(),
        email: email.trim() || undefined,
        context: buildContext(profile),
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Envoi impossible');
    }
  };

  if (!feedbackEnabled) {
    return (
      <Modal onClose={onClose} className="feedback-modal">
        <p className="feedback-unavailable">Le formulaire n'est pas configuré.</p>
        <button type="button" className="modal-close-btn" onClick={onClose}>Fermer</button>
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
      <h2 id="feedback-title" className="feedback-title">Votre avis</h2>

      {status === 'success' ? (
        <div className="feedback-success">
          <p className="feedback-success-text">Merci, c'est bien reçu&nbsp;!</p>
          <button type="button" className="modal-close-btn" onClick={onClose}>Fermer</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="feedback-form">
          <label className="feedback-label" htmlFor="feedback-message">
            Dites-nous ce qui va, ce qui ne va pas, ou ce que vous aimeriez voir
          </label>
          <textarea
            id="feedback-message"
            className="feedback-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Votre message…"
            maxLength={5000}
            rows={6}
            required
            disabled={status === 'sending'}
          />

          <label className="feedback-label" htmlFor="feedback-email">
            Email (optionnel, si vous souhaitez une réponse)
          </label>
          <input
            id="feedback-email"
            type="email"
            className="feedback-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            maxLength={320}
            disabled={status === 'sending'}
          />

          {status === 'error' && (
            <p className="feedback-error">Erreur : {errorMsg}</p>
          )}

          <div className="feedback-actions">
            <button
              type="button"
              className="feedback-cancel-btn"
              onClick={onClose}
              disabled={status === 'sending'}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="feedback-submit-btn"
              disabled={!message.trim() || status === 'sending'}
            >
              {status === 'sending' ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
