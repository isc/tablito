import { describe, it, expect } from 'vitest';
import { shouldSend, REMINDER_HOUR, WINDOW_HOURS } from './send-reminders.mjs';

// Rappels :
//  - REMINDER_HOUR=18, WINDOW_HOURS=5 → fenêtre [18h, 23h[ heure LOCALE.
//  - Paris en mai = UTC+2 → 18h Paris = 16:00Z.
//  - shouldSend compare last_notified_date / last_session_date à la date LOCALE.
const paris = (sub) => ({ timezone: 'Europe/Paris', ...sub });

describe('shouldSend', () => {
  it('expose la fenêtre attendue', () => {
    expect(REMINDER_HOUR).toBe(18);
    expect(WINDOW_HOURS).toBe(5);
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
