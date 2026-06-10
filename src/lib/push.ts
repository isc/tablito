// Web Push — rappel quotidien (cf. plan « rappel quotidien à heure fixe »).
//
// Côté client, on ne fait que (dé)s'abonner et tenir à jour deux dates dans la
// table Supabase `push_subscriptions`. L'envoi réel est fait par un cron
// GitHub Actions (scripts/send-reminders.mjs), seul détenteur de la clé VAPID
// privée. La table n'est jamais lue côté client (pas de policy SELECT anon) :
// l'endpoint d'une subscription est une URL opaque non devinable, qui sert de
// clé pour update/delete sa propre ligne.
//
// Même conventions réseau que src/lib/feedback.ts (PostgREST + publishable key).

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Push activable seulement si la conf complète est présente (URL + clés).
export const pushConfigured = Boolean(url && publishableKey && vapidPublicKey);

const TABLE = `${url}/rest/v1/push_subscriptions`;
const baseHeaders = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  'Content-Type': 'application/json',
};

/** Le navigateur supporte-t-il le Web Push ? (faux sur iOS Safari non installé). */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Date du jour dans le fuseau local de l'appareil, format 'YYYY-MM-DD'.
// On NE réutilise PAS todayISO() (qui est en UTC) : l'anti-nag se compare à la
// date locale calculée par le serveur dans le fuseau stocké, et l'appareil
// partage ce fuseau — donc on reste dans le même référentiel.
function localToday(): string {
  return new Date().toLocaleDateString('en-CA'); // en-CA → YYYY-MM-DD
}

// Convertit une chaîne base64url en Uint8Array. Utilisé pour la clé VAPID
// publique (`applicationServerKey`) et pour décoder le profil transmis par le
// redirecteur lors de la migration cross-origin (cf. storage.importProfileFromUrl).
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function serialize(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string } {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint ?? '',
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  };
}

async function activeSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * État courant de l'abonnement, pour réconcilier le toggle à l'ouverture de
 * l'espace parent (gère la permission révoquée hors de l'app).
 */
export async function isSubscribed(): Promise<boolean> {
  if (!pushConfigured || !pushSupported() || Notification.permission !== 'granted') return false;
  return (await activeSubscription()) !== null;
}

export type SubscribeResult = 'subscribed' | 'denied' | 'unsupported' | 'error';

/**
 * Active le rappel quotidien : demande la permission, crée la subscription
 * push, et upsert la ligne Supabase (clé = endpoint).
 */
export async function subscribeToReminders(): Promise<SubscribeResult> {
  if (!pushConfigured || !pushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const { endpoint, p256dh, auth } = serialize(sub);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Upsert via un RPC SECURITY DEFINER, pas un INSERT/PATCH PostgREST direct :
    // sous RLS, un ON CONFLICT DO UPDATE (comme un PATCH filtré par endpoint)
    // doit lire la ligne ciblée, donc les policies SELECT s'appliquent — or on en
    // refuse une exprès (l'endpoint opaque sert de secret, personne ne doit pouvoir
    // énumérer les abonnés). La fonction bypasse RLS et ne retourne rien : on peut
    // upsert SA ligne sans rendre la table lisible. Le ON CONFLICT préserve
    // last_session_date / last_notified_date (la fonction ne les touche pas).
    const res = await fetch(`${url}/rest/v1/rpc/upsert_push_subscription`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_timezone: timezone,
      }),
    });
    if (!res.ok) {
      // L'enregistrement serveur a échoué : retirer la subscription locale pour
      // ne pas laisser un abonnement que le cron ignore.
      await sub.unsubscribe().catch(() => {});
      return 'error';
    }
    return 'subscribed';
  } catch {
    return 'error';
  }
}

/** Désactive le rappel : supprime la ligne serveur puis la subscription locale. */
export async function unsubscribeFromReminders(): Promise<void> {
  const sub = await activeSubscription();
  if (!sub) return;
  const { endpoint } = serialize(sub);
  try {
    await fetch(`${TABLE}?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
    });
  } catch {
    // best-effort : le cron purgera de toute façon les endpoints morts (410).
  }
  await sub.unsubscribe().catch(() => {});
}

/**
 * Marque qu'une séance a eu lieu aujourd'hui (anti-nag : le cron saute l'envoi
 * si une séance a eu lieu le jour même). Best-effort, jamais bloquant.
 */
export async function syncLastSession(): Promise<void> {
  if (!pushConfigured || !pushSupported() || Notification.permission !== 'granted') return;
  try {
    const sub = await activeSubscription();
    if (!sub) return;
    const { endpoint } = serialize(sub);
    // On passe par un RPC SECURITY DEFINER (pas un PATCH direct) : sous RLS, un
    // UPDATE filtré par `WHERE endpoint = …` lit la table, donc les policies
    // SELECT s'appliquent — or on en refuse exprès une (anti-énumération). Sans
    // ligne « visible », l'UPDATE matche 0 ligne tout en renvoyant 204, et
    // last_session_date n'était jamais écrit (anti-nag cassé). La fonction
    // bypasse RLS et ne retourne rien, donc l'anti-énumération reste intacte.
    await fetch(`${url}/rest/v1/rpc/mark_reminder_session`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ p_endpoint: endpoint, p_session_date: localToday() }),
    });
  } catch {
    // best-effort
  }
}
