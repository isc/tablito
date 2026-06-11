// Le chemin du SW est substitué par scripts/build.mjs.
//
// Stratégie de mise à jour :
//
//  1. `updateViaCache: 'none'` : le browser bypasse son cache HTTP pour
//     fetcher /sw.js. Sans ça, Cache-Control peut bloquer la détection
//     d'un nouveau SW pendant des heures.
//
//  2. Le SW fait `skipWaiting()` côté SW (cf. sw.js), donc dès qu'un
//     nouveau SW finit son install il prend le contrôle. La protection
//     "ne pas reloader pendant une séance" est ici, dans le handler
//     `controllerchange` : si `busy=true` au moment où le nouveau SW
//     prend le contrôle, on retient le reload (pendingReload) et on le
//     déclenche quand busy repasse à false (= retour sur home).
//
//  3. `reg.update()` sur `visibilitychange` : sans ça, une session
//     longue (onglet/PWA gardé ouvert plusieurs heures) ne récupère
//     jamais les nouveaux déploiements — `register()` ne tourne qu'au
//     boot. Avec, dès que l'utilisateur revient sur l'app, on poll
//     `/sw.js` (cooldown 1 min pour éviter le spam sur les bascules
//     rapides).

let busy = false
let pendingReload = false
let refreshing = false
let currentRegistration = null
let lastUpdateCheck = 0
const UPDATE_CHECK_COOLDOWN_MS = 60_000

function triggerReload() {
  if (refreshing) return
  refreshing = true
  window.location.reload()
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
      if (busy) {
        pendingReload = true
        return
      }
      triggerReload()
    })
  }

  const startRegistration = () => {
    navigator.serviceWorker
      .register("/previews/claude-multi-profile-mode-o2dd9t/sw.js", { updateViaCache: 'none' })
      .then((reg) => { currentRegistration = reg })
      .catch((e) => {
        console.warn('[pwa] SW registration failed', e)
      })
  }

  // `load` a presque toujours déjà fire quand on arrive ici (main.tsx est
  // chargé via dynamic import depuis index.html, qui ne bloque pas `load`).
  // Attacher un listener à un évènement passé ne déclencherait jamais le
  // register → aucune mise à jour ne se propagerait.
  if (document.readyState === 'complete') {
    startRegistration()
  } else {
    window.addEventListener('load', startRegistration, { once: true })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })

  return () => {}
}

// Appelé par App.tsx quand l'écran courant change. Tant que busy=true,
// on n'applique pas une mise à jour qui forcerait un reload (= perte de
// l'état mémoire). Dès que busy repasse à false (retour vers home/landing),
// si un nouveau SW a pris le contrôle entre-temps, on déclenche le reload.
export function setBusy(v) {
  const next = !!v
  if (next === busy) return
  busy = next
  if (!busy && pendingReload) triggerReload()
}
