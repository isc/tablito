import { describe, it, expect } from 'vitest';
import {
  plan,
  REMINDER_HOUR,
  WINDOW_HOURS,
  WEEKLY_DAY,
  WEEKLY_CATCHUP_DAY,
  WEEKLY_MIN_DAYS,
} from './send-reminders.mjs';

// Rappels :
//  - REMINDER_HOUR=18, WINDOW_HOURS=5 → fenêtre [18h, 23h[ heure LOCALE.
//  - Paris en mai = UTC+2 → 18h Paris = 16:00Z.
//  - plan() compare last_notified_date / last_session_date à la date LOCALE.
//  - 2026-05-29 est un vendredi ; 2026-05-31 un dimanche.
const paris = (sub) => ({ timezone: 'Europe/Paris', ...sub });
// Raccourci : un abonné au seul rappel quotidien (le cas historique).
const shouldSend = (sub, now) => plan(sub, now) === 'daily';

describe('rappel quotidien', () => {
  it('expose la fenêtre attendue', () => {
    expect(REMINDER_HOUR).toBe(18);
    expect(WINDOW_HOURS).toBe(5);
  });

  it('reste envoyé quand daily_reminder est absent (lignes d’avant la colonne)', () => {
    // Le défaut SQL vaut true : une ligne écrite avant l'ajout de la colonne
    // doit continuer à recevoir son rappel, sans quoi la feature aurait
    // silencieusement désabonné tout le monde.
    expect(plan(paris({}), new Date('2026-05-29T16:00:00Z'))).toBe('daily');
  });

  it('n’envoie rien si le rappel quotidien est désactivé', () => {
    const now = new Date('2026-05-29T16:00:00Z');
    expect(plan(paris({ daily_reminder: false }), now)).toBe(null);
  });

  it('notifie à 18h locale si ni notifié ni pratiqué', () => {
    const now = new Date('2026-05-29T16:00:00Z'); // 18h Paris
    expect(shouldSend(paris({}), now)).toBe(true);
  });

  it('ne notifie pas avant la fenêtre (17h)', () => {
    const now = new Date('2026-05-29T15:00:00Z'); // 17h Paris
    expect(shouldSend(paris({}), now)).toBe(false);
  });

  it('notifie encore à 22h mais plus à 23h (borne haute exclue)', () => {
    expect(shouldSend(paris({}), new Date('2026-05-29T20:00:00Z'))).toBe(true);  // 22h
    expect(shouldSend(paris({}), new Date('2026-05-29T21:00:00Z'))).toBe(false); // 23h
  });

  it('ne notifie pas si déjà notifié aujourd\'hui (dédoublonnage)', () => {
    const now = new Date('2026-05-29T16:00:00Z');
    expect(shouldSend(paris({ last_notified_date: '2026-05-29' }), now)).toBe(false);
    // notifié hier → on notifie de nouveau
    expect(shouldSend(paris({ last_notified_date: '2026-05-28' }), now)).toBe(true);
  });

  it('ne notifie pas si une séance a eu lieu aujourd\'hui (anti-nag)', () => {
    const now = new Date('2026-05-29T16:00:00Z');
    expect(shouldSend(paris({ last_session_date: '2026-05-29' }), now)).toBe(false);
    expect(shouldSend(paris({ last_session_date: '2026-05-28' }), now)).toBe(true);
  });

  it('respecte le fuseau local de chaque abonné', () => {
    const instant = new Date('2026-05-29T22:00:00Z'); // 18h à New York (EDT), 00h à Paris
    expect(shouldSend({ timezone: 'America/New_York' }, instant)).toBe(true);
    expect(shouldSend({ timezone: 'Europe/Paris' }, instant)).toBe(false);
  });

  it('ignore un fuseau invalide sans crasher', () => {
    expect(shouldSend({ timezone: 'Not/AZone' }, new Date('2026-05-29T16:00:00Z'))).toBe(false);
  });
});

describe('recap hebdomadaire', () => {
  const dimanche18h = new Date('2026-05-31T16:00:00Z'); // dimanche 18h Paris
  const vendredi18h = new Date('2026-05-29T16:00:00Z');
  const abonne = (sub) => paris({ weekly_recap: true, daily_reminder: false, ...sub });

  it('envoie le dimanche soir', () => {
    expect(WEEKLY_DAY).toBe(0);
    expect(plan(abonne({}), dimanche18h)).toBe('weekly');
  });

  it('n’envoie pas les autres jours', () => {
    expect(plan(abonne({}), vendredi18h)).toBe(null);
  });

  it('n’envoie pas hors de la fenêtre horaire', () => {
    expect(plan(abonne({}), new Date('2026-05-31T13:00:00Z'))).toBe(null); // 15h Paris
  });

  it('n’envoie pas deux fois la même semaine', () => {
    expect(plan(abonne({ last_weekly_date: '2026-05-31' }), dimanche18h)).toBe(null);
    // Le dimanche suivant (7 jours) repasse.
    expect(plan(abonne({ last_weekly_date: '2026-05-24' }), dimanche18h)).toBe('weekly');
    expect(WEEKLY_MIN_DAYS).toBe(6);
  });

  it('rattrape le lundi soir un dimanche manqué', () => {
    // Les crons GitHub sont parfois décalés ou sautés : sans rattrapage, une
    // soirée manquée perd le recap de la semaine entière.
    expect(WEEKLY_CATCHUP_DAY).toBe(1);
    const lundi18h = new Date('2026-06-01T16:00:00Z');
    expect(plan(abonne({ last_weekly_date: '2026-05-24' }), lundi18h)).toBe('weekly');
    // Mais pas si le dimanche a bien été envoyé la veille.
    expect(plan(abonne({ last_weekly_date: '2026-05-31' }), lundi18h)).toBe(null);
  });

  it('ne rattrape pas les autres jours de la semaine', () => {
    const mardi18h = new Date('2026-06-02T16:00:00Z');
    expect(plan(abonne({ last_weekly_date: '2026-05-17' }), mardi18h)).toBe(null);
  });

  it('n’envoie rien si le recap est désactivé', () => {
    expect(plan(paris({ weekly_recap: false, daily_reminder: false }), dimanche18h)).toBe(null);
  });

  it('prime sur le rappel quotidien quand les deux tombent le même soir', () => {
    // Un appareil abonné aux deux ne doit pas recevoir deux notifications.
    const deux = paris({ weekly_recap: true, daily_reminder: true });
    expect(plan(deux, dimanche18h)).toBe('weekly');
    // Les autres soirs, le rappel reprend la main.
    expect(plan(deux, vendredi18h)).toBe('daily');
  });

  it('n’est PAS bloqué par une séance faite le jour même', () => {
    // L'anti-nag protège l'enfant d'un rappel inutile ; il n'a aucun sens pour
    // le parent, à qui on annonce justement que la progression a bougé.
    const sub = abonne({ last_session_date: '2026-05-31' });
    expect(plan(sub, dimanche18h)).toBe('weekly');
  });

  it('respecte le dédoublonnage global d’une notification par soir', () => {
    expect(plan(abonne({ last_notified_date: '2026-05-31' }), dimanche18h)).toBe(null);
  });

  it('suit le fuseau de l’abonné pour le jour de la semaine', () => {
    // 2026-06-01T01:00Z : lundi 03h à Paris, mais encore dimanche 21h à New York.
    const instant = new Date('2026-06-01T01:00:00Z');
    expect(plan({ timezone: 'America/New_York', weekly_recap: true }, instant)).toBe('weekly');
    expect(plan({ timezone: 'Europe/Paris', weekly_recap: true }, instant)).toBe(null);
  });
});
