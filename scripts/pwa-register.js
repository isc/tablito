// Le chemin du SW est substitué par scripts/build.mjs.
export function registerSW() {
  if (!('serviceWorker' in navigator)) return () => {}
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(__SW_PATH__).catch((e) => {
      console.warn('[pwa] SW registration failed', e)
    })
  })
  return () => {}
}
