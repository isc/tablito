// Panneau QR de l'espace parent : le code à scanner avec un autre appareil,
// son mode d'emploi et le lien à copier en repli. Partagé par le transfert
// vers un nouvel appareil et le partage d'une progression.

import QrCanvas from './QrCanvas';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { useParentDashboardStrings } from '../i18n/parent';

// 'loading' pendant le dépôt, 'error' s'il a échoué, le lien une fois prêt.
export type QrPanelState = 'loading' | 'error' | { link: string };

interface ParentQrPanelProps {
  state: QrPanelState;
  preparing: string;
  error: string;
  hint: string;
  qrAlt: string;
  // lean-qr introuvable (hors-ligne au premier usage) : l'appelant bascule en
  // erreur, et la copie du lien, qui ne dépend d'aucune lib, reste possible.
  onQrError: () => void;
}

export default function ParentQrPanel({ state, preparing, error, hint, qrAlt, onQrError }: ParentQrPanelProps) {
  const t = useParentDashboardStrings();
  const { copied, copy } = useCopyFeedback();

  return (
    <div className="parent-transfer-area">
      {state === 'loading' && <p className="parent-transfer-status">{preparing}</p>}
      {state === 'error' && <p className="parent-transfer-status parent-transfer-status--error">{error}</p>}
      {typeof state === 'object' && (
        <>
          <QrCanvas value={state.link} className="parent-transfer-qr" ariaLabel={qrAlt} onError={onQrError} />
          <p className="parent-transfer-hint">{hint}</p>
          <button className="parent-action-btn" onClick={() => void copy(state.link)}>
            {copied ? t.linkCopied : t.transferCopyLink}
          </button>
        </>
      )}
    </div>
  );
}
