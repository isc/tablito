// Serveur `watches` en mémoire pour les tests du suivi à distance, avec la
// sémantique exacte des RPC de supabase/watches.sql : dépôt idempotent par code,
// lecture NON consommante (à l'inverse de read_transfer), révocation destructive.
//
// Partagé par watch.test.ts et remoteFollow.test.tsx pour que le contrat de fil
// (`p_code`, `p_payload`, `updated_at`, codes de statut) n'ait qu'un seul endroit
// à corriger le jour où le SQL bouge. Ce fichier n'est pas un `*.test.ts` : il
// n'est donc pas collecté comme suite par la config vitest par défaut.

import { vi } from 'vitest';

export interface WatchRow {
  payload: string;
  updated_at: string;
}

interface MockOptions {
  // Que faire des appels hors `watches`. 'throw' pour les tests unitaires (tout
  // appel inattendu est un bug du test) ; 'ignore' pour les tests d'intégration,
  // où l'app émet aussi des appels push / feedback qui ne sont pas le sujet.
  otherCalls?: 'throw' | 'ignore';
}

/** Stub `fetch` et renvoie la table, pour inspection dans les assertions. */
export function mockWatchServer({ otherCalls = 'throw' }: MockOptions = {}): Map<string, WatchRow> {
  const rows = new Map<string, WatchRow>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const name = String(url).split('/rpc/')[1];
      if (name === 'publish_watch' || name === 'read_watch' || name === 'revoke_watch') {
        const body = JSON.parse(String(init?.body));
        if (name === 'publish_watch') {
          rows.set(body.p_code, {
            payload: body.p_payload,
            updated_at: new Date().toISOString(),
          });
          return new Response(null, { status: 204 });
        }
        if (name === 'read_watch') {
          return new Response(JSON.stringify(rows.get(body.p_code) ?? null), { status: 200 });
        }
        rows.delete(body.p_code);
        return new Response(null, { status: 204 });
      }
      if (otherCalls === 'ignore') return new Response(null, { status: 204 });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
  return rows;
}

/** Config Supabase minimale attendue par lib/watch (à appeler en beforeEach). */
export function stubSupabaseEnv(): void {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'pk_test');
}
