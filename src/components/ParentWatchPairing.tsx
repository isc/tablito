// Appairage d'un suivi à distance, côté appareil du parent : scanner le QR de
// l'appareil de l'enfant, ou coller son lien.
//
// Un QR de transfert lu ici est importé plutôt qu'ignoré : qui a scanné par
// erreur le QR du suivi pour changer d'appareil visera ensuite le bon ici.
//
// Composant à part pour que la caméra vive exactement aussi longtemps que
// l'élément vidéo où elle filme : quitter la page qui le montre, par n'importe
// quel chemin (bouton, geste retour), la coupe avec lui.

import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../types';
import { importTransferFromLink, parseTransferLink } from '../lib/transfer';
import { addWatched, type WatchPairing } from '../lib/watch';
import { parseWatchLink } from '../lib/watchStore';
import { useAppStrings } from '../i18n/app';
import { useParentDashboardStrings } from '../i18n/parent';
import { useQrScan } from '../hooks/useQrScan';

type PairState = 'idle' | 'scanning' | 'fetching' | 'cameraError' | 'linkError' | 'transferError' | 'manual';

interface ParentWatchPairingProps {
  onPaired: (pairing: WatchPairing) => void;
  // Profil installé, et rendu actif, par un QR de transfert.
  onProfileInstalled: (profile: UserProfile) => void;
}

export default function ParentWatchPairing({ onPaired, onProfileInstalled }: ParentWatchPairingProps) {
  const t = useParentDashboardStrings();
  const appStrings = useAppStrings();
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

  const acceptLink = async (text: string): Promise<boolean> => {
    if (parseTransferLink(text)) {
      setPair('fetching');
      const installed = await importTransferFromLink(text);
      // Installé même si la page a été quittée entre-temps : le transfert est
      // consommé, App doit le savoir.
      if (installed) onProfileInstalled(installed);
      else if (mountedRef.current) setPair('transferError');
      return true;
    }
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
    onCode: acceptLink,
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
          {pair === 'transferError' && (
            <p className="parent-transfer-status parent-transfer-status--error">{appStrings.transferFailed}</p>
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
              if (!(await acceptLink(pairText.trim()))) setPair('linkError');
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
