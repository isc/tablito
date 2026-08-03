// Mécanique commune aux deux toggles de notification de l'espace parent : le
// rappel quotidien de séance (appareil de l'enfant) et le recap hebdomadaire du
// suivi à distance (appareil du parent). Même cycle — réconcilier l'état
// enregistré au montage, demander la permission à l'activation, distinguer
// « refusé » de « indisponible ».
//
// Chaque toggle ne pilote QUE son drapeau : la mise à jour est partielle côté
// SQL, donc deux hooks montés en même temps ne s'écrasent pas.

import { useCallback, useEffect, useState } from 'react';
import { getPushPrefs, setPushPref, type PushPrefs } from '../lib/push';

interface PushPrefStrings {
  blocked: string;
  unavailable: string;
}

export function usePushPref(key: keyof PushPrefs, t: PushPrefStrings) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushPrefs().then((prefs) => {
      if (!cancelled) setEnabled(prefs[key]);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = !enabled;
      const res = await setPushPref(key, next);
      if (res === 'ok') setEnabled(next);
      else if (res === 'denied') setMessage(t.blocked);
      else setMessage(t.unavailable);
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, key, t]);

  return { enabled, busy, message, toggle };
}
