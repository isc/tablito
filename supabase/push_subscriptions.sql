-- Schéma de référence de la table `push_subscriptions` (rappel quotidien Web Push).
--
-- ⚠ Ce projet n'a PAS de système de migrations : la DDL est appliquée à la main
-- sur l'instance Supabase (comme la table `feedback`). Ce fichier documente
-- l'état canonique pour la reproductibilité — il n'est exécuté par aucun build.
--
-- Application manuelle :
--   psql "$SUPABASE_DB_URL" -f supabase/push_subscriptions.sql
-- (idempotent : create table if not exists + drop policy if exists)
--
-- Acteurs :
--   - client (clé publishable, rôle anon/authenticated) : insert / update / delete
--     SA PROPRE ligne, repérée par son `endpoint` (URL push opaque non devinable).
--     Aucune lecture : pas de policy SELECT → impossible d'énumérer les abonnés.
--   - cron d'envoi (scripts/send-reminders.mjs, clé secrète, rôle service_role) :
--     bypass RLS, lit toutes les lignes, patch `last_notified_date`, purge les 410.
--
-- Note : le client n'écrit JAMAIS la table en direct (ni INSERT, ni PATCH, ni
-- upsert PostgREST). Sous RLS, toute écriture filtrée par endpoint (PATCH /
-- DELETE / ON CONFLICT) doit lire la ligne ciblée, donc une policy SELECT serait
-- requise — qu'on refuse ici (anti-énumération). Sans ligne « visible »,
-- l'écriture matche 0 ligne *en renvoyant 204* : échec silencieux. Le client
-- passe donc par deux fonctions SECURITY DEFINER (upsert_push_subscription pour
-- (dé)s'abonner, mark_reminder_session pour l'anti-nag) qui bypassent RLS et ne
-- retournent rien — cf. src/lib/push.ts. Seul le DELETE de désabonnement reste
-- best-effort en direct : il échoue en silence mais le cron purge l'endpoint au
-- premier 410, et la subscription locale est retirée côté navigateur.

create table if not exists public.push_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  endpoint           text not null unique,       -- URL push (clé naturelle, secret de facto)
  p256dh             text not null,              -- clé publique de chiffrement de la subscription
  auth               text not null,              -- secret d'authentification de la subscription
  timezone           text not null,              -- IANA, ex 'Europe/Paris' (fenêtre 18h locale)
  last_session_date  text,                       -- 'YYYY-MM-DD' local — anti-nag
  last_notified_date text,                       -- 'YYYY-MM-DD' local — dédoublonnage (1 envoi/jour)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Rôles : la clé publishable de ce projet agit comme `authenticated` ; on cible
-- aussi `anon` par robustesse (et cohérence avec la table `feedback`).
drop policy if exists "client insert" on public.push_subscriptions;
drop policy if exists "client update" on public.push_subscriptions;
drop policy if exists "client delete" on public.push_subscriptions;

create policy "client insert" on public.push_subscriptions
  for insert to anon, authenticated with check (true);
create policy "client update" on public.push_subscriptions
  for update to anon, authenticated using (true) with check (true);
create policy "client delete" on public.push_subscriptions
  for delete to anon, authenticated using (true);
-- (service_role bypasse la RLS — utilisé par le cron d'envoi)

-- Fonctions d'écriture client (SECURITY DEFINER, s'exécutent en tant que
-- `postgres` propriétaire de la table → bypassent RLS, ne retournent rien). Voir
-- la note d'en-tête : un INSERT/PATCH/upsert direct filtré par endpoint matcherait
-- 0 ligne sous RLS sans policy SELECT, qu'on refuse volontairement.

-- (Dé)s'abonner : upsert de la ligne par endpoint. Le ON CONFLICT préserve
-- last_session_date / last_notified_date (non touchés ici). Appelée par
-- src/lib/push.ts subscribeToReminders via POST /rest/v1/rpc/upsert_push_subscription.
create or replace function public.upsert_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_timezone text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_subscriptions (endpoint, p256dh, auth, timezone, updated_at)
    values (p_endpoint, p_p256dh, p_auth, p_timezone, now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        timezone = excluded.timezone,
        updated_at = now();
$$;

revoke all on function public.upsert_push_subscription(text, text, text, text) from public;
grant execute on function public.upsert_push_subscription(text, text, text, text) to anon, authenticated;

-- Anti-nag : marquage de la séance du jour, pour que le cron saute l'envoi un
-- jour de séance. Appelée par src/lib/push.ts syncLastSession via
-- POST /rest/v1/rpc/mark_reminder_session.
create or replace function public.mark_reminder_session(p_endpoint text, p_session_date text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions
     set last_session_date = p_session_date,
         updated_at = now()
   where endpoint = p_endpoint;
$$;

revoke all on function public.mark_reminder_session(text, text) from public;
grant execute on function public.mark_reminder_session(text, text) to anon, authenticated;
