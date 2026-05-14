// Types pour `import.meta.env.*` et `virtual:pwa-register`. Remplacent les
// déclarations qu'on récupérait avant de `vite/client` et de
// `vite-plugin-pwa/vanillajs` (cf. tsconfig.app.json `types`).

interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly VITE_APP_VERSION: string
  readonly VITE_BASE_PATH: string
  // Conventionnellement string : si la conf est absente, le code consommateur
  // garde une chaîne vide (cf. `feedbackEnabled` dans src/lib/feedback.ts).
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'virtual:pwa-register' {
  export function registerSW(): () => void
  export function setBusy(busy: boolean): void
}
