import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { LangProvider } from './i18n/lang'
import { importProfileFromUrl } from './lib/storage'

// Migration cross-origin (ancien domaine → tablito.app) : si on arrive avec un
// profil dans le fragment d'URL (#import=…), on le réinjecte AVANT de monter
// l'app, pour que loadProfile() le voie et atterrisse direct sur l'accueil.
async function boot() {
  await importProfileFromUrl()
  registerSW()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <LangProvider>
          <App />
        </LangProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

boot()
