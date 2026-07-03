import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { LangProvider } from './i18n/LangProvider'
import { importProfileFromUrl } from './lib/storage'
import { initLayoutDebug } from './lib/layoutDebug'
import { transferFetchingStrings } from './i18n/onboarding'
import type { TransferImportResult } from './lib/transfer'

// Deux imports par fragment d'URL, AVANT de monter l'app pour que
// loadProfile() voie le profil et atterrisse direct sur l'accueil :
//  - #import=   : migration cross-origin (ancien domaine → tablito.app)
//  - #transfer= : transfert depuis un autre appareil (QR de l'espace parent).
//    lib/transfer n'est chargé que si le fragment est là : un boot ordinaire
//    (l'immense majorité) garde son graphe de modules eager inchangé.
async function boot() {
  // Sonde layout en tout premier : elle doit couvrir la fenêtre de boot
  // (c'est là que l'anomalie de scroll post-reload peut naître).
  initLayoutDebug()
  await importProfileFromUrl()
  const root = document.getElementById('root')!
  let transferResult: TransferImportResult = null
  if (window.location.hash.includes('transfer=')) {
    // La récupération (réseau + déchiffrement) prend un instant : l'afficher
    // tout de suite, sinon l'utilisateur qui vient de scanner le QR regarde un
    // écran vide — ou l'accueil vierge si la PWA était déjà ouverte — et doute
    // que le scan ait marché. Hors LangProvider (rien n'est monté) : on lit la
    // langue posée sur <html> par l'inline script d'index.html, pré-paint.
    const wait = document.createElement('div')
    wait.className = 'app-loading'
    wait.textContent =
      transferFetchingStrings[document.documentElement.lang === 'en' ? 'en' : 'fr']
    root.replaceChildren(wait)
    transferResult = await (await import('./lib/transfer')).importTransferFromUrl()
    root.replaceChildren()
  }
  registerSW()
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <LangProvider>
          <App transferResult={transferResult} />
        </LangProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

boot()
