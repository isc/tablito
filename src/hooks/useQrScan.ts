// Caméra + détection de QR code, partagée par les deux appairages de l'app :
// le transfert de profil (WelcomeScreen) et le suivi à distance (espace
// parent). qr-scanner est vendoré et chargé à la demande — un boot ordinaire ne
// paie pas la lib.
//
// `onCode` décide du sort de chaque détection : renvoyer false ignore le QR
// (l'utilisateur vise peut-être encore à côté) et la caméra continue de filmer ;
// renvoyer true l'accepte et arrête la caméra. Le callback peut être asynchrone
// (récupération réseau + déchiffrement) : les détections qui tombent pendant ce
// traitement sont ignorées, qr-scanner se déclenchant plusieurs fois par seconde
// sur un même QR.

import { useEffect, useRef } from 'react';
import type QrScanner from 'qr-scanner';

interface UseQrScanOptions {
  // Filme tant que vrai. Repasser à faux libère la caméra.
  active: boolean;
  onCode: (data: string) => boolean | Promise<boolean>;
  // Caméra absente, refusée, ou lib introuvable — à l'appelant de proposer son
  // repli (collage manuel du lien).
  onCameraError: () => void;
}

export function useQrScan({ active, onCode, onCameraError }: UseQrScanOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Callbacks via refs : sans ça, une closure recréée à chaque render du parent
  // relancerait la caméra en boucle.
  const onCodeRef = useRef(onCode);
  const onCameraErrorRef = useRef(onCameraError);
  onCodeRef.current = onCode;
  onCameraErrorRef.current = onCameraError;

  useEffect(() => {
    if (!active) return;
    let scanner: QrScanner | null = null;
    let cancelled = false;
    let busy = false;
    (async () => {
      try {
        const { default: QrScanner } = await import('qr-scanner');
        if (cancelled || !videoRef.current) return;
        const qr = new QrScanner(
          videoRef.current,
          async ({ data }) => {
            if (busy) return;
            busy = true;
            try {
              if (await onCodeRef.current(data)) qr.stop();
            } finally {
              busy = false;
            }
          },
          { returnDetailedScanResult: true },
        );
        scanner = qr;
        await qr.start();
        // Si le cleanup est passé pendant le start(), son destroy() a tourné
        // avant que getUserMedia ne rende la piste : on relibère, sinon la LED
        // caméra reste allumée après la fermeture du panneau.
        if (cancelled) qr.destroy();
      } catch {
        if (!cancelled) onCameraErrorRef.current();
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy(); // destroy() arrête aussi la caméra
    };
  }, [active]);

  return videoRef;
}
