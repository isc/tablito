// Appairage d'un suivi à distance, côté appareil du parent : scanner le QR de
// l'appareil de l'enfant, ou coller son lien.
//
// Composant à part pour que la caméra vive exactement aussi longtemps que
// l'élément vidéo où elle filme : quitter la page qui le montre, par n'importe
// quel chemin (bouton, geste retour), la coupe avec lui.

import { useEffect, useRef, useState } from 'react';
import { addWatched, type WatchPairing } from '../lib/watch';
import { parseWatchLink } from '../lib/watchStore';
import { useParentDashboardStrings } from '../i18n/parent';
import { useQrScan } from '../hooks/useQrScan';

type PairState = 'idle' | 'scanning' | 'fetching' | 'cameraError' | 'linkError' | 'manual';

interface ParentWatchPairingProps {
  onPaired: (pairing: WatchPairing) => void;
}

export default function ParentWatchPairing({ onPaired }: ParentWatchPairingProps) {
  const t = useParentDashboardStrings();
  const [pair, setPair] = useState<PairState>('idle');
  const [pairText, setPairText] = useState('');

  // Un appairage abandonné en cours de relecture (écran quitté) ne bascule pas
  // l'espace parent sur un autre enfant après coup.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const acceptWatchLink = async (text: string): Promise<boolean> => {
    if (!parseWatchLink(text)) return false;
    setPair('fetching');
    const paired = await addWatched(text);
    if (!mountedRef.current) return true;
    if (!paired) {
      setPair('linkError');
      return true; // lien reconnu mais illisible : inutile de continuer à filmer
    }
    setPair('idle');
    onPaired(paired);
    return true;
  };

  const scanVideoRef = useQrScan({
    active: pair === 'scanning',
    onCode: acceptWatchLink,
    onCameraError: () => setPair('cameraError'),
  });

  return (
    <div className="parent-watch-block">
      {pair === 'scanning' || pair === 'fetching' ? (
        <>
          <video ref={scanVideoRef} className="parent-scan-video" />
          <p className="parent-transfer-status">
            {pair === 'fetching' ? t.remoteLoading : t.watchScanPrompt}
          </p>
          <button className="parent-action-btn" onClick={() => setPair('idle')}>
            {t.cancel}
          </button>
        </>
      ) : (
        <>
          {pair === 'cameraError' && (
            <p className="parent-transfer-status parent-transfer-status--error">{t.watchCameraError}</p>
          )}
          {pair === 'linkError' && (
            <p className="parent-transfer-status parent-transfer-status--error">{t.watchLinkError}</p>
          )}
          <div className="parent-actions">
            <button className="parent-action-btn" onClick={() => setPair('scanning')}>
              {t.watchScan}
            </button>
            <button className="parent-action-btn" onClick={() => setPair('manual')}>
              {t.watchPasteLink}
            </button>
          </div>
        </>
      )}
      {pair === 'manual' && (
        <div className="parent-import-area">
          <textarea
            className="parent-import-textarea"
            placeholder={t.watchPastePlaceholder}
            value={pairText}
            onChange={(e) => setPairText((e.target as HTMLTextAreaElement).value)}
          />
          <button
            className="parent-import-confirm"
            disabled={!pairText.trim()}
            onClick={async () => {
              if (!(await acceptWatchLink(pairText.trim()))) setPair('linkError');
              setPairText('');
            }}
          >
            {t.watchPasteConfirm}
          </button>
        </div>
      )}
    </div>
  );
}
