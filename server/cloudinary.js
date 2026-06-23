// server/cloudinary.js — Cloudinary signed-upload helpers.
//
// We do NOT proxy image bytes through the server. Instead the browser uploads
// directly to Cloudinary using a short-lived signature we mint here, so large
// phone photos never touch Railway's memory/bandwidth. This module only:
//   • reads the Cloudinary credentials from the environment, and
//   • signs the exact set of params the browser will echo back to Cloudinary.
//
// Signing is the documented Cloudinary algorithm (SHA-1 of the sorted params +
// the API secret), implemented with node:crypto — no SDK dependency, and the
// pure signParams() is trivially unit-testable.
import crypto from 'node:crypto'

export function cloudinaryConfig() {
  return {
    cloudName:  process.env.CLOUDINARY_CLOUD_NAME  || '',
    apiKey:     process.env.CLOUDINARY_API_KEY     || '',
    apiSecret:  process.env.CLOUDINARY_API_SECRET  || '',
    // Optional signed upload preset — when set in the Cloudinary dashboard it
    // enforces format whitelist / size / dimension caps / f_auto,q_auto so those
    // limits are owned by Cloudinary, not trusted from the browser.
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
  }
}

// True only when all three credentials are present. Routes use this to return a
// clean 503 ("not configured yet") instead of minting a broken signature.
export function isConfigured() {
  const c = cloudinaryConfig()
  return !!(c.cloudName && c.apiKey && c.apiSecret)
}

// Sign params per Cloudinary spec: drop empty values, sort keys, join as
// `k=v` with `&`, append the API secret, then SHA-1 hex.
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
}
