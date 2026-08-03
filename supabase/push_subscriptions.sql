-- Schéma de référence de la table `push_subscriptions` (Web Push : rappel
-- quotidien de séance ET recap hebdomadaire du suivi à distance).
--
-- ⚠ Ce projet n'a PAS de système de migrations : la DDL est appliquée à la main
-- sur l'instance Supabase (comme la table `feedback`). Ce fichier documente
-- l'état canonique pour la reproductibilité — il n'est exécuté par aucun build.
--
-- ⚠ ORDRE DE DÉPLOIEMENT : appliquer ce fichier AVANT de déployer le client qui
-- l'utilise. Le sens inverse casse l'existant — un nouveau client face à une base
-- sans `upsert_push_prefs` / `read_push_prefs` reçoit des 404, affiche donc ses
-- deux toggles à OFF alors que le rappel quotidien tourne, et la moindre action
-- de l'utilisateur pour « le remettre » échoue. Dans l'autre sens (DDL d'abord),
-- les clients encore en cache continuent d'appeler upsert_push_subscription,
-- conservée intacte plus bas, et rien ne change pour eux.
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
-- passe donc par des fonctions SECURITY DEFINER (upsert_push_prefs pour les
-- préférences, read_push_prefs pour les relire, mark_reminder_session pour
-- l'anti-nag) qui bypassent RLS — cf. src/lib/push.ts. Seul le DELETE de désabonnement reste
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
  -- Deux abonnements distincts portés par la MÊME subscription push, parce
  -- qu'ils ne s'adressent pas à la même personne : le rappel quotidien pousse
  -- l'enfant à faire sa séance (sur SON appareil), le recap hebdomadaire prévient
  -- le parent que la progression de l'enfant qu'il suit à distance a bougé (sur
  -- l'appareil DU PARENT). Vouloir l'un sans l'autre est le cas normal.
  -- `daily_reminder` vaut true par défaut : les abonnés d'avant cette colonne
  -- s'étaient inscrits précisément pour ça, leur comportement ne change pas.
  daily_reminder     boolean not null default true,
  weekly_recap       boolean not null default false,
  last_weekly_date   text,                       -- 'YYYY-MM-DD' local — dernier recap envoyé
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Ajout des colonnes sur une instance qui a déjà la table (ce projet n'a pas de
-- migrations : ce fichier doit rester rejouable tel quel).
alter table public.push_subscriptions
  add column if not exists daily_reminder boolean not null default true,
  add column if not exists weekly_recap   boolean not null default false,
  add column if not exists last_weekly_date text;

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

-- LEGACY — conservée uniquement pour les clients déjà déployés (cf. la note sur
-- upsert_push_prefs plus bas). Ne rien y ajouter : le code actuel appelle
-- upsert_push_prefs. Supprimable quand plus aucun client ne l'appellera.
-- (Dé)s'abonner : upsert de la ligne par endpoint. Le ON CONFLICT préserve
-- last_session_date / last_notified_date (non touchés ici). Ne mentionnant pas
-- daily_reminder, l'insertion prend le défaut de colonne (true) : c'est
-- exactement l'ancienne sémantique, « être abonné = vouloir le rappel ».
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

-- ⚠ NOM DISTINCT, et non une signature élargie de upsert_push_subscription.
-- Ajouter des paramètres à celle-ci en aurait fait une SURCHARGE : les appels à
-- 4 arguments des clients encore en cache (le SW peut mettre un moment à se
-- mettre à jour) seraient devenus ambigus — « function is not unique ». Et la
-- supprimer aurait été pire : un client périmé aurait alors créé sa ligne via la
-- nouvelle fonction avec p_daily = NULL, donc un rappel quotidien à false, sans
-- que personne ne s'en aperçoive. L'ancienne fonction reste donc en place, avec
-- sa sémantique intacte, jusqu'à ce que plus aucun client ne l'appelle.
--
-- Mise à jour PARTIELLE des préférences : un paramètre NULL laisse le drapeau
-- inchangé. Indispensable parce que les deux toggles vivent dans deux endroits
-- distincts de l'espace parent — avec un upsert « total », activer le recap
-- hebdomadaire écraserait le rappel quotidien avec une valeur lue plus tôt.
-- À l'insertion, un NULL vaut false : un parent qui n'active que le recap ne doit
-- pas hériter du rappel de séance (il n'a pas de séance à faire).
-- RENVOIE l'état résultant, et pas void : le client doit savoir si l'autre
-- préférence est encore active pour décider de supprimer ou non l'abonnement.
-- Le lui faire relire par un second appel serait bancal — une lecture qui échoue
-- (hors-ligne) ne se distingue pas d'un « plus rien d'actif », et on
-- supprimerait alors un abonnement bien vivant. Ici la décision découle d'une
-- valeur lue dans la même transaction que l'écriture.
-- (drop préalable : create or replace ne peut pas changer un type de retour. La
--  fonction est neuve, rien de déployé n'en dépend.)
drop function if exists public.upsert_push_prefs(text, text, text, text, boolean, boolean);
create function public.upsert_push_prefs(
  p_endpoint text, p_p256dh text, p_auth text, p_timezone text,
  p_daily boolean default null, p_weekly boolean default null
) returns jsonb
language sql
security definer
set search_path = public
as $$
  insert into public.push_subscriptions
      (endpoint, p256dh, auth, timezone, daily_reminder, weekly_recap, updated_at)
    values (p_endpoint, p_p256dh, p_auth, p_timezone,
            coalesce(p_daily, false), coalesce(p_weekly, false), now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        timezone = excluded.timezone,
        daily_reminder = coalesce(p_daily, public.push_subscriptions.daily_reminder),
        weekly_recap = coalesce(p_weekly, public.push_subscriptions.weekly_recap),
        updated_at = now()
  returning jsonb_build_object('daily', daily_reminder, 'weekly', weekly_recap);
$$;

revoke all on function public.upsert_push_prefs(text, text, text, text, boolean, boolean) from public;
grant execute on function public.upsert_push_prefs(text, text, text, text, boolean, boolean) to anon, authenticated;

-- Lecture des préférences de SA ligne. Nécessaire parce que la table n'a aucune
-- policy SELECT (anti-énumération) : sans ce RPC, l'espace parent ne pourrait pas
-- réconcilier ses deux toggles à l'ouverture et afficherait un état inventé.
-- L'endpoint push est une URL opaque non devinable : le connaître EST
-- l'autorisation, exactement comme pour les écritures ci-dessus. Ne renvoie que
-- les deux booléens — ni clés, ni dates, ni existence d'autres lignes.
create or replace function public.read_push_prefs(p_endpoint text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('daily', daily_reminder, 'weekly', weekly_recap)
    from public.push_subscriptions
   where endpoint = p_endpoint;
$$;

revoke all on function public.read_push_prefs(text) from public;
grant execute on function public.read_push_prefs(text) to anon, authenticated;

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
