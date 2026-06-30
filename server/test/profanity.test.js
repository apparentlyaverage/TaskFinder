// Content-moderation filter (better-profane-words). Policy: block intensity >= 4
// and slur/hate categories; allow casual mild profanity. Word-boundary matching.
import { describe, it, expect } from 'vitest'
import { containsBlockedLanguage, findBlocked } from '../profanity.js'

describe('profanity filter', () => {
  it('blocks high-intensity profanity', () => {
    expect(containsBlockedLanguage('you absolute motherfucker')).toBe(true)
  })
  it('allows clean marketplace text', () => {
    expect(containsBlockedLanguage('Please help me move my couch on Saturday')).toBe(false)
  })
  it('allows mild casual words (below the block threshold)', () => {
    expect(containsBlockedLanguage('this is a damn good deal')).toBe(false)
  })
  it('matches on word boundaries — no false positive inside a normal word', () => {
    // "ass" is mild anyway, but ensure substrings of clean words never trip it
    expect(containsBlockedLanguage('a classic assignment for the class')).toBe(false)
  })
  it('findBlocked returns the offending term(s)', () => {
    const hits = findBlocked('what a motherfucker')
    expect(hits.length).toBeGreaterThan(0)
  })
  it('accepts multiple fields and ignores empties', () => {
    expect(containsBlockedLanguage('clean title', null, '   ')).toBe(false)
  })
})
