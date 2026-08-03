// Cron d'envoi des notifications Web Push.
//
// Lancé toutes les heures par .github/workflows/send-reminders.yml. Lit la
// table Supabase `push_subscriptions` (service key) et, pour chaque abonné dont
// c'est l'heure (18h–23h locale), décide quoi envoyer parmi DEUX notifications :
//
//  - RAPPEL QUOTIDIEN (`daily_reminder`) : sur l'appareil de l'enfant, sauf s'il
//    a déjà pratiqué aujourd'hui (anti-nag) ou déjà été notifié aujourd'hui
//    (dédoublonnage, robuste au décalage des crons GitHub).
//  - RECAP HEBDOMADAIRE (`weekly_recap`) : sur l'appareil du parent qui suit un
//    enfant à distance, le dimanche soir, au plus une fois par semaine.
//
// Le recap PRIME sur le rappel quand les deux tombent le même soir : un appareil
// ne reçoit jamais deux notifications dans la même soirée, et le recap est le
// plus informatif des deux. En pratique le cas est rare (les deux drapeaux
// visent des appareils différents), mais rien ne l'interdit.
//
// Le corps du recap est GÉNÉRIQUE : l'instantané suivi est chiffré de bout en
// bout, donc le serveur ne connaît ni le prénom de l'enfant ni ses chiffres. La
// notification annonce qu'un recap est prêt ; c'est l'app qui déchiffre.
//
// La logique de décision est isolée dans `plan` (fonction pure, testée dans
// scripts/send-reminders.test.mjs). web-push est importé paresseusement dans
// main() pour que les tests puissent importer ce module sans charger la lib.

import { pathToFileURL } from 'node:url';

export const REMINDER_HOUR = 18;
export const WINDOW_HOURS = 5; // fenêtre d'envoi : 18h ≤ heure locale < 23h
// Dimanche soir : la semaine vient de se terminer, et c'est le moment où un
// parent peut encore réagir avant la semaine d'école qui commence.
export const WEEKLY_DAY = 0; // 0 = dimanche
// Rattrapage : les workflows planifiés GitHub sont régulièrement décalés et
// parfois sautés sous charge. Sans filet, une soirée de dimanche manquée perd le
// recap de la semaine (le rappel quotidien, lui, revient le lendemain). On
// autorise donc un envoi le lundi soir s'il n'y en a pas eu depuis une semaine.
export const WEEKLY_CATCHUP_DAY = 1; // lundi
// Garde-fou de dédoublonnage : jamais deux recaps à moins de 6 jours. Comparer
// des dates plutôt que calculer un numéro de semaine ISO évite les cas tordus de
// bascule d'année.
export const WEEKLY_MIN_DAYS = 6;

function localHour(tz, now) {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now),
  );
}

function localDate(tz, now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
}

// Jour de la semaine (0 = dimanche) d'une date locale 'YYYY-MM-DD'. Dérivé de la
// date déjà calculée dans le bon fuseau, plutôt que d'un second Intl : une table
// de noms anglais et un indexOf renverraient -1 en silence si la sortie changeait.
function weekdayOf(dateISO) {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

// Écart en jours pleins entre deux dates 'YYYY-MM-DD' (UTC des deux côtés, donc
// pas de dérive de fuseau : on ne compare que des calendriers).
function daysBetween(fromISO, toISO) {
  const ms = Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`);
  return Number.isNaN(ms) ? Infinity : Math.round(ms / 86400000);
}

/**
 * Que faut-il envoyer à cette subscription maintenant ?
 * @param {{timezone:string,daily_reminder?:boolean,weekly_recap?:boolean,
 *          last_session_date?:string|null,last_notified_date?:string|null,
 *          last_weekly_date?:string|null}} sub
 * @param {Date} now
 * @returns {'weekly'|'daily'|null}
 */
export function plan(sub, now) {
  let hour, date;
  try {
    hour = localHour(sub.timezone, now);
    date = localDate(sub.timezone, now);
  } catch {
    return null; // fuseau invalide → on ignore plutôt que de crasher
  }
  if (hour < REMINDER_HOUR || hour >= REMINDER_HOUR + WINDOW_HOURS) return null;
  if (sub.last_notified_date === date) return null; // déjà notifié aujourd'hui

  // Le recap d'abord : plus informatif, et il ne concurrence le rappel qu'un
  // soir sur sept.
  const weekday = weekdayOf(date);
  const sinceLastWeekly = sub.last_weekly_date
    ? daysBetween(sub.last_weekly_date, date)
    : Infinity;
  const weeklyDue =
    weekday === WEEKLY_DAY
      ? sinceLastWeekly >= WEEKLY_MIN_DAYS
      // Lundi : uniquement en rattrapage d'un dimanche manqué (cron sauté).
      : weekday === WEEKLY_CATCHUP_DAY && sinceLastWeekly >= 7;
  if (sub.weekly_recap && weeklyDue) return 'weekly';

  // Rétrocompat : une ligne écrite avant la colonne `daily_reminder` n'a pas le
  // champ dans un test qui l'omet — l'absence vaut « abonné au rappel », ce que
  // le défaut SQL (true) garantit aussi côté base.
  if (sub.daily_reminder === false) return null;
  if (sub.last_session_date === date) return null; // déjà pratiqué aujourd'hui
  return 'daily';
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

  const reminderUrl = process.env.REMINDER_URL || 'https://tablito.app/';
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
  const due = subs.map((s) => ({ sub: s, kind: plan(s, now) })).filter((d) => d.kind);
  const weekly = due.filter((d) => d.kind === 'weekly').length;
  console.log(`${subs.length} subscription(s), ${due.length} à notifier (dont ${weekly} recap).`);

  let sent = 0, removed = 0, failed = 0;
  // Rappel quotidien — neutre vis-à-vis de l'opération : la séance du jour peut
  // être de la multiplication, de la division ou de la division avec reste.
  const dailyBody = "C'est l'heure de ta séance Tablito ! 🎯";
  // Recap hebdomadaire — aucune donnée : le serveur ne peut pas lire la
  // progression suivie (chiffrée de bout en bout), et n'a donc ni prénom ni
  // chiffre à mettre ici. Le contenu, c'est l'app qui l'affiche après
  // déchiffrement local.
  const weeklyBody = 'Le recap de la semaine est prêt 📊';
  for (const { sub, kind } of due) {
    const isWeekly = kind === 'weekly';
    const payload = JSON.stringify({
      title: 'Tablito',
      body: isWeekly ? weeklyBody : dailyBody,
      // Le recap ouvre directement l'espace parent, sur le suivi à distance.
      url: isWeekly ? `${reminderUrl}#recap` : reminderUrl,
      tag: isWeekly ? 'weekly-recap' : 'daily-reminder',
    });
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
      const today = localDate(sub.timezone, now);
      await fetch(`${table}?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          last_notified_date: today,
          ...(isWeekly ? { last_weekly_date: today } : {}),
          updated_at: now.toISOString(),
        }),
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
