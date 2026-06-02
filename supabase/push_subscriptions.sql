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
-- Note : on N'utilise PAS l'upsert PostgREST (resolution=merge-duplicates) côté
-- client. Le ON CONFLICT DO UPDATE qui en découle exige une policy SELECT sous
-- RLS, qu'on refuse ici. Le client fait donc INSERT puis PATCH si 409 (cf.
-- src/lib/push.ts subscribeToReminders).

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

-- Anti-nag : marquage de la séance du jour.
--
-- ⚠ On NE peut PAS faire ça via un PATCH client direct. Sous RLS, un UPDATE
-- filtré (`WHERE endpoint = …`) doit d'abord LIRE la ligne ciblée, donc les
-- policies SELECT s'appliquent — or on en refuse une exprès (anti-énumération).
-- Sans ligne visible, l'UPDATE matche 0 ligne *tout en renvoyant 204* :
-- last_session_date n'était jamais écrit et l'anti-nag ne se déclenchait jamais.
--
-- La fonction ci-dessous est SECURITY DEFINER (s'exécute en tant que `postgres`,
-- propriétaire de la table → bypasse RLS) et ne RETOURNE RIEN : le client peut
-- mettre à jour SA ligne (clé = endpoint opaque) sans qu'aucune lecture/énumération
-- de la table ne soit possible. Appelée par src/lib/push.ts syncLastSession via
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
