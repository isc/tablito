// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseFrenchNumber, parseFrenchAnswer } from '../lib/parseFrenchNumber';

describe('parseFrenchNumber', () => {
  it('parses pure digit strings', () => {
    expect(parseFrenchNumber('0')).toBe(0);
    expect(parseFrenchNumber('7')).toBe(7);
    expect(parseFrenchNumber('42')).toBe(42);
    expect(parseFrenchNumber('100')).toBe(100);
  });

  it('parses units in French', () => {
    expect(parseFrenchNumber('zéro')).toBe(0);
    expect(parseFrenchNumber('un')).toBe(1);
    expect(parseFrenchNumber('une')).toBe(1);
    expect(parseFrenchNumber('deux')).toBe(2);
    expect(parseFrenchNumber('neuf')).toBe(9);
  });

  it('parses teens', () => {
    expect(parseFrenchNumber('dix')).toBe(10);
    expect(parseFrenchNumber('onze')).toBe(11);
    expect(parseFrenchNumber('seize')).toBe(16);
    expect(parseFrenchNumber('dix-sept')).toBe(17);
    expect(parseFrenchNumber('dix-neuf')).toBe(19);
  });

  it('parses compound tens 20..69', () => {
    expect(parseFrenchNumber('vingt')).toBe(20);
    expect(parseFrenchNumber('vingt et un')).toBe(21);
    expect(parseFrenchNumber('vingt-et-un')).toBe(21);
    expect(parseFrenchNumber('vingt-quatre')).toBe(24);
    expect(parseFrenchNumber('trente-six')).toBe(36);
    expect(parseFrenchNumber('quarante-huit')).toBe(48);
    expect(parseFrenchNumber('cinquante-six')).toBe(56);
    expect(parseFrenchNumber('soixante-trois')).toBe(63);
  });

  it('parses 70..79', () => {
    expect(parseFrenchNumber('soixante-dix')).toBe(70);
    expect(parseFrenchNumber('soixante et onze')).toBe(71);
    expect(parseFrenchNumber('soixante-douze')).toBe(72);
    expect(parseFrenchNumber('soixante-dix-sept')).toBe(77);
  });

  it('parses 80..99', () => {
    expect(parseFrenchNumber('quatre-vingts')).toBe(80);
    expect(parseFrenchNumber('quatre-vingt')).toBe(80);
    expect(parseFrenchNumber('quatre-vingt-un')).toBe(81);
    expect(parseFrenchNumber('quatre-vingt-quatre')).toBe(84);
    expect(parseFrenchNumber('quatre-vingt-dix')).toBe(90);
    expect(parseFrenchNumber('quatre-vingt-onze')).toBe(91);
  });

  it('is case insensitive and ignores punctuation', () => {
    expect(parseFrenchNumber('VINGT-QUATRE')).toBe(24);
    expect(parseFrenchNumber('  vingt-quatre!  ')).toBe(24);
    expect(parseFrenchNumber('vingt  quatre')).toBe(24);
  });

  it('rejects digit-by-digit sequences to avoid TTS echo false positives', () => {
    // Nobody says "deux trois" to mean 23 — they say "vingt-trois".
    // Parsing it would submit echo from the question "2 × 3" as answer 23.
    expect(parseFrenchNumber('deux trois')).toBeNull();
    expect(parseFrenchNumber('deux quatre')).toBeNull();
    expect(parseFrenchNumber('2 4')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseFrenchNumber('bonjour')).toBeNull();
    expect(parseFrenchNumber('')).toBeNull();
    expect(parseFrenchNumber('   ')).toBeNull();
    expect(parseFrenchNumber('cinq fois deux')).toBeNull();
  });

  it('covers every integer 0..100 (canonical form)', () => {
    // Smoke test for coverage of our phrase generator.
    const expected: Record<number, string> = {
      0: 'zéro',
      1: 'un',
      5: 'cinq',
      10: 'dix',
      15: 'quinze',
      17: 'dix-sept',
      20: 'vingt',
      21: 'vingt et un',
      35: 'trente-cinq',
      42: 'quarante-deux',
      56: 'cinquante-six',
      63: 'soixante-trois',
      70: 'soixante-dix',
      71: 'soixante et onze',
      72: 'soixante-douze',
      80: 'quatre-vingts',
      81: 'quatre-vingt-un',
      90: 'quatre-vingt-dix',
      99: 'quatre-vingt-dix-neuf',
      100: 'cent',
    };
    for (const [n, phrase] of Object.entries(expected)) {
      expect(parseFrenchNumber(phrase), phrase).toBe(parseInt(n, 10));
    }
  });
});

describe('parseFrenchAnswer', () => {
  it('accepte les filler words en préfixe ("euh", "prendre", etc.)', () => {
    expect(parseFrenchAnswer('euh trente-deux')).toBe(32);
    expect(parseFrenchAnswer('prendre trente')).toBe(30);
    expect(parseFrenchAnswer('ah, trente-deux')).toBe(32);
    expect(parseFrenchAnswer('euh 30')).toBe(30);
  });

  it('rejette le single-token fallback si un mot-nombre précède (compound cassé)', () => {
    // "quatre vingts un" (pluriel fautif) ne doit pas se replier sur "un" = 1.
    expect(parseFrenchAnswer('quatre vingts un')).toBeNull();
    // "cent un" non mappé : ne doit pas se replier sur "un" = 1.
    expect(parseFrenchAnswer('cent un')).toBeNull();
  });

  it('accepte les nombres simples et compounds reconnus', () => {
    expect(parseFrenchAnswer('72')).toBe(72);
    expect(parseFrenchAnswer('81')).toBe(81);
    expect(parseFrenchAnswer('quatre-vingt-un')).toBe(81);
    expect(parseFrenchAnswer('soixante-douze')).toBe(72);
    expect(parseFrenchAnswer('zéro')).toBe(0);
  });

  it('extrait la réponse après un marqueur d\'égalité (équation parlée)', () => {
    // L'enfant répète la question avec sa réponse — fréquent à voix haute.
    expect(parseFrenchAnswer('6 fois 5 égale 30')).toBe(30);
    expect(parseFrenchAnswer('six fois cinq égale trente')).toBe(30);
    expect(parseFrenchAnswer('6 fois 5 égal 30')).toBe(30);
    expect(parseFrenchAnswer('8 fois 7 égale 56')).toBe(56);
    expect(parseFrenchAnswer('6 fois 5 c\'est 30')).toBe(30);
    expect(parseFrenchAnswer('ça fait 30')).toBe(30);
    expect(parseFrenchAnswer('ça donne quarante-deux')).toBe(42);
    expect(parseFrenchAnswer('ils font 42')).toBe(42);
    // Si plusieurs marqueurs, on prend après le dernier.
    expect(parseFrenchAnswer('6 fois 5 égale 30 ça fait 30')).toBe(30);
  });

  it('rejette un écho TTS pur (pas de marqueur d\'égalité)', () => {
    // L'écho de la question seule ne doit pas être interprété comme réponse.
    expect(parseFrenchAnswer('6 fois 5')).toBeNull();
    expect(parseFrenchAnswer('six fois cinq')).toBeNull();
    // Marqueur sans nombre derrière → rien à soumettre.
    expect(parseFrenchAnswer('6 fois 5 égale')).toBeNull();
    expect(parseFrenchAnswer('ça fait')).toBeNull();
  });
});
