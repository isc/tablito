// QR code rendu sur un <canvas>. lean-qr est chargé à la demande : inutile
// d'alourdir le chunk de l'espace parent pour des actions rares (transfert vers
// un autre appareil, partage d'un suivi à distance).

import { useEffect, useRef } from 'react';

interface QrCanvasProps {
  value: string;
  ariaLabel: string;
  className?: string;
  // Signalé si lean-qr est introuvable (hors-ligne au premier usage) : l'appelant
  // propose alors la copie du lien, qui ne dépend d'aucune lib.
  onError?: () => void;
}

export default function QrCanvas({ value, ariaLabel, className, onError }: QrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    import('lean-qr')
      .then(({ generate }) => {
        if (!cancelled && canvasRef.current) generate(value).toCanvas(canvasRef.current);
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.();
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={ariaLabel} />;
}
