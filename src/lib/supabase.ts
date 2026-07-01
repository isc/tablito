// Plumbing Supabase partagé (PostgREST + publishable key), consommé par
// feedback.ts, push.ts et transfer.ts — un seul endroit à toucher si la
// convention d'auth change.

/**
 * Config Supabase, ou null si absente (contributeur sans .env : les features
 * réseau se désactivent au runtime, sans crash). Lecture paresseuse : permet
 * de stubber l'env dans les tests.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** Headers communs des appels PostgREST (tables et RPC). */
export function supabaseHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}
