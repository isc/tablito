// Web Push — deux notifications distinctes portées par la MÊME subscription :
//  - le RAPPEL QUOTIDIEN de séance, sur l'appareil de l'enfant ;
//  - le RECAP HEBDOMADAIRE du suivi à distance, sur l'appareil du parent, qui
//    l'avertit que la progression de l'enfant qu'il suit a bougé.
// Vouloir l'un sans l'autre est le cas normal (le parent n'a pas de séance à
// faire), d'où deux préférences indépendantes plutôt qu'un unique « abonné ».
//
// Côté client, on tient à jour SA ligne de la table Supabase
// `push_subscriptions` : les deux préférences et les dates de dédoublonnage.
// L'envoi réel est fait par un cron GitHub Actions
// (scripts/send-reminders.mjs), seul détenteur de la clé VAPID privée.
//
// La table n'a aucune policy (ni SELECT ni écriture) : l'endpoint d'une
// subscription est une URL opaque non devinable, qui sert de clé ET
// d'autorisation, via des fonctions SECURITY DEFINER. Un client peut donc lire
// et écrire SA ligne sans que la table soit énumérable.
//
// Même conventions réseau que src/lib/feedback.ts (PostgREST + publishable key).

import { urlBase64ToUint8Array } from './codec';
import { supabaseEnv, supabaseHeaders } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Push activable seulement si la conf complète est présente (URL + clés).
export const pushConfigured = Boolean(supabaseEnv() && vapidPublicKey);

const TABLE = `${url}/rest/v1/push_subscriptions`;
const baseHeaders = supabaseHeaders(publishableKey);

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

export type PushPrefResult = 'ok' | 'denied' | 'unsupported' | 'error';

/** Les deux notifications, indépendantes. Tout à false = aucun abonnement. */
export interface PushPrefs {
  daily: boolean;
  weekly: boolean;
}

const NO_PUSH: PushPrefs = { daily: false, weekly: false };

// Miroir local du dernier état connu. L'affichage des toggles ne doit pas
// dépendre du réseau : une PWA s'ouvre souvent hors-ligne, et afficher OFF
// pendant que les notifications arrivent bel et bien est un mensonge — pire, il
// rend le toggle inopérant pour DÉSACTIVER (il ne proposerait qu'« activer »).
const MIRROR_KEY = 'multiplix-push-prefs';

function readMirror(): PushPrefs | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PushPrefs;
    return { daily: !!parsed?.daily, weekly: !!parsed?.weekly };
  } catch {
    return null;
  }
}

function writeMirror(prefs: PushPrefs | null): void {
  try {
    if (prefs) localStorage.setItem(MIRROR_KEY, JSON.stringify(prefs));
    else localStorage.removeItem(MIRROR_KEY);
  } catch {
    // ignore (navigation privée stricte)
  }
}

/**
 * Préférences de cet appareil. La permission révoquée hors de l'app fait foi
 * (aucune notification n'arrivera), donc elle l'emporte. Sinon on interroge le
 * serveur, et on retombe sur le dernier état connu localement si la lecture
 * échoue — surtout ne pas répondre « rien d'activé » pour cause de hors-ligne.
 */
export async function getPushPrefs(): Promise<PushPrefs> {
  if (!pushConfigured || !pushSupported() || Notification.permission !== 'granted') return NO_PUSH;
  try {
    const sub = await activeSubscription();
    if (!sub) return NO_PUSH; // pas de canal : rien ne peut arriver, c'est certain
    // La table n'a aucune policy SELECT (anti-énumération) : on passe donc par un
    // RPC SECURITY DEFINER, à qui l'endpoint opaque sert d'autorisation.
    const res = await fetch(`${url}/rest/v1/rpc/read_push_prefs`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ p_endpoint: serialize(sub).endpoint }),
    });
    if (!res.ok) return readMirror() ?? NO_PUSH;
    const row = (await res.json()) as PushPrefs | null;
    const prefs = row ? { daily: !!row.daily, weekly: !!row.weekly } : NO_PUSH;
    writeMirror(prefs);
    return prefs;
  } catch {
    return readMirror() ?? NO_PUSH;
  }
}

/**
 * Active ou désactive UNE des deux notifications, sans toucher à l'autre : la
 * mise à jour est partielle côté SQL (paramètre NULL = drapeau inchangé), parce
 * que les deux toggles vivent dans deux endroits distincts de l'espace parent et
 * qu'un read-modify-write côté client les ferait s'écraser mutuellement.
 *
 * Désactiver la dernière notification active supprime tout l'abonnement : garder
 * une subscription que le cron ignore n'aurait aucun sens. C'est le RPC qui
 * renvoie l'état résultant, donc cette décision découle d'une valeur lue et
 * jamais d'une supposition.
 */
export async function setPushPref(
  key: keyof PushPrefs,
  value: boolean,
): Promise<PushPrefResult> {
  if (!pushConfigured || !pushSupported()) return 'unsupported';

  let sub = await activeSubscription();
  const created = sub === null;
  if (!value && !sub) return 'ok'; // rien à désactiver

  // La permission se demande dès qu'elle n'est pas accordée, et pas seulement
  // quand la subscription manque : un utilisateur peut l'avoir révoquée dans les
  // réglages du site sans que le navigateur ne détruise la PushSubscription — on
  // afficherait alors « Activé » pour des notifications qui n'arriveront jamais.
  if (Notification.permission !== 'granted') {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  }

  try {
    if (!sub) {
      const reg = await navigator.serviceWorker.ready;
      sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
    }

    const { endpoint, p256dh, auth } = serialize(sub);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Upsert via un RPC SECURITY DEFINER, pas un INSERT/PATCH PostgREST direct :
    // sous RLS, un ON CONFLICT DO UPDATE (comme un PATCH filtré par endpoint)
    // doit lire la ligne ciblée, donc les policies SELECT s'appliquent — or on en
    // refuse une exprès (l'endpoint opaque sert de secret, personne ne doit pouvoir
    // énumérer les abonnés). La fonction bypasse RLS. Le ON CONFLICT préserve
    // last_session_date / last_notified_date (la fonction ne les touche pas).
    const res = await fetch(`${url}/rest/v1/rpc/upsert_push_prefs`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_timezone: timezone,
        p_daily: key === 'daily' ? value : null,
        p_weekly: key === 'weekly' ? value : null,
      }),
    });
    if (!res.ok) {
      // Ne retirer la subscription que si on vient de la CRÉER : sinon on
      // détruirait un abonnement préexistant (et l'autre notification avec) à
      // cause d'un échec sur celle-ci.
      if (created) await sub.unsubscribe().catch(() => {});
      return 'error';
    }

    const prefs = (await res.json()) as PushPrefs;
    // Plus rien d'actif : on retire l'abonnement au lieu de garder une ligne
    // muette (et la permission cesse d'être « utilisée » côté navigateur).
    if (!prefs.daily && !prefs.weekly) {
      await unsubscribeFromReminders();
      return 'ok';
    }
    writeMirror(prefs);
    return 'ok';
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
  writeMirror(null);
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
