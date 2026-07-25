import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { LangProvider } from './i18n/LangProvider'
import { importProfileFromUrl } from './lib/storage'
import { transferFetchingStrings, watchFetchingStrings } from './i18n/onboarding'
import type { TransferImportResult } from './lib/transfer'
import type { WatchPairing } from './lib/watch'

// Écran d'attente affiché AVANT de monter l'app : la récupération (réseau +
// déchiffrement) prend un instant, sinon l'utilisateur qui vient de scanner un QR
// regarde un écran vide — ou l'accueil vierge si la PWA était déjà ouverte — et
// doute que le scan ait marché. Hors LangProvider (rien n'est monté) : on lit la
// langue posée sur <html> par l'inline script d'index.html, pré-paint.
function showWaiting(root: HTMLElement, strings: { fr: string; en: string }) {
  const wait = document.createElement('div')
  wait.className = 'app-loading'
  wait.textContent = strings[document.documentElement.lang === 'en' ? 'en' : 'fr']
  root.replaceChildren(wait)
}

// Trois traitements par fragment d'URL, AVANT de monter l'app pour que
// loadProfile() voie le profil et qu'on atterrisse direct sur le bon écran :
//  - #import=   : migration cross-origin (ancien domaine → tablito.app)
//  - #transfer= : transfert depuis un autre appareil (QR de l'espace parent)
//  - #watch=    : appairage d'un suivi à distance — le parent scanne le QR de
//    l'appareil de son enfant. Rien n'est installé ici : l'appareil devient
//    seulement suiveur, ce qui doit marcher même sans aucun profil local.
// Les libs correspondantes ne sont chargées que si le fragment est là : un boot
// ordinaire (l'immense majorité) garde son graphe de modules eager inchangé.
async function boot() {
  await importProfileFromUrl()
  const root = document.getElementById('root')!
  // Avant l'appairage, pas après : registerSW ne dépend d'aucun de ses résultats,
  // et le faire attendre un aller-retour réseau retarderait d'autant le précache
  // du shell — précisément sur le boot le plus froid (première visite du parent).
  registerSW()
  let transferResult: TransferImportResult = null
  let watchPairing: WatchPairing | 'error' | null = null
  const hash = window.location.hash
  if (hash.includes('transfer=')) {
    showWaiting(root, transferFetchingStrings)
    transferResult = await (await import('./lib/transfer')).importTransferFromUrl()
    root.replaceChildren()
  } else if (hash.includes('watch=')) {
    showWaiting(root, watchFetchingStrings)
    // Un appairage atterrit sur l'espace parent, qui est lazy : on amorce son
    // chunk en parallèle de la relecture réseau, au lieu d'enchaîner les deux
    // allers-retours. Sans await — c'est un préchargement, pas une dépendance.
    void import('./screens/ParentDashboard')
    watchPairing = await (await import('./lib/watch')).importWatchFromUrl()
    root.replaceChildren()
  }
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <LangProvider>
          <App transferResult={transferResult} watchPairing={watchPairing} />
        </LangProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

boot()
