// Do NOT download Chromium during `npm install` — that keeps installs fast and
// unbreakable on restricted networks (a failed browser download must never fail
// the build). The browser is provisioned non-fatally in the build step instead,
// and prerendering degrades gracefully (SPA fallback) if no browser is present.
module.exports = { skipDownload: true }
