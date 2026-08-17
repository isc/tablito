import { useEffect, useRef } from 'react';

/**
 * Miroir de la dernière valeur d'une prop dans une ref.
 *
 * Sert aux composants vocaux : les callbacks de reconnaissance
 * (`useSpeechRecognition`) doivent lire l'état le plus frais SANS être recréés à
 * chaque render — les recréer relance l'effet qui les enregistre plusieurs fois
 * par question, pour rien. La ref est écrite dans un effet, jamais pendant le
 * render : une ref ne participe pas au rendu.
 *
 * L'idiome traînait déjà, écrit à la main, dans `VoiceInput` (trois fois) et
 * dans `ConjVoiceInput` (autant) ; il vit ici pour n'avoir qu'une définition.
 */
export function useLatestRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
