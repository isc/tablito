// Le chemin du SW est substitué par scripts/build.mjs.
export function registerSW() {
  if (!('serviceWorker' in navigator)) return () => {}
  window.addEventListener('load', () => {
    navigator.serviceWorker.register("/multiplix/sw.js").catch((e) => {
      console.warn('[pwa] SW registration failed', e)
    })
  })
  return () => {}
}
