// Le chemin du SW est substitué par scripts/build.mjs.
//
// Mises à jour sans casser une séance en cours :
//
//  1. `updateViaCache: 'none'` : le browser bypasse son cache HTTP pour
//     fetcher /sw.js. Sans ça, Cache-Control peut bloquer la détection
//     d'un nouveau SW pendant des heures.
//
//  2. Le SW NE FAIT PAS skipWaiting() automatiquement (cf. sw.js). Quand
//     une nouvelle version est prête, elle reste en `waiting` jusqu'à ce
//     qu'on lui envoie le message SKIP_WAITING. On ne l'envoie que
//     lorsque l'app est dans un état "safe" (= pas dans l'écran session,
//     ni dans l'un des écrans lourds — voir setBusy() ci-dessous, piloté
//     par App.tsx). Évite le scénario "kid démarre une séance pendant
//     que le nouveau SW finit son install → reload mid-session".
//
//  3. `controllerchange` → `window.location.reload()`. Avec (2), cet
//     event ne se déclenche QUE quand on a explicitement décidé de
//     basculer sur le nouveau SW.
//
//  4. `reg.update()` sur `visibilitychange` : sans ça, une session
//     longue (onglet/PWA gardé ouvert plusieurs heures) ne récupère
//     jamais les nouveaux déploiements — `register()` ne tourne qu'au
//     `load`. Avec, dès que l'utilisateur revient sur l'app, on poll
//     `/sw.js` (cooldown 1 min pour éviter le spam sur les bascules
//     rapides). La détection d'un waiting SW déclenche ensuite le flow
//     normal (trackWaiting → SKIP_WAITING quand safe).

let waitingWorker = null
let busy = false
let refreshing = false
let currentRegistration = null
let lastUpdateCheck = 0
const UPDATE_CHECK_COOLDOWN_MS = 60_000

function maybeUpdate() {
  if (waitingWorker && !busy && !refreshing) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }
}

function trackWaiting(reg) {
  currentRegistration = reg
  if (reg.waiting && navigator.serviceWorker.controller) {
    waitingWorker = reg.waiting
    maybeUpdate()
  }
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing
    if (!sw) return
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = sw
        maybeUpdate()
      }
    })
  })
}

function checkForUpdate() {
  if (!currentRegistration) return
  const now = Date.now()
  if (now - lastUpdateCheck < UPDATE_CHECK_COOLDOWN_MS) return
  lastUpdateCheck = now
  currentRegistration.update().catch((e) => {
    console.warn('[pwa] SW update check failed', e)
  })
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return () => {}

  // Reload n'a de sens que sur un UPDATE d'un SW existant. Sur la
  // première install, controllerchange est aussi déclenché par
  // clients.claim() qui passe la page de "non contrôlée" à "contrôlée"
  // — pas un update à appliquer, et reload en pleine 1re visite casse
  // les scripts Playwright (cf. user-guide qui screenshote l'app).
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(__SW_PATH__, { updateViaCache: 'none' })
      .then(trackWaiting)
      .catch((e) => {
        console.warn('[pwa] SW registration failed', e)
      })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })

  return () => {}
}

// Appelé par App.tsx quand l'écran courant change. Tant que busy=true,
// on n'applique pas une mise à jour qui forcerait un reload (= perte de
// l'état mémoire). Dès que busy repasse à false (retour vers home/landing),
// on tente d'appliquer un waiting SW s'il y en a un.
export function setBusy(v) {
  const next = !!v
  if (next === busy) return
  busy = next
  if (!busy) maybeUpdate()
}
