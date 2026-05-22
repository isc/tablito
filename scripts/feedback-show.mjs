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

const headers = { apikey: secret, Authorization: `Bearer ${secret}` };

// Résolution client-side du préfixe : `id` est un UUID, Postgres refuse LIKE
// dessus sans cast explicite. On récupère les ids récents et on filtre.
const listRes = await fetch(
  `${url}/rest/v1/feedback?select=id&order=created_at.desc&limit=200`,
  { headers },
);
if (!listRes.ok) {
  console.error(`Erreur ${listRes.status}: ${await listRes.text()}`);
  process.exit(1);
}
const candidates = (await listRes.json()).filter((r) => r.id.startsWith(prefix));
if (candidates.length === 0) {
  console.error(`Aucun feedback trouvé pour le préfixe « ${prefix} ».`);
  process.exit(1);
}
if (candidates.length > 1) {
  console.error(`Préfixe ambigu (${candidates.length} résultats). Utilise un préfixe plus long.`);
  process.exit(1);
}

const rowRes = await fetch(
  `${url}/rest/v1/feedback?select=*&id=eq.${candidates[0].id}`,
  { headers },
);
if (!rowRes.ok) {
  console.error(`Erreur ${rowRes.status}: ${await rowRes.text()}`);
  process.exit(1);
}
const [row] = await rowRes.json();
console.log(JSON.stringify(row, null, 2));
