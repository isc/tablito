// Utilitaires d'encodage partagés : base64url (clé VAPID, payloads de
// migration/transfert dans les fragments d'URL) et gzip (profils compressés).
// Regroupés ici pour ne pas éparpiller des demi-implémentations dans push /
// storage / transfer.

/** Chaîne base64 ou base64url → octets. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Octets → base64url sans padding (sûr dans un fragment d'URL). */
export function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Pas de Blob().stream() ici : indisponible sous jsdom (tests). Un
// ReadableStream mono-chunk fait le même travail partout.
async function pipeThrough(
  bytes: Uint8Array<ArrayBuffer>,
  transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> },
): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Uint8Array(await new Response(source.pipeThrough(transform)).arrayBuffer());
}

export function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return pipeThrough(bytes, new CompressionStream('gzip'));
}

export function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return pipeThrough(bytes, new DecompressionStream('gzip'));
}
