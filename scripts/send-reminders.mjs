// Cron d'envoi du rappel quotidien (Web Push).
//
// Lancé toutes les heures par .github/workflows/send-reminders.yml. Lit la
// table Supabase `push_subscriptions` (service key), et pour chaque abonné dont
// c'est l'heure (18h–23h locale) envoie une notif, sauf si l'enfant a déjà
// pratiqué aujourd'hui (anti-nag) ou a déjà été notifié aujourd'hui
// (dédoublonnage, robuste au décalage des crons GitHub).
//
// La logique de décision est isolée dans `shouldSend` (fonction pure, testée
// dans scripts/send-reminders.test.mjs). web-push est importé paresseusement
// dans main() pour que les tests puissent importer ce module sans charger la lib.

import { pathToFileURL } from 'node:url';

export const REMINDER_HOUR = 18;
export const WINDOW_HOURS = 5; // fenêtre d'envoi : 18h ≤ heure locale < 23h

function localHour(tz, now) {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now),
  );
}

function localDate(tz, now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
}

/**
 * Faut-il notifier cette subscription maintenant ?
 * @param {{timezone:string,last_session_date?:string|null,last_notified_date?:string|null}} sub
 * @param {Date} now
 */
export function shouldSend(sub, now) {
  let hour, date;
  try {
    hour = localHour(sub.timezone, now);
    date = localDate(sub.timezone, now);
  } catch {
    return false; // fuseau invalide → on ignore plutôt que de crasher
  }
  if (hour < REMINDER_HOUR || hour >= REMINDER_HOUR + WINDOW_HOURS) return false;
  if (sub.last_notified_date === date) return false; // déjà notifié aujourd'hui
  if (sub.last_session_date === date) return false; // déjà pratiqué aujourd'hui
  return true;
}

async function main() {
  const {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.error('Config manquante (SUPABASE_URL, SUPABASE_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).');
    process.exit(1);
  }

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const reminderUrl = process.env.REMINDER_URL || 'https://isc.github.io/multiplix/';
  const table = `${SUPABASE_URL}/rest/v1/push_subscriptions`;
  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${table}?select=*`, { headers });
  if (!res.ok) {
    console.error('Lecture des subscriptions échouée :', res.status, await res.text().catch(() => ''));
    process.exit(1);
  }
  const subs = await res.json();
  const now = new Date();
  const due = subs.filter((s) => shouldSend(s, now));
  console.log(`${subs.length} subscription(s), ${due.length} à notifier.`);

  let sent = 0, removed = 0, failed = 0;
  // Neutre vis-à-vis de l'opération : la séance du jour peut être de la
  // multiplication ou de la division (niveau 2) selon la progression.
  const body = "C'est l'heure de ta séance Multiplix ! 🎯";
  for (const sub of due) {
    const payload = JSON.stringify({ title: 'Multiplix', body, url: reminderUrl });
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
      await fetch(`${table}?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ last_notified_date: localDate(sub.timezone, now), updated_at: now.toISOString() }),
      });
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        // Endpoint mort (désinstallation, permission révoquée) → purge.
        await fetch(`${table}?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE', headers });
        removed++;
      } else {
        failed++;
        console.warn('Envoi échoué :', code ?? err?.message);
      }
    }
  }
  console.log(`Terminé : ${sent} envoyée(s), ${removed} purgée(s), ${failed} échec(s).`);
}

// N'exécuter main() que si lancé en CLI (pas à l'import depuis les tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
