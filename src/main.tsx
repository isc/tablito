import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { LangProvider } from './i18n/LangProvider'
import { importProfileFromUrl } from './lib/storage'
import type { TransferImportResult } from './lib/transfer'

// Deux imports par fragment d'URL, AVANT de monter l'app pour que
// loadProfile() voie le profil et atterrisse direct sur l'accueil :
//  - #import=   : migration cross-origin (ancien domaine → tablito.app)
//  - #transfer= : transfert depuis un autre appareil (QR de l'espace parent).
//    lib/transfer n'est chargé que si le fragment est là : un boot ordinaire
//    (l'immense majorité) garde son graphe de modules eager inchangé.
async function boot() {
  await importProfileFromUrl()
  let transferResult: TransferImportResult = null
  if (window.location.hash.includes('transfer=')) {
    transferResult = await (await import('./lib/transfer')).importTransferFromUrl()
  }
  registerSW()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <LangProvider>
          <App transferError={transferResult === 'error'} />
        </LangProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

boot()
