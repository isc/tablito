#!/usr/bin/env node
// Lit les feedbacks depuis Supabase via la secret key (côté local uniquement).
// Nécessite .env.local (chargé via `node --env-file=.env.local`).
//
// Usage:
//   npm run feedback:list           # uniquement les feedbacks status='new'
//   npm run feedback:list -- --all  # tous les feedbacks (new + done)
//   npm run feedback:list -- 100    # ajuster la limite (défaut 50)

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error('SUPABASE_URL ou SUPABASE_SECRET_KEY manquant. Lance avec: npm run feedback:list');
  process.exit(1);
}

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 50);

const filter = showAll ? '' : '&status=eq.new';
const endpoint = `${url}/rest/v1/feedback?select=*&order=created_at.desc&limit=${limit}${filter}`;

const res = await fetch(endpoint, {
  headers: {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
  },
});

if (!res.ok) {
  console.error(`Erreur ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const rows = await res.json();
if (rows.length === 0) {
  console.log(showAll ? 'Aucun feedback.' : "Aucun feedback à traiter (utilise --all pour voir l'historique).");
  process.exit(0);
}

for (const row of rows) {
  const date = new Date(row.created_at).toLocaleString('fr-FR');
  const ctx = row.context ?? {};
  const stats = ctx.stats
    ? ` | ${ctx.stats.total_sessions} séances, ${ctx.stats.facts_mastered}/${ctx.stats.facts_total} maîtrisés`
    : '';
  const snapshotTag = ctx.profile_snapshot ? ' [📎 profil joint]' : '';
  const shortId = row.id.slice(0, 8);
  const statusTag = showAll ? ` [${row.status}]` : '';
  console.log('---');
  console.log(`${shortId}${statusTag}${snapshotTag} [${date}] ${row.email ?? '(sans email)'}${stats}`);
  console.log(`UA: ${ctx.user_agent ?? '?'} | ${ctx.viewport?.w ?? '?'}x${ctx.viewport?.h ?? '?'}`);
  console.log('');
  console.log(row.message);
}
console.log('---');
const noun = `feedback${rows.length > 1 ? 's' : ''}`;
const suffix = showAll ? '' : ' à traiter';
console.log(`${rows.length} ${noun}${suffix}.`);
if (!showAll && rows.length > 0) {
  console.log("Pour marquer comme traité : npm run feedback:treat -- <id> [<id>...]");
}
