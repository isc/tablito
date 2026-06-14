import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { useParentGateStrings } from '../i18n/parent';

interface ParentGateProps {
  onSuccess: () => void;
  onClose: () => void;
}

function pickOperands(): [number, number] {
  const a = 11 + Math.floor(Math.random() * 9); // 11..19
  const b = 3 + Math.floor(Math.random() * 7);  // 3..9
  return [a, b];
}

export default function ParentGate({ onSuccess, onClose }: ParentGateProps) {
  const [[a, b], setOperands] = useState<[number, number]>(() => pickOperands());
  const [answer, setAnswer] = useState('');
  const [wrongAttempt, setWrongAttempt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const expected = useMemo(() => a * b, [a, b]);
  const t = useParentGateStrings();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(answer, 10);
    if (Number.isFinite(n) && n === expected) {
      onSuccess();
      return;
    }
    setWrongAttempt(true);
    setOperands(pickOperands());
    setAnswer('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="parent-gate-title"
      className="parent-gate-modal"
      overlayClassName="parent-gate-overlay"
    >
      <h2 id="parent-gate-title" className="parent-gate-title">{t.title}</h2>
        <p className="parent-gate-subtitle">
          {t.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="parent-gate-form">
          <div className="parent-gate-question">
            <span>{a}</span>
            <span className="parent-gate-times">×</span>
            <span>{b}</span>
            <span className="parent-gate-equals">=</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="parent-gate-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/[^0-9]/g, ''))}
              aria-label={t.resultLabel}
              maxLength={4}
            />
          </div>

          {wrongAttempt && (
            <p className="parent-gate-error">{t.wrongAttempt}</p>
          )}

          <div className="parent-gate-actions">
            <button type="button" className="parent-gate-cancel" onClick={onClose}>
              {t.cancel}
            </button>
            <button
              type="submit"
              className="parent-gate-submit"
              disabled={answer.length === 0}
            >
              {t.validate}
            </button>
          </div>
        </form>
    </Modal>
  );
}
