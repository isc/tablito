// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mp3DurationSeconds } from './mp3-duration.mjs';

describe('mp3DurationSeconds', () => {
  it('mesure la durée réelle (décodée par ffmpeg : 1,72 s)', () => {
    expect(mp3DurationSeconds(readFileSync('public/audio/tts/en/q-3-4.mp3'))).toBeCloseTo(1.72, 1);
  });

  it('ne compte rien dans ce qui n’est pas du MP3', () => {
    expect(mp3DurationSeconds(new Uint8Array(1000))).toBe(0);
  });
});
