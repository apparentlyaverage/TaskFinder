// Post-build prerender: boot the built SPA in headless Chromium, visit each
// public route, and write the fully-rendered HTML to dist/<route>/index.html.
// Crawlers (and social/Bing, which don't run JS) then get real content + the
// per-route <title>/description/canonical/OG that applyRouteMeta() sets at
// runtime — captured statically. On the client, React simply re-renders into
// #root, so behaviour is unchanged for real users.
//
// RESILIENT BY DESIGN: if Chromium can't launch (e.g. the build environment has
// no browser), we log and exit 0. The build still succeeds and Vercel serves the
// normal SPA — prod is never worse than before prerendering.
import http from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, '..', 'dist')

// Public routes worth crawling (mirror sitemap.xml). Authed/app routes are
// intentionally excluded — they're private and disallowed in robots.txt.
const ROUTES = [
  '/', '/how-it-works', '/features', '/pricing', '/trust-safety',
  '/about', '/help', '/contact', '/guidelines',
  '/terms', '/privacy', '/cookies', '/popia',
]

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json', '.txt':'text/plain', '.xml':'application/xml' }

// Minimal static server for dist/ with SPA fallback to index.html, so the
// client router resolves each path and renders the right view.
function serveDist() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = decodeURIComponent((req.url || '/').split('?')[0])
        let file = path.join(DIST, url)
        if (url.endsWith('/')) file = path.join(file, 'index.html')
        if (!existsSync(file) || !(await stat(file)).isFile()) file = path.join(DIST, 'index.html')
        const body = await readFile(file)
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
        res.end(body)
      } catch {
        res.statusCode = 500; res.end('err')
      }
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.warn('[prerender] dist/index.html missing — run vite build first. Skipping.')
    return
  }

  let puppeteer
  try { puppeteer = (await import('puppeteer')).default }
  catch { console.warn('[prerender] puppeteer not installed — skipping (SPA fallback served).'); return }

  const server = await serveDist()
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`

  let browser
  try {
    // Use PUPPETEER_EXECUTABLE_PATH when set (local dev pointing at system
    // Chrome); otherwise puppeteer's bundled Chromium (downloaded in CI/Vercel).
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  } catch (err) {
    console.warn('[prerender] Chromium could not launch — skipping (SPA fallback served):', err.message)
    server.close(); return
  }

  let ok = 0, skipped = 0
  for (const route of ROUTES) {
    const page = await browser.newPage()
    try {
      await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
      // Wait until React has mounted real content (not the empty shell).
      await page.waitForFunction(
        () => { const r = document.getElementById('root'); return r && r.innerText.trim().length > 150 },
        { timeout: 15000 }
      )
      await new Promise(r => setTimeout(r, 600)) // let applyRouteMeta() settle the <head>

      const rootLen = await page.evaluate(() => document.getElementById('root').innerText.trim().length)
      if (rootLen < 150) { console.warn(`[prerender] ${route} rendered thin (${rootLen} chars) — skipped`); skipped++; continue }

      let html = await page.content()
      html = '<!doctype html>\n' + html.replace(/^<!doctype html>/i, '')

      const outPath = route === '/'
        ? path.join(DIST, 'index.html')
        : path.join(DIST, route.replace(/^\//, ''), 'index.html')
      await mkdir(path.dirname(outPath), { recursive: true })
      await writeFile(outPath, html)
      console.log(`[prerender] ${route.padEnd(16)} -> ${path.relative(DIST, outPath)}  (${rootLen} chars)`)
      ok++
    } catch (err) {
      console.warn(`[prerender] ${route} failed — left as SPA:`, err.message)
      skipped++
    } finally {
      await page.close()
    }
  }

  await browser.close()
  server.close()
  console.log(`[prerender] done: ${ok} prerendered, ${skipped} skipped.`)
}

// Never fail the build because of prerendering.
main().catch(err => { console.warn('[prerender] unexpected error — skipping:', err.message) })
