import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  overlayClassName?: string;
  // Désactive la fermeture par clic backdrop ou Escape (utile pendant
  // une opération en cours qu'on ne veut pas interrompre).
  disableClose?: boolean;
  children: ReactNode;
}

export default function Modal({
  onClose,
  labelledBy,
  className,
  overlayClassName,
  disableClose,
  children,
}: ModalProps) {
  useEffect(() => {
    if (disableClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, disableClose]);

  return (
    <div
      className={`modal-overlay ${overlayClassName ?? ''}`}
      onClick={disableClose ? undefined : onClose}
    >
      <div
        className={`modal-card ${className ?? ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}
