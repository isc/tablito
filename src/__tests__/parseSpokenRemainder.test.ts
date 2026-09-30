import { describe, expect, it } from 'vitest';
import { parseSpokenQuotientAndRemainder, parseSpokenRemainder } from '../lib/parseSpokenRemainder';

describe('parseSpokenQuotientAndRemainder (fr)', () => {
  const parse = (s: string) => parseSpokenQuotientAndRemainder(s, 'fr');

  it.each([
    ['six reste trois', 6, 3],
    ['six, reste trois', 6, 3],
    ['six et il reste trois', 6, 3],
    ['Six, il reste 3', 6, 3],
    ['6 reste 3', 6, 3],
    ['six fois, reste trois', 6, 3],
    ['six ça tombe juste', 6, 0],
    ['six, reste rien', 6, 0],
    ['six reste zéro', 6, 0],
    ['neuf il en reste un', 9, 1],
  ])('« %s » → %i, reste %i', (input, quotient, remainder) => {
    expect(parse(input)).toEqual({ quotient, remainder });
  });

  it('un quotient seul laisse le reste à demander', () => {
    expect(parse('six')).toEqual({ quotient: 6, remainder: null });
    expect(parse('six fois')).toEqual({ quotient: 6, remainder: null });
    expect(parse('six reste')).toEqual({ quotient: 6, remainder: null });
  });

  it('ignore l’écho de la relance et le bruit', () => {
    expect(parse('et il reste combien')).toBeNull();
    expect(parse('euh')).toBeNull();
  });

  it('un mot de reste nul placé avant le nombre ne mange pas la réponse', () => {
    expect(parse('pile six')).toEqual({ quotient: 6, remainder: null });
  });
});

describe('parseSpokenQuotientAndRemainder (en)', () => {
  const parse = (s: string) => parseSpokenQuotientAndRemainder(s, 'en');

  it.each([
    ['six remainder three', 6, 3],
    ['six r three', 6, 3],
    ['six with a remainder of three', 6, 3],
    ['six no remainder', 6, 0],
    ['six exactly', 6, 0],
  ])('"%s" → %i r %i', (input, quotient, remainder) => {
    expect(parse(input)).toEqual({ quotient, remainder });
  });

  it('a lone quotient leaves the remainder to ask', () => {
    expect(parse('six')).toEqual({ quotient: 6, remainder: null });
  });
});

describe('parseSpokenRemainder', () => {
  it.each([
    ['trois', 3],
    ['il reste trois', 3],
    ['rien', 0],
    ['ça tombe juste', 0],
    ['zéro', 0],
    ['six reste trois', 3],
  ])('fr « %s » → %i', (input, value) => {
    expect(parseSpokenRemainder(input, 'fr')).toBe(value);
  });

  it('en', () => {
    expect(parseSpokenRemainder('nothing', 'en')).toBe(0);
    expect(parseSpokenRemainder('three', 'en')).toBe(3);
  });

  it('écho de la relance', () => {
    expect(parseSpokenRemainder('et il reste combien', 'fr')).toBeNull();
  });
});
