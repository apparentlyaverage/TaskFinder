// server/studentDomains.js — Batch 6: is an email address a South African
// university address? The allowlist lives in the student_domains table (seeded by
// migration 58 with all 26 public universities). Matching is subdomain-aware so a
// student address like g21012345@campus.ru.ac.za resolves to Rhodes (ru.ac.za).
//
// The LIKE pattern requires a dot separator ('%.' || domain), so a lookalike such
// as evilru.ac.za does NOT match the allowlisted ru.ac.za.
import { pool } from './db.js'

export function emailDomain(email) {
  return (email || '').split('@')[1]?.toLowerCase().trim() || null
}

// Returns the matched { domain, label } row (most specific first) or null.
export async function matchStudentDomain(email) {
  const domain = emailDomain(email)
  if (!domain) return null
  const { rows } = await pool.query(
    `SELECT domain, label FROM student_domains
      WHERE $1 = domain OR $1 LIKE '%.' || domain
      ORDER BY length(domain) DESC LIMIT 1`, [domain])
  return rows[0] || null
}

export async function isAllowedStudentDomain(email) {
  return (await matchStudentDomain(email)) !== null
}
