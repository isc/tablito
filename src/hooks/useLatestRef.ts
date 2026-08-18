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
 * Une seule définition pour les deux composants vocaux (`VoiceInput` côté
 * maths, `ConjVoiceInput` côté conjugaison), qui l'écrivaient à la main trois
 * fois chacun.
 *
 * Une nuance à connaître : la ref rendue par un hook n'est pas reconnue comme
 * stable par `react-hooks/exhaustive-deps` (contrairement à un `useRef` en
 * clair). Elle doit donc figurer dans les tableaux de dépendances des
 * `useCallback` qui la lisent — ce qui ne change rien à leur identité, l'objet
 * ref ne bougeant jamais.
 */
export function useLatestRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
