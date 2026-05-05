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
  export function registerSW(options?: { immediate?: boolean }): () => Promise<void>
}

// Imports CSS à effet de bord (`import './Foo.css'`) : pas de valeur, juste
// un side-effect côté runtime (le build génère un shim qui injecte un <link>).
declare module '*.css'
