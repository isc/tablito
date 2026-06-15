// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseEnglishNumber, parseEnglishAnswer } from '../lib/parseEnglishNumber';

describe('parseEnglishNumber', () => {
  it('parses pure digit strings', () => {
    expect(parseEnglishNumber('0')).toBe(0);
    expect(parseEnglishNumber('7')).toBe(7);
    expect(parseEnglishNumber('42')).toBe(42);
    expect(parseEnglishNumber('100')).toBe(100);
  });

  it('parses units', () => {
    expect(parseEnglishNumber('zero')).toBe(0);
    expect(parseEnglishNumber('one')).toBe(1);
    expect(parseEnglishNumber('two')).toBe(2);
    expect(parseEnglishNumber('nine')).toBe(9);
  });

  it('parses teens', () => {
    expect(parseEnglishNumber('ten')).toBe(10);
    expect(parseEnglishNumber('eleven')).toBe(11);
    expect(parseEnglishNumber('sixteen')).toBe(16);
    expect(parseEnglishNumber('seventeen')).toBe(17);
    expect(parseEnglishNumber('nineteen')).toBe(19);
  });

  it('parses compound tens 20..99', () => {
    expect(parseEnglishNumber('twenty')).toBe(20);
    expect(parseEnglishNumber('twenty-one')).toBe(21);
    expect(parseEnglishNumber('twenty one')).toBe(21);
    expect(parseEnglishNumber('twenty-four')).toBe(24);
    expect(parseEnglishNumber('thirty-six')).toBe(36);
    expect(parseEnglishNumber('forty-eight')).toBe(48);
    expect(parseEnglishNumber('fifty-six')).toBe(56);
    expect(parseEnglishNumber('sixty-three')).toBe(63);
    expect(parseEnglishNumber('seventy-two')).toBe(72);
    expect(parseEnglishNumber('eighty-one')).toBe(81);
    expect(parseEnglishNumber('ninety-nine')).toBe(99);
  });

  it('parses one hundred (with optional "and")', () => {
    expect(parseEnglishNumber('hundred')).toBe(100);
    expect(parseEnglishNumber('a hundred')).toBe(100);
    expect(parseEnglishNumber('one hundred')).toBe(100);
  });

  it('is case insensitive and ignores punctuation', () => {
    expect(parseEnglishNumber('TWENTY-FOUR')).toBe(24);
    expect(parseEnglishNumber('  twenty-four!  ')).toBe(24);
    expect(parseEnglishNumber('twenty  four')).toBe(24);
  });

  it('rejects digit-by-digit sequences to avoid TTS echo false positives', () => {
    // Nobody says "two three" to mean 23 — they say "twenty-three".
    expect(parseEnglishNumber('two three')).toBeNull();
    expect(parseEnglishNumber('two four')).toBeNull();
    expect(parseEnglishNumber('2 4')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseEnglishNumber('hello')).toBeNull();
    expect(parseEnglishNumber('')).toBeNull();
    expect(parseEnglishNumber('   ')).toBeNull();
    expect(parseEnglishNumber('five times two')).toBeNull();
  });

  it('covers a representative set of integers 0..100', () => {
    const expected: Record<number, string> = {
      0: 'zero',
      1: 'one',
      5: 'five',
      10: 'ten',
      15: 'fifteen',
      17: 'seventeen',
      20: 'twenty',
      21: 'twenty-one',
      35: 'thirty-five',
      42: 'forty-two',
      56: 'fifty-six',
      63: 'sixty-three',
      70: 'seventy',
      72: 'seventy-two',
      80: 'eighty',
      81: 'eighty-one',
      90: 'ninety',
      99: 'ninety-nine',
      100: 'one hundred',
    };
    for (const [n, phrase] of Object.entries(expected)) {
      expect(parseEnglishNumber(phrase), phrase).toBe(parseInt(n, 10));
    }
  });
});

describe('parseEnglishAnswer', () => {
  it('accepts filler words in the prefix ("um", "uh", etc.)', () => {
    expect(parseEnglishAnswer('um thirty-two')).toBe(32);
    expect(parseEnglishAnswer('take thirty')).toBe(30);
    expect(parseEnglishAnswer('uh, thirty-two')).toBe(32);
    expect(parseEnglishAnswer('um 30')).toBe(30);
  });

  it('rejects the single-token fallback when a number word precedes (broken compound)', () => {
    // "eighty one" without compounding shouldn't fall back to "one" = 1 if it
    // were broken; "one hundred one" is out of the mapped range.
    expect(parseEnglishAnswer('one hundred one')).toBeNull();
  });

  it('accepts recognized simple numbers and compounds', () => {
    expect(parseEnglishAnswer('72')).toBe(72);
    expect(parseEnglishAnswer('81')).toBe(81);
    expect(parseEnglishAnswer('eighty-one')).toBe(81);
    expect(parseEnglishAnswer('seventy-two')).toBe(72);
    expect(parseEnglishAnswer('zero')).toBe(0);
  });

  it('extracts the answer after an equality marker (spoken equation)', () => {
    expect(parseEnglishAnswer('6 times 5 equals 30')).toBe(30);
    expect(parseEnglishAnswer('six times five equals thirty')).toBe(30);
    expect(parseEnglishAnswer('8 times 7 equals 56')).toBe(56);
    expect(parseEnglishAnswer('6 times 5 is 30')).toBe(30);
    expect(parseEnglishAnswer("that's 30")).toBe(30);
    expect(parseEnglishAnswer('it makes forty-two')).toBe(42);
    // Several markers → take after the last one.
    expect(parseEnglishAnswer('6 times 5 equals 30 that is 30')).toBe(30);
  });

  it('rejects a pure TTS echo (no equality marker)', () => {
    expect(parseEnglishAnswer('6 times 5')).toBeNull();
    expect(parseEnglishAnswer('six times five')).toBeNull();
    // Marker with no number after it → nothing to submit.
    expect(parseEnglishAnswer('6 times 5 equals')).toBeNull();
  });

  it('accepts the last number when the prefix is only digit numbers', () => {
    // iOS Safari accumulates multiple attempts in one transcript ("37" then
    // "27" → "37 27"); we want the last expressed intent (27).
    expect(parseEnglishAnswer('37 27')).toBe(27);
    expect(parseEnglishAnswer('37 27 27')).toBe(27);
    expect(parseEnglishAnswer('30 37 27')).toBe(27);
    // But we still reject the question echo even in digits.
    expect(parseEnglishAnswer('6 times 5')).toBeNull();
  });
});
