// server/routes/uploads.js — signed direct-to-Cloudinary image uploads.
//
// Flow: the browser asks here for a signature, then uploads the file straight
// to Cloudinary with it, then saves the returned URL via PATCH /businesses/mine
// (or POST/PATCH /businesses for admins). Files never pass through this server.
//
// Security:
//   • requireAuth — anonymous callers can never mint a signature (no burning
//     our Cloudinary credits).
//   • Ownership-gated folder — a business owner is locked to their own
//     `relivr/businesses/<their-business-id>` folder; they cannot write into
//     another business's folder. Admins may target any business (or an
//     `_admin` scratch folder when creating a new listing that has no id yet).
import { Router } from 'express'
import { requireAuth } from '../middleware.js'
import { pool } from '../db.js'
import log from '../log.js'
import { cloudinaryConfig, isConfigured, signParams } from '../cloudinary.js'

const router = Router()

// Folder segments must be a safe slug (UUIDs in practice). Anything else is
// rejected so a crafted businessId can never escape the relivr/businesses tree.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

// Server-side format guard, independent of any Cloudinary upload preset. We sign
// `allowed_formats` into the upload, so Cloudinary rejects anything outside this
// list — and because the param is signed, a client (or a leaked signature) can't
// widen it. Size is bounded client-side (10 MB) + by the Cloudinary account/preset
// limit; a hard byte cap can't be signed onto a direct (browser→Cloudinary) upload.
const ALLOWED_FORMATS = process.env.CLOUDINARY_ALLOWED_FORMATS || 'jpg,jpeg,png,webp,gif'

// POST /uploads/signature   body (optional): { businessId }
router.post('/signature', requireAuth, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Image uploads are not configured yet.' })
  }
  try {
    let folderId
    if (req.userRole === 'admin') {
      // Admin may upload on a specific business's behalf, or to a scratch folder
      // when creating a brand-new listing that has no id yet.
      const requested = (req.body?.businessId || '').toString().trim()
      folderId = requested && SAFE_ID.test(requested) ? requested : '_admin'
    } else {
      // Owners are locked to their own business — folder is derived server-side,
      // never taken from the request.
      const owned = await pool.query(
        'SELECT business_id FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.userId])
      if (owned.rows.length === 0) {
        return res.status(403).json({ message: 'No business is linked to your account.' })
      }
      folderId = owned.rows[0].business_id
    }

    const { cloudName, apiKey, apiSecret, uploadPreset } = cloudinaryConfig()
    const timestamp = Math.floor(Date.now() / 1000)
    // Scope keeps each feature's media in its own tree. 'deals' for Campus Deals
    // images, otherwise the business page media. Owner/admin folder isolation is
    // unchanged — only the top-level prefix differs.
    const scope = req.body?.scope === 'deals' ? 'deals' : 'businesses'
    const folder = `relivr/${scope}/${folderId}`

    // These are exactly the params the browser must send back to Cloudinary
    // (besides file/api_key). The signature must cover the same set.
    const toSign = { folder, timestamp, allowed_formats: ALLOWED_FORMATS }
    if (uploadPreset) toSign.upload_preset = uploadPreset
    const signature = signParams(toSign, apiSecret)

    return res.status(200).json({
      cloudName, apiKey, timestamp, folder,
      allowedFormats: ALLOWED_FORMATS,
      uploadPreset: uploadPreset || null,
      signature,
    })
  } catch (err) {
    log.error('POST /uploads/signature', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
