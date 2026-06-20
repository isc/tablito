-- Notification email à chaque nouveau feedback (push, plus de polling manuel).
--
-- ⚠ Ce projet n'a PAS de système de migrations : la DDL est appliquée à la main
-- sur l'instance Supabase (comme `feedback` et `push_subscriptions`). Ce fichier
-- documente l'état canonique — il n'est exécuté par aucun build.
--
-- Mécanisme : trigger AFTER INSERT sur public.feedback → appel HTTP *asynchrone*
-- (pg_net, ne bloque pas l'INSERT du parent) vers l'API Resend → email dans la
-- boîte de l'admin. Zéro Edge Function, zéro CLI : tout vit dans Postgres.
--
-- Pré-requis (une seule fois, hors repo) :
--   1. Compte Resend (gratuit) + clé API.
--   2. Stocker la clé dans Vault (jamais en clair ici) :
--        select vault.create_secret('re_xxxxx', 'resend_api_key');
--      (rotation : select vault.update_secret(
--         (select id from vault.secrets where name='resend_api_key'), 're_yyyyy');)
--   3. Pour envoyer depuis feedback@tablito.app : vérifier le domaine tablito.app
--      dans Resend (DNS). Tant que non vérifié, utiliser 'onboarding@resend.dev'
--      comme `from` (n'envoie qu'à l'email du compte Resend) — voir FROM_ADDR.
--
-- Application manuelle :
--   psql "$SUPABASE_DB_URL" -f supabase/feedback_notify.sql
-- (idempotent : create extension if not exists + create or replace + drop trigger)
--
-- Débogage des envois (pg_net journalise les réponses) :
--   select status_code, content from net._http_response order by created desc limit 5;

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  api_key   text;
  from_addr text := 'Tablito <onboarding@resend.dev>';  -- mode test ; passer à 'feedback@tablito.app' une fois le domaine vérifié dans Resend
  to_addr   text := 'ivan.schneider@hey.com';
  excerpt   text;
begin
  select decrypted_secret into api_key
    from vault.decrypted_secrets
   where name = 'resend_api_key';

  if api_key is null then
    raise warning 'notify_new_feedback: secret "resend_api_key" absent du Vault — email non envoyé';
    return new;
  end if;

  -- Échappement HTML minimal (le message est saisi par le parent) puis sauts de ligne.
  excerpt := left(new.message, 4000);
  excerpt := replace(excerpt, '&', '&amp;');
  excerpt := replace(excerpt, '<', '&lt;');
  excerpt := replace(excerpt, '>', '&gt;');
  excerpt := replace(excerpt, E'\n', '<br>');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', from_addr,
      'to', jsonb_build_array(to_addr),
      'reply_to', coalesce(nullif(new.email, ''), to_addr),  -- répondre = répondre au parent
      'subject', 'Nouveau feedback Tablito',
      'html', format(
        '<p><strong>Nouveau feedback</strong></p>'
        '<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#333">%s</blockquote>'
        '<p style="color:#666">— %s</p>'
        '<p style="color:#999;font-size:13px">id <code>%s</code> · à traiter : '
        '<code>npm run feedback:treat -- %s</code></p>',
        excerpt,
        coalesce(nullif(new.email, ''), 'anonyme'),
        new.id,
        left(new.id::text, 8)
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists feedback_notify on public.feedback;
create trigger feedback_notify
  after insert on public.feedback
  for each row execute function public.notify_new_feedback();
