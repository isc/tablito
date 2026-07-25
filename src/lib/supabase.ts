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

/**
 * Appelle une fonction SECURITY DEFINER (`POST /rest/v1/rpc/<name>`). Renvoie
 * null si la config est absente ou si l'appel n'a pas abouti du tout
 * (hors-ligne, service injoignable) — à l'appelant de distinguer ce cas d'une
 * réponse non-ok, qui remonte telle quelle.
 */
export async function supabaseRpc(name: string, body: unknown): Promise<Response | null> {
  const env = supabaseEnv();
  if (!env) return null;
  try {
    return await fetch(`${env.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: supabaseHeaders(env.key),
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}
