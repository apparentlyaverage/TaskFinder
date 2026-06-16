# ReLivR — Secret Rotation Runbook

How to rotate the platform's secrets, and what breaks when you do. Rotate on a
schedule (e.g. every 90 days) and **immediately** on any suspected exposure
(a secret committed to git, leaked in logs, shared in chat, or an offboarded
team member who had access).

Secrets live in `server/.env` (never committed — see `.gitignore`) and in the
host's env (Railway). Update **both** the host and your local `.env`.

---

## 1. `JWT_SECRET` (signs all auth tokens)

**Blast radius:** rotating it invalidates **every** issued JWT — all users are
signed out and must log in again. There is no partial rotation.

1. Generate a new 32+ char secret:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
2. Set `JWT_SECRET` in the host env (Railway) and in local `server/.env`.
3. Redeploy / restart the server. (`assertEnv()` refuses to boot if it's missing
   or under 32 chars — see `server/env.js`.)
4. Expect a wave of 401s as old tokens are rejected; the frontend clears the
   stale token and shows the login screen. No data migration needed.

> Note: this is the brute-force "log everyone out" lever. For revoking a *single*
> user without rotating the global secret, bump their `token_version` instead
> (logout / password reset / `POST /auth/logout-all` already do this — see TD-5).

## 2. Database credentials (`DATABASE_URL`, Neon)

**Blast radius:** brief connection errors during the swap; no user-facing token
churn.

1. In the Neon console, reset the role password (or create a new role and grant
   it the same privileges).
2. Update `DATABASE_URL` in the host env and local `server/.env`.
3. Redeploy / restart. Verify `GET /health` returns `{"db":"connected"}`.
4. If you created a new role, revoke the old one once traffic is healthy.

## 3. Google OAuth (`GOOGLE_CLIENT_SECRET`)

**Blast radius:** in-flight Google sign-ins fail until updated; existing sessions
(JWTs) are unaffected.

1. In Google Cloud Console → Credentials, add a new client secret (keep the old
   one active during the overlap).
2. Update `GOOGLE_CLIENT_SECRET` in host + local env; redeploy.
3. Test the full `/auth/google` round-trip, then delete the old secret.
4. `GOOGLE_CLIENT_ID` and `GOOGLE_CALLBACK_URL` rarely change; if they do, update
   the authorized redirect URIs in the console to match.

## 4. Email provider key (when wired — `RESEND_API_KEY` or equiv.)

**Blast radius:** transactional email (password reset, verification) silently
falls back to the dev stub until updated — see `server/email.js`.

1. Roll the key in the provider dashboard.
2. Update the env var; redeploy. Send a test password-reset to confirm delivery.

---

## After any rotation
- Confirm `GET /health` is green and a fresh login works end-to-end.
- If the secret was exposed in **git history**, rotating is necessary but not
  sufficient — purge it from history (e.g. `git filter-repo`) and force-push, or
  treat the value as permanently burned.
- Record the rotation (date, which secret, why) in your ops log.
