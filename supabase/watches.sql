-- Schéma de référence de la table `watches` (suivi à distance d'un profil
-- depuis l'appareil d'un parent).
--
-- ⚠ Ce projet n'a PAS de système de migrations : la DDL est appliquée à la main
-- sur l'instance Supabase (comme `feedback`, `push_subscriptions` et
-- `transfers`). Ce fichier documente l'état canonique pour la reproductibilité.
--
-- Application manuelle :
--   psql "$SUPABASE_DB_URL" -f supabase/watches.sql
-- (idempotent : create table if not exists + create or replace function)
--
-- Fonctionnement (cf. src/lib/watch.ts) :
--   - L'appareil de l'enfant chiffre un instantané de son profil CÔTÉ CLIENT
--     (AES-GCM, même primitive que `transfers`) et le dépose sous un code haute
--     entropie, rafraîchi après chaque séance. Le serveur ne voit jamais ni la
--     clé ni le contenu en clair.
--   - L'appareil du parent a scanné une fois un QR `#watch=<code>.<clé>` : le
--     code sert à relire le blob, la clé (restée dans le fragment d'URL, jamais
--     envoyée au serveur) à le déchiffrer.
--
-- Différence essentielle avec `transfers`, qui justifie une table séparée :
-- ici le dépôt est DURABLE et la lecture NON CONSOMMANTE (un transfert vit
-- 15 minutes et s'efface en étant lu). Le code est donc une capacité
-- permanente : qui l'obtient peut relire la progression de l'enfant jusqu'à
-- révocation. Garde-fous retenus — 96 bits d'entropie (inénumérable), clé
-- jamais exposée au serveur (un dump de la base ne donne rien de lisible),
-- révocation explicite côté enfant (revoke_watch), purge des suivis morts.
--
-- Note d'intégrité assumée : `publish_watch` et `revoke_watch` n'exigent que le
-- code, donc le parent qui suit peut techniquement écraser ou supprimer
-- l'instantané qu'il lit. On ne sépare pas la capacité d'écriture de celle de
-- lecture (ce qui demanderait un secret d'écriture supplémentaire dans le
-- publieur) : l'impact se limite à un instantané corrompu ou absent, que la
-- séance suivante de l'enfant réécrit. Aucune confidentialité en jeu.
--
-- Sécurité : RLS activée SANS policy → aucun accès direct PostgREST avec la
-- clé publishable (ni SELECT, ni INSERT : pas d'énumération, pas de dump).
-- Toute interaction passe par les fonctions SECURITY DEFINER ci-dessous.

create table if not exists public.watches (
  code       text primary key,            -- généré client, base64url ≥ 16 chars (96+ bits)
  payload    text not null,               -- profil gzip → AES-GCM → base64 (opaque)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La purge ci-dessous filtre sur updated_at à chaque dépôt. Contrairement à
-- `transfers` (vide par construction, TTL 15 min), cette table est durable et
-- grandit avec le parc installé : sans index, chaque séance de chaque appareil
-- déclencherait un seq scan.
create index if not exists watches_updated_at_idx on public.watches (updated_at);

alter table public.watches enable row level security;
-- (pas de policy : la table n'est accessible que via les RPC ci-dessous)

-- Dépose ou rafraîchit l'instantané d'un suivi. Bornes identiques à
-- create_transfer : code non devinable, payload majoré (un profil gzip+base64
-- réel pèse < 200 KB).
create or replace function public.publish_watch(p_code text, p_payload text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_code) < 16 or length(p_code) > 64 then
    raise exception 'invalid code';
  end if;
  if length(p_payload) < 1 or length(p_payload) > 1000000 then
    raise exception 'invalid payload';
  end if;
  -- Purge des suivis morts : plus aucun dépôt depuis 6 mois = app désinstallée
  -- ou profil supprimé sans passer par « Ne plus partager ». On ne conserve pas
  -- de blob orphelin indéfiniment.
  delete from public.watches where updated_at < now() - interval '180 days';
  insert into public.watches (code, payload) values (p_code, p_payload)
  on conflict (code) do update
    set payload = excluded.payload,
        updated_at = now();
end;
$$;

revoke all on function public.publish_watch(text, text) from public;
grant execute on function public.publish_watch(text, text) to anon, authenticated;

-- Relit un instantané SANS le consommer (à l'inverse de read_transfer). Renvoie
-- aussi la date du dernier dépôt, que l'espace parent affiche en fraîcheur
-- (« synchronisé il y a 2 h ») : sans elle, un appareil enfant éteint depuis
-- une semaine afficherait des stats périmées sans le dire. NULL si code inconnu.
create or replace function public.read_watch(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('payload', payload, 'updated_at', updated_at)
    from public.watches
   where code = p_code;
$$;

revoke all on function public.read_watch(text) from public;
grant execute on function public.read_watch(text) to anon, authenticated;

-- Révocation (« Ne plus partager » côté enfant) : supprime la ligne. Les
-- appareils suiveurs verront la lecture renvoyer NULL et signaleront que le
-- partage a été arrêté.
create or replace function public.revoke_watch(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.watches where code = p_code;
$$;

revoke all on function public.revoke_watch(text) from public;
grant execute on function public.revoke_watch(text) to anon, authenticated;
