/**
 * Génère le dictionnaire de prononciation servi au mode vocal épelé de la
 * conjugaison (specs §15.10) : `public/phonetic/fr.txt`.
 *
 * Usage :
 *   node scripts/generate-phonetic-dict.mjs [chemin/vers/fr_FR.txt]
 *   PHONETIC_SRC=~/refs/fr_FR.txt node scripts/generate-phonetic-dict.mjs
 *
 * SOURCE (hors du repo, ~6 Mo) : le dictionnaire de prononciation français
 * d'open-dict-data/ipa-dict (licence MIT), fichier `data/fr_FR.txt`, au format
 * `mot<TAB>/api/` avec les variantes séparées par des virgules. Le fichier n'est
 * pas versionné ici : c'est le RÉSULTAT ÉLAGUÉ qui l'est, comme les MP3 de
 * generate-tts.mjs — l'app ne doit dépendre ni du réseau ni d'un dépôt tiers au
 * build, et 6 Mo de dictionnaire dans un repo de PWA n'auraient aucun sens.
 *
 * ÉLAGAGE — c'est tout l'intérêt du script. L'appariement ne compare jamais des
 * orthographes : il projette le transcript en phonèmes et compare là
 * (src/lib/parseSpelledLetters.ts). Or les seules cibles possibles sont
 *   - les prononciations des noms de lettres (src/lib/letterNames.ts), et
 *   - les prononciations des formes verbales de l'inventaire
 *     (src/lib/conjugationFacts.ts),
 * soit ~120 chaînes de phonèmes. Un mot qui ne sonne comme aucune d'elles ne
 * pourrait JAMAIS apparier : le jeter ne perd rien. Il reste quelques centaines
 * d'entrées — « le vocabulaire est fermé » de la spec, rendu littéral — et un
 * asset de quelques kilo-octets, chargé seulement si le mode vocal est actif
 * (groupe de cache `phonetic`, cf. LAZY_GROUPS dans scripts/build.mjs).
 *
 * Le script est bruyant : il refuse de tourner si la source manque, et signale
 * toute forme de l'inventaire absente du dictionnaire (elle dégraderait
 * silencieusement l'appariement de la forme dite avant l'épellation).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importTs } from './import-ts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'phonetic')
const OUT_FILE = join(OUT_DIR, 'fr.txt')

const DEFAULT_SRC = join(homedir(), 'Code', 'tablito-refs', 'fr_FR.txt')
const SRC = process.argv[2] || process.env.PHONETIC_SRC || DEFAULT_SRC

// Symboles de la source qu'on ne compare pas : les barres obliques qui
// encadrent la transcription, et le ʼ qui marque le h aspiré (« haine » →
// /ʼɛn/, exactement le même son que « aine » → /ɛn/ — les distinguer ferait
// rater une lettre sur une nuance que personne ne prononce).
function normalizePhonemes(raw) {
  return raw
    .split(',')
    .map((p) => p.replace(/[/ʼˈˌ\s]/g, ''))
    .filter(Boolean)
}

function parseSource(text) {
  const dict = new Map()
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t')
    if (tab <= 0) continue
    const word = line.slice(0, tab).toLowerCase()
    const phonemes = normalizePhonemes(line.slice(tab + 1))
    if (phonemes.length > 0 && !dict.has(word)) dict.set(word, phonemes)
  }
  return dict
}

if (!existsSync(SRC)) {
  console.error(`Dictionnaire source introuvable : ${SRC}`)
  console.error('Récupère data/fr_FR.txt depuis open-dict-data/ipa-dict (MIT), puis :')
  console.error('  PHONETIC_SRC=/chemin/fr_FR.txt node scripts/generate-phonetic-dict.mjs')
  process.exit(1)
}

const source = parseSource(await readFile(SRC, 'utf8'))

const { LETTER_NAMES } = await importTs('src/lib/letterNames.ts')
const { conjFactDefs, resolveConjQuestion } = await importTs('src/lib/conjugationFacts.ts')

const forms = new Set()
for (const def of conjFactDefs()) {
  def.carriers.forEach((_, i) => forms.add(resolveConjQuestion(def, i).form.toLowerCase()))
}

const targets = new Set()
for (const def of LETTER_NAMES) for (const p of def.phonemes) targets.add(p)
const missingForms = []
for (const form of forms) {
  const phonemes = source.get(form)
  if (!phonemes) {
    missingForms.push(form)
    continue
  }
  for (const p of phonemes) targets.add(p)
}

const kept = [...source.entries()]
  .filter(([, phonemes]) => phonemes.some((p) => targets.has(p)))
  .sort(([a], [b]) => a.localeCompare(b, 'fr'))

const header = [
  '# Dictionnaire de prononciation du mode vocal épelé (specs §15.10).',
  '# GÉNÉRÉ par scripts/generate-phonetic-dict.mjs — ne pas éditer à la main.',
  '# Source : open-dict-data/ipa-dict, data/fr_FR.txt (licence MIT), élagué au',
  '# vocabulaire fermé du mode : noms de lettres + formes de l’inventaire.',
  '# Format : mot<TAB>phonèmes, variantes séparées par « | ».',
]
const body = kept.map(([word, phonemes]) => `${word}\t${phonemes.join('|')}`)
const out = `${[...header, ...body].join('\n')}\n`

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT_FILE, out, 'utf8')

console.log(`Source        : ${SRC} (${source.size} entrées)`)
console.log(`Cibles        : ${targets.size} chaînes de phonèmes`)
console.log(`  dont formes : ${forms.size} formes de l'inventaire`)
console.log(`Écrit         : ${OUT_FILE} — ${kept.length} entrées, ${(out.length / 1024).toFixed(1)} Ko`)
if (missingForms.length > 0) {
  console.warn(`⚠ formes absentes de la source (appariement dégradé) : ${missingForms.join(', ')}`)
}
// Une prononciation de nom de lettre que PERSONNE ne porte dans la source
// n'aide jamais à reconnaître quoi que ce soit : soit une valeur API fautive
// dans la table maison (à corriger), soit un nom composé que la source
// n'indexe pas (« i grec » → /igʁɛk/, reconnu par son orthographe et non par
// ses phonèmes — attendu). Signalé sans dramatiser, mais signalé.
const backed = new Set(kept.flatMap(([, phonemes]) => phonemes))
const unbacked = LETTER_NAMES.flatMap((def) =>
  def.phonemes.filter((p) => !backed.has(p)).map((p) => `${def.letter}=/${p}/`),
)
if (unbacked.length > 0) {
  console.log(`Note          : phonèmes sans appui dans la source — ${unbacked.join(' ')}`)
}
