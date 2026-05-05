// Le chemin du SW est substitué par scripts/build.mjs.
//
// Deux comportements importants pour que les mises à jour soient rapides :
//
//  1. `updateViaCache: 'none'` : le browser bypasse son cache HTTP pour
//     fetcher /sw.js. Sans ça, Cache-Control peut bloquer la détection
//     d'un nouveau SW pendant des heures.
//
//  2. Un listener `controllerchange` : quand le nouveau SW prend le
//     contrôle (clients.claim côté SW), on reload la page automatiquement
//     pour que l'utilisateur voie le nouveau contenu sans avoir à fermer
//     et rouvrir. La garde `refreshing` évite la boucle si plusieurs
//     événements se succèdent.

export function registerSW() {
  if (!('serviceWorker' in navigator)) return () => {}

  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(__SW_PATH__, { updateViaCache: 'none' })
      .catch((e) => {
        console.warn('[pwa] SW registration failed', e)
      })
  })

  return () => {}
}
