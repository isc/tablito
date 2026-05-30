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
