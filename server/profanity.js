// server/profanity.js — content moderation built on the vendored better-profane-words
// list (https://github.com/awdev1/better-profane-words, GPLv3; data in
// data/profane-words.json: 2700+ { word, categories[], intensity } entries).
//
// Policy: we BLOCK high-harm user-generated text — anything containing a term of
// intensity >= 4 (very strong / extremely offensive) OR in a slur / hateful-ideology
// category — and allow casual mild profanity (a peer student marketplace, not a
// nanny). Tuneable via the threshold below.
//
// Matching is fast: blocked single words go in a Set (O(tokens) per check) and the
// handful of multi-word phrases are substring-checked. Word-boundary semantics match
// the source library (so "classic" never trips on "ass", etc.).
import { readFileSync } from 'node:fs'

const words = JSON.parse(readFileSync(new URL('./data/profane-words.json', import.meta.url), 'utf8'))

const BLOCK_MIN_INTENSITY = 4
const HARD_CATEGORIES = new Set(['slur_racial', 'slur_gender', 'hateful_ideology'])
const isBlocked = e => e.intensity >= BLOCK_MIN_INTENSITY || (e.categories || []).some(c => HARD_CATEGORIES.has(c))

const BLOCKED_TOKENS = new Set()
const BLOCKED_PHRASES = []
for (const e of words) {
  if (!isBlocked(e)) continue
  const w = String(e.word || '').toLowerCase().trim()
  if (!w) continue
  if (/\s/.test(w)) BLOCKED_PHRASES.push(w)
  else BLOCKED_TOKENS.add(w)
}

// Return the blocked terms found in `text` (empty array = clean).
export function findBlocked(text) {
  const norm = String(text || '').toLowerCase()
  const hits = []
  for (const tok of norm.split(/[^a-z0-9]+/)) {
    if (tok && BLOCKED_TOKENS.has(tok)) hits.push(tok)
  }
  for (const p of BLOCKED_PHRASES) {
    if (norm.includes(p)) hits.push(p)
  }
  return hits
}

// True when `text` contains language we block. Accepts one or more strings.
export function containsBlockedLanguage(...parts) {
  return findBlocked(parts.filter(Boolean).join(' ')).length > 0
}

// Express guard: 422 if any provided field contains blocked language. Returns true
// when it has already responded (so the caller can `if (rejectIfProfane(...)) return`).
export function rejectIfProfane(res, ...parts) {
  if (containsBlockedLanguage(...parts)) {
    res.status(422).json({ message: 'Please remove offensive language (slurs or hate speech) before posting.' })
    return true
  }
  return false
}
