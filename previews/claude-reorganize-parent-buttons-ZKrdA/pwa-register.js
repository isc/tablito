// Le chemin du SW est substitué par scripts/build.mjs.
//
// Deux comportements importants pour que les mises à jour soient rapides :
//
//  1. `updateViaCache: 'none'` : le browser bypasse son cache HTTP pour
//     fetcher /sw.js. Sans ça, Cache-Control peut bloquer la détection
//     d'un nouveau SW pendant des heures.
//
//  2. Un listener `controllerchange` qui fait `window.location.reload()`
//     QUAND le SW est mis à jour (= passage d'un SW déjà actif à un
//     nouveau). Le check `controller != null` au module-load distingue
//     ce cas de la première installation : on n'attache le listener que
//     si la page a déjà un controller, sinon le first-install
//     déclencherait un reload immédiat (par ex. en CI Playwright).

export function registerSW() {
  if (!('serviceWorker' in navigator)) return () => {}

  if (navigator.serviceWorker.controller) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register("/multiplix/previews/claude-reorganize-parent-buttons-ZKrdA/sw.js", { updateViaCache: 'none' })
      .catch((e) => {
        console.warn('[pwa] SW registration failed', e)
      })
  })

  return () => {}
}
