// Durée d'un MP3 (MPEG 1/2/2.5, couche III), en secondes, en comptant ses
// trames — sans dépendance ni ffprobe (absent des runners GitHub). Sert à
// repérer une synthèse vocale qui a ajouté un « euh » à un mot seul
// (cf. generate-tts.mjs, `maxSeconds`).

const BITRATES = {
  // kbps, index 1..14 ; MPEG-1 couche III, puis MPEG-2/2.5 couche III.
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES = {
  1: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  2.5: [11025, 12000, 8000],
};

/** @param {Uint8Array} buf */
export function mp3DurationSeconds(buf) {
  let i = 0;
  // Balise ID3v2 en tête : sa taille est un entier « synchsafe » sur 4 octets.
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  }
  let seconds = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      i++;
      continue;
    }
    const versionBits = (buf[i + 1] >> 3) & 0x03;
    const layerBits = (buf[i + 1] >> 1) & 0x03;
    const bitrateIdx = buf[i + 2] >> 4;
    const rateIdx = (buf[i + 2] >> 2) & 0x03;
    const padding = (buf[i + 2] >> 1) & 0x01;
    const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : versionBits === 0 ? 2.5 : null;
    if (version === null || layerBits !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) {
      i++;
      continue;
    }
    const bitrate = BITRATES[version === 1 ? 1 : 2][bitrateIdx] * 1000;
    const sampleRate = SAMPLE_RATES[version][rateIdx];
    const samples = version === 1 ? 1152 : 576;
    const frameLength = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
    seconds += samples / sampleRate;
    i += frameLength;
  }
  return seconds;
}
