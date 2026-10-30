// Serveurs `watches` et `transfers` en mémoire, avec la sémantique exacte des
// RPC de supabase/watches.sql et supabase/transfers.sql : un suivi se dépose de
// façon idempotente par code (ou sous condition, pour la synchro), se relit
// sans être consommé et se révoque ; un transfert, lui, ne se lit qu'une fois.
//
// Partagé par les tests du suivi et du transfert pour que le contrat de fil
// (`p_code`, `p_payload`, `updated_at`, codes de statut) n'ait qu'un seul endroit
// à corriger le jour où le SQL bouge. Ce fichier n'est pas un `*.test.ts` : il
// n'est donc pas collecté comme suite par la config vitest par défaut.

import { vi } from 'vitest';

export interface WatchRow {
  payload: string;
  updated_at: string;
}

interface MockOptions {
  // Que faire des appels hors de ces tables. 'throw' pour les tests unitaires
  // (tout appel inattendu est un bug du test) ; 'ignore' pour les tests
  // d'intégration, où l'app émet aussi des appels push / feedback qui ne sont
  // pas le sujet.
  otherCalls?: 'throw' | 'ignore';
}

/** Stub `fetch` et renvoie les deux tables, pour inspection dans les assertions. */
export function mockSupabaseServer({ otherCalls = 'throw' }: MockOptions = {}): {
  watches: Map<string, WatchRow>;
  transfers: Map<string, string>;
} {
  const watches = new Map<string, WatchRow>();
  const transfers = new Map<string, string>();
  // Dates de dépôt toutes distinctes, comme le now() de Postgres d'une
  // transaction à l'autre : le dépôt conditionnel s'y fie.
  const start = Date.now();
  let deposits = 0;
  const stamp = () => new Date(start + ++deposits).toISOString();
  const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
  type Body = { p_code: string; p_payload?: string; p_since?: string | null; p_expected?: string | null };
  const rpc: Record<string, (body: Body) => Response> = {
    publish_watch: (body) => {
      watches.set(body.p_code, { payload: body.p_payload!, updated_at: stamp() });
      return new Response(null, { status: 204 });
    },
    read_watch: (body) => json(watches.get(body.p_code) ?? null),
    read_watch_since: (body) => {
      const row = watches.get(body.p_code);
      if (!row) return json(null);
      return json({ updated_at: row.updated_at, payload: body.p_since === row.updated_at ? null : row.payload });
    },
    publish_watch_if: (body) => {
      const row = watches.get(body.p_code);
      if (body.p_expected == null ? row : row?.updated_at !== body.p_expected) {
        return json({ status: row ? 'conflict' : 'missing' });
      }
      const updated_at = stamp();
      watches.set(body.p_code, { payload: body.p_payload!, updated_at });
      return json({ status: 'ok', updated_at });
    },
    revoke_watch: (body) => {
      watches.delete(body.p_code);
      return new Response(null, { status: 204 });
    },
    create_transfer: (body) => {
      transfers.set(body.p_code, body.p_payload!);
      return new Response(null, { status: 204 });
    },
    read_transfer: (body) => {
      const payload = transfers.get(body.p_code) ?? null;
      transfers.delete(body.p_code); // lecture unique
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const handler = rpc[String(url).split('/rpc/')[1]];
      if (handler) return handler(JSON.parse(String(init?.body)));
      if (otherCalls === 'ignore') return new Response(null, { status: 204 });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
  return { watches, transfers };
}

/** Le serveur, vu du suivi seul : sa table `watches`. */
export function mockWatchServer(options: MockOptions = {}): Map<string, WatchRow> {
  return mockSupabaseServer(options).watches;
}

/** Config Supabase minimale attendue par lib/watch (à appeler en beforeEach). */
export function stubSupabaseEnv(): void {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'pk_test');
}
