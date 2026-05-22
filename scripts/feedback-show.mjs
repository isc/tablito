#!/usr/bin/env node
// Affiche le contexte complet d'un feedback (utile pour inspecter le
// profile_snapshot quand le parent a coché « joindre l'historique »).
//
// Usage:
//   npm run feedback:show -- <id-prefix>

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error('SUPABASE_URL ou SUPABASE_SECRET_KEY manquant.');
  process.exit(1);
}

const prefix = process.argv[2];
if (!prefix) {
  console.error('Usage: npm run feedback:show -- <id-prefix>');
  process.exit(1);
}

const endpoint = `${url}/rest/v1/feedback?select=*&id=like.${prefix}*&limit=2`;
const res = await fetch(endpoint, {
  headers: { apikey: secret, Authorization: `Bearer ${secret}` },
});

if (!res.ok) {
  console.error(`Erreur ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const rows = await res.json();
if (rows.length === 0) {
  console.error(`Aucun feedback trouvé pour le préfixe « ${prefix} ».`);
  process.exit(1);
}
if (rows.length > 1) {
  console.error(`Préfixe ambigu (${rows.length} résultats). Utilise un préfixe plus long.`);
  process.exit(1);
}

console.log(JSON.stringify(rows[0], null, 2));
