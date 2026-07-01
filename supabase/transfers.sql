-- Schéma de référence de la table `transfers` (transfert de profil entre
-- appareils par QR code / lien éphémère).
--
-- ⚠ Ce projet n'a PAS de système de migrations : la DDL est appliquée à la main
-- sur l'instance Supabase (comme `feedback` et `push_subscriptions`). Ce fichier
-- documente l'état canonique pour la reproductibilité.
--
-- Application manuelle :
--   psql "$SUPABASE_DB_URL" -f supabase/transfers.sql
-- (idempotent : create table if not exists + create or replace function)
--
-- Fonctionnement (cf. src/lib/transfer.ts) :
--   - L'ancien appareil chiffre le profil CÔTÉ CLIENT (AES-GCM, clé aléatoire)
--     et dépose le blob sous un code haute entropie. Le serveur ne voit jamais
--     ni la clé ni le contenu en clair.
--   - Le nouvel appareil scanne un QR contenant `#transfer=<code>.<clé>` :
--     le code sert à récupérer le blob, la clé (restée dans le fragment d'URL,
--     jamais envoyée au serveur) à le déchiffrer.
--   - Lecture UNIQUE : read_transfer supprime la ligne en la lisant.
--   - TTL 15 minutes, purge opportuniste des lignes expirées à chaque dépôt.
--
-- Sécurité : RLS activée SANS policy → aucun accès direct PostgREST avec la
-- clé publishable (ni SELECT, ni INSERT : pas d'énumération, pas de dump).
-- Toute interaction passe par les deux fonctions SECURITY DEFINER ci-dessous,
-- qui ne permettent que « déposer un blob borné » et « consommer un blob dont
-- on connaît le code ».

create table if not exists public.transfers (
  code       text primary key,            -- généré client, base64url ≥ 16 chars (96+ bits)
  payload    text not null,               -- profil gzip → AES-GCM → base64 (opaque)
  created_at timestamptz not null default now()
);

alter table public.transfers enable row level security;
-- (pas de policy : la table n'est accessible que via les RPC ci-dessous)

-- Dépose un transfert. Borne le code (anti-collision triviale : un code court
-- devinable permettrait de voler un blob — chiffré, mais autant refuser) et le
-- payload (anti-abus de stockage : un profil gzip+base64 réel pèse < 200 KB).
create or replace function public.create_transfer(p_code text, p_payload text)
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
  -- Purge opportuniste : les transferts jamais consommés ne s'accumulent pas.
  delete from public.transfers where created_at < now() - interval '1 hour';
  insert into public.transfers (code, payload) values (p_code, p_payload);
end;
$$;

revoke all on function public.create_transfer(text, text) from public;
grant execute on function public.create_transfer(text, text) to anon, authenticated;

-- Consomme un transfert : renvoie le payload ET supprime la ligne (lecture
-- unique — un lien interceptés après coup ne donne plus rien), dans la
-- fenêtre de validité de 15 minutes. NULL si code inconnu ou expiré.
create or replace function public.read_transfer(p_code text)
returns text
language sql
security definer
set search_path = public
as $$
  delete from public.transfers
   where code = p_code
     and created_at > now() - interval '15 minutes'
  returning payload;
$$;

revoke all on function public.read_transfer(text) from public;
grant execute on function public.read_transfer(text) to anon, authenticated;
