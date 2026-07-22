// ─── UNIFIED RELIV APP ──────────────────────────────────────────────────
// Landing page → Auth → Dashboard
// All legal, product, and support pages included
// Single design system, single auth context, single router
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
  createContext, useContext, useReducer, useId,
} from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import Icon, { hasIcon } from './Icon.jsx'

// ─── LAUNCH GATE ─────────────────────────────────────────────────────────────
// The full app is locked to the public until the launch timer ends. Until then
// only admins can enter; everyone else (creators/earners) can sign up and join
// the waitlist, but lands on a "founding member" holding screen instead of the
// app. The gate auto-opens the moment this date passes — no code change needed.
// This date is the single source of truth for both the countdown and the gate.
// All API calls go through this prefix so the deployed frontend (Vercel) can
// talk to the separate backend (Railway). Set VITE_API_URL in Vercel env vars
// to your Railway service URL, e.g. https://relivr-server.up.railway.app
// In development Vite proxies relative paths so this evaluates to ''.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

// QR / shareable deep-link (/local?b=<business_id>): capture the target at module
// load — BEFORE the logged-out auth redirect can strip the query — so an in-store
// scanner who then signs in still lands on the business they scanned.
try { const _b = new URLSearchParams(window.location.search).get('b'); if (_b) sessionStorage.setItem('rl_pending_biz', _b) } catch { /* noop */ }

// After sign-in, send a pending QR-scanner to Local (the business opens itself).
function homeAfterAuth(role, fallback) {
  try { if (role !== 'admin' && sessionStorage.getItem('rl_pending_biz')) return 'local-browse' } catch { /* noop */ }
  return fallback
}

export const LAUNCH_AT = '2026-07-07T00:00:00'
const launchMs = () => new Date(LAUNCH_AT).getTime()
const hasLaunched = () => Date.now() >= launchMs()
// A signed-in user is locked out of the app when it hasn't launched and they
// aren't an admin or a business partner. Admins run the show pre-launch;
// business partners onboard (set up their page) ahead of launch day; QA/test
// accounts on the reserved @relivr.test domain get in so the team can exercise
// the full app before launch. Mirror of the server-side gate in app.js.
const PRELAUNCH_ROLES = ['admin', 'business']
const isTestAccount = (user) => !!user?.email && user.email.toLowerCase().endsWith('@relivr.test')
const isAppLocked = (user) => !!user && !PRELAUNCH_ROLES.includes(user.role) && !isTestAccount(user) && !hasLaunched()

// Fire-and-forget public analytics beacon for a business page. Never throws and
// never blocks the UI — a failed beacon must not affect what the visitor sees.
function trackBizEvent(businessId, type) {
  if (!businessId) return
  try {
    fetch(`${API_BASE}/businesses/${businessId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* ignore */ }
}

// ─── FONTS & GLOBAL STYLES ───────────────────────────────────────────────────
const _fl = document.createElement('link')
_fl.rel = 'stylesheet'
_fl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
document.head.appendChild(_fl)

const _style = document.createElement('style')
_style.textContent = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  /* CORPORATE REDESIGN — the design grammar of the big service marketplaces
     (Uber / Airbnb / Thumbtack / TaskRabbit / DoorDash): pure white ground,
     near-black ink, neutral grays with NO brand tint, and purple kept as the
     single accent so it still reads as ReLivR. Grotesque type set heavy and
     tight; labels are sans (not mono); radii tighten to 8/12; shadows are
     neutral black and reserved for hover lift. "amber" stays the accent alias
     for historical reasons — it IS the purple. */
  --black:         #111111;
  --white:         #ffffff;
  --amber:         #7e22ce;
  --amber2:        #6b21a8;
  --green:         #15803d;
  --red:           #b91c1c;
  --blue:          #1d4ed8;
  --purple:        #b45309;
  --orchid:        #c084fc;
  --highlight:     #d8b4fe;
  --bg-base:       #ffffff;
  --bg-surface:    #ffffff;
  --bg-elevated:   #f7f7f7;
  --bg-hover:      #efefef;
  --border:        #e8e8e8;
  --border-strong: #dcdcdc;
  --text-primary:  #111111;
  --text-secondary:#5f5f5f;
  --text-muted:    #8f8f8f;
  --accent:        #7e22ce;
  --accent-dim:    #f6effc;
  --accent-glow:   rgba(126,34,206,0.10);
  --success:       #0e7a4a;
  --danger:        #b91c1c;
  --info:          #1d4ed8;
  --warning:       #b45309;
  /* Two SEMANTIC accents so trust + presence stop borrowing brand-purple.
     Verified (green) = ID/student verified. Live (blue) = online now. */
  --verified:      #0e7a4a;
  --verified-dim:  #e7f4ed;
  --live:          #0369a1;
  --live-dim:      #e0f2fe;
  /* Grotesque stack the reference sites degrade to: Helvetica Neue on macOS,
     Inter (already loaded) on Windows, then the system chain. Labels/eyebrows
     and prices are SANS now — the mono aliases point here on purpose so the
     whole app sweeps to the corporate look without touching call sites. */
  --font-display:  'Helvetica Neue', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, system-ui, sans-serif;
  --font-body:     'Helvetica Neue', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, system-ui, sans-serif;
  --font-mono:     'Helvetica Neue', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, system-ui, sans-serif;
  --fd: 'Helvetica Neue', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, system-ui, sans-serif;
  --fb: 'Helvetica Neue', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, system-ui, sans-serif;
  --fm: 'Helvetica Neue', 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, system-ui, sans-serif;
  --surface:       #ffffff;
  --surface2:      #f7f7f7;
  --muted:         #8f8f8f;
  --radius-sm:     8px;
  --radius-md:     12px;
  --radius-lg:     14px;
  --radius-xl:     18px;
  --radius-pill:   999px;
  --transition:    150ms ease;
  --ease:          cubic-bezier(.4,0,.2,1);
  /* Neutral elevation — flat at rest, lift on hover (Airbnb card behavior) */
  --shadow-xs:     0 1px 2px rgba(0,0,0,.04);
  --shadow-sm:     0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md:     0 6px 20px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04);
  --shadow-lg:     0 16px 48px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.05);
  --shadow-xl:     0 30px 70px rgba(0,0,0,.16), 0 10px 24px rgba(0,0,0,.06);
  --ring:          0 0 0 3px rgba(126,34,206,.16);
}
/* Dark mode — neutral near-black grays (no purple tint), purple accent kept.
   The reference sites don't ship dark marketing pages, but the app keeps its
   working theme toggle. Toggled via data-theme (persisted). */
:root[data-theme="dark"] {
  --black:         #f5f5f5; /* the logomark's ink — flips light so the logo stays visible */
  --amber:         #a855f7;
  --amber2:        #9333ea;
  --orchid:        #c084fc;
  --highlight:     #5b21b6;
  --bg-base:       #101010;
  --bg-surface:    #181818;
  --bg-elevated:   #212121;
  --bg-hover:      #2a2a2a;
  --border:        #2a2a2a;
  --border-strong: #3d3d3d;
  --text-primary:  #f5f5f5;
  --text-secondary:#c4c4c4;
  --text-muted:    #9a9a9a;
  --accent:        #a855f7;
  --accent-dim:    #33204d;
  --accent-glow:   rgba(168,85,247,0.16);
  --success:       #34d399;
  --danger:        #f87171;
  --info:          #60a5fa;
  --warning:       #fbbf24;
  --verified:      #34d399;
  --verified-dim:  #143327;
  --live:          #38bdf8;
  --live-dim:      #102a3b;
  --surface:       #181818;
  --surface2:      #212121;
  --muted:         #9a9a9a;
  --shadow-xs:     0 1px 2px rgba(0,0,0,.4);
  --shadow-sm:     0 1px 3px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.3);
  --shadow-md:     0 6px 16px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3);
  --shadow-lg:     0 16px 40px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.35);
  --shadow-xl:     0 30px 70px rgba(0,0,0,.6), 0 10px 24px rgba(0,0,0,.4);
  --ring:          0 0 0 3px rgba(168,85,247,.3);
}
:root[data-theme="dark"] .prose h3, :root[data-theme="dark"] .prose .highlight p { color:var(--text-primary); }
/* NB: no overflow-x on <html> — clipping the root element makes Chromium treat
   <html> (not the viewport) as the scroller, which breaks precision-trackpad
   scrolling. The horizontal clamp lives on <body> alone. */
html { scroll-behavior: smooth; font-size: 16px; }
body {
  background: var(--bg-base); color: var(--text-primary);
  font-family: var(--font-body); font-size: 15px; line-height: 1.6;
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
::selection { background: var(--amber); color: #fff; }
a { color: inherit; text-decoration: none; }
button { cursor: pointer; font-family: var(--font-body); border: none; color: inherit; }
/* Visible keyboard focus for a11y (mouse clicks don't trigger :focus-visible) */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
a:focus-visible, button:focus-visible, [role="button"]:focus-visible,
input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input, textarea, select { font-family: var(--font-body); font-size: inherit; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--bg-base); }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

@keyframes slideUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
@keyframes sheetUp  { from{transform:translateY(100%)} to{transform:translateY(0)} }
@keyframes fadeUp   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn   { from{opacity:0} to{opacity:1} }
@keyframes slideL   { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
@keyframes spin     { to{transform:rotate(360deg)} }
@keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

.page-enter { animation: slideUp 0.3s ease both; }

/* Landing utilities */
.nav-link { color:var(--text-muted); font-size:.875rem; font-weight:500; text-decoration:none; transition:color 150ms; cursor:pointer; }
.nav-link:hover { color:var(--text-primary); }
.slabel { font-family:var(--fd); font-size:.72rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); display:flex; align-items:center; gap:8px; }
.slabel::before { content:none; }
/* Scroll-reveal — the landing's one signature motion. Sections start soft +
   12px low and settle in as they enter the viewport (IntersectionObserver adds
   .in). Mirrors the hero's fadeUp language; disabled under reduced motion. */
.reveal { opacity:0; transform:translateY(14px); transition:opacity .55s var(--ease), transform .55s var(--ease); }
.reveal.in { opacity:1; transform:none; }
.lcard { background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; padding:28px; box-shadow:none; transition:border-color 200ms var(--ease),transform 200ms var(--ease),box-shadow 200ms var(--ease); }
.lcard:hover { border-color:var(--border-strong); transform:translateY(-2px); box-shadow:var(--shadow-md); }
.photo-card img { transition:transform .55s var(--ease); will-change:transform; }
.photo-card:hover img { transform:scale(1.05); }
.btn-p { background:var(--amber); color:#fff; border:none; padding:13px 26px; border-radius:8px; font-family:var(--fd); font-weight:600; font-size:.95rem; letter-spacing:0; cursor:pointer; box-shadow:none; transition:background 160ms var(--ease); display:inline-flex; align-items:center; gap:7px; }
.btn-p:hover { background:var(--amber2); }
.btn-p:active { transform:translateY(0); }
.btn-p:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
.btn-s { background:var(--bg-surface); color:var(--text-primary); border:1px solid var(--border-strong); padding:13px 26px; border-radius:8px; font-family:var(--fd); font-weight:600; font-size:.95rem; letter-spacing:0; cursor:pointer; transition:border-color 160ms var(--ease); }
.btn-s:hover { border-color:var(--text-primary); background:var(--bg-surface); }
.btn-g { background:transparent; color:var(--text-muted); border:none; padding:10px 18px; font-family:var(--font-body); font-size:.875rem; cursor:pointer; transition:color 150ms; }
.btn-g:hover { color:var(--text-primary); }
/* Corporate ink pill — the Uber-style nav CTA. Inverts with the theme. */
.btn-dark { background:var(--text-primary); color:var(--bg-base); border:none; padding:11px 22px; border-radius:999px; font-family:var(--fd); font-weight:600; font-size:.9rem; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:opacity 160ms var(--ease); }
.btn-dark:hover { opacity:.85; }
/* Black-footer link (footer is ink in BOTH themes, so links can't use theme text tokens) */
.foot-link { color:#b9b9b9 !important; }
.foot-link:hover { color:#ffffff !important; }

/* Corporate task LIST rows (Thumbtack/TaskRabbit results grammar): gradient
   category thumbnail · details · price/status column. Stacks on phones. */
.task-row { display:flex; background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; cursor:pointer; transition:box-shadow 150ms var(--ease), transform 150ms var(--ease); }
.task-row:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); }
.task-row-thumb { flex:0 0 148px; display:flex; align-items:center; justify-content:center; }
.task-row-side { flex:0 0 168px; border-left:1px solid var(--border); padding:16px; display:flex; flex-direction:column; align-items:flex-end; justify-content:space-between; gap:8px; }
@media (max-width:640px) {
  .task-row { flex-direction:column; }
  .task-row-thumb { flex-basis:92px; height:92px; }
  .task-row-side { flex-basis:auto; border-left:none; border-top:1px solid var(--border); flex-direction:row; align-items:center; }
}

/* Top-bar icon buttons (messages, alerts) — hover/active feedback + transitions. */
.icon-btn { transition: background 150ms var(--ease), color 150ms var(--ease), transform 120ms var(--ease); }
.icon-btn:hover { background:var(--bg-elevated) !important; color:var(--accent) !important; }
.icon-btn:active { transform:scale(.92); }
.icon-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
@keyframes notifPulse { 0%,100%{ transform:scale(1) } 50%{ transform:scale(1.18) } }
.notif-badge { animation: notifPulse 1.8s ease-in-out infinite; }

/* Forms */
input, textarea, select { background:var(--bg-surface); border:1px solid var(--border-strong); border-radius:8px; color:var(--text-primary); padding:11px 14px; font-size:.9rem; width:100%; outline:none; transition:border-color 150ms,box-shadow 150ms; }
input:focus, textarea:focus, select:focus { border-color:var(--amber); box-shadow:var(--ring); }
input::placeholder, textarea::placeholder { color:#b3b3b3; }
label { font-family:var(--fd); font-size:.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; display:block; margin-bottom:6px; }

/* Prose */
.prose h2 { font-family:var(--fd); font-size:1.3rem; font-weight:800; margin:32px 0 12px; color:var(--text-primary); }
.prose h3 { font-family:var(--fd); font-size:1.05rem; font-weight:700; margin:24px 0 8px; color:var(--text-primary); }
.prose p  { color:var(--text-secondary); line-height:1.8; margin-bottom:16px; font-size:.925rem; }
.prose ul { color:var(--text-secondary); line-height:1.8; margin-bottom:16px; padding-left:20px; font-size:.925rem; }
.prose li { margin-bottom:6px; }
.prose a  { color:var(--amber); }
.prose .highlight { background:rgba(126,34,206,.08); border:1px solid rgba(126,34,206,.2); border-radius:6px; padding:16px 20px; margin:20px 0; }
.prose .highlight p { color:var(--text-primary); margin:0; }
.prose table { width:100%; border-collapse:collapse; font-size:.875rem; margin-bottom:16px; }
.prose th { text-align:left; padding:8px 12px; font-family:var(--fm); font-size:.62rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:.1em; font-weight:400; border-bottom:1px solid var(--border-strong); }
.prose td { padding:10px 12px; color:var(--text-secondary); border-bottom:1px solid var(--border); }

/* Drawer */
.drawer { position:fixed; top:0; right:0; bottom:0; width:280px; background:var(--bg-surface); border-left:1px solid var(--border-strong); z-index:200; padding:24px; transform:translateX(100%); transition:transform 300ms ease; overflow-y:auto; }
.drawer.open { transform:translateX(0); }
.doverlay { position:fixed; inset:0; background:rgba(19,17,24,.35); z-index:199; opacity:0; pointer-events:none; transition:opacity 300ms; }
.doverlay.open { opacity:1; pointer-events:all; }

/* Modal */
.moverlay { position:fixed; inset:0; background:rgba(19,17,24,.45); display:flex; align-items:center; justify-content:center; z-index:300; padding:16px; animation:fadeIn .2s ease; backdrop-filter:blur(6px); }
.modal { background:var(--bg-surface); border:1px solid var(--border-strong); border-radius:14px; width:100%; max-width:440px; animation:fadeUp .22s ease; overflow:hidden; max-height:92vh; overflow-y:auto; }

/* Responsive */
@media (max-width:768px) {
  .hide-m { display:none !important; }
  .show-m { display:flex !important; }
  .footer-grid { grid-template-columns:1fr 1fr !important; gap:28px !important; }
  .about-grid  { grid-template-columns:1fr !important; gap:36px !important; }
  .steps-grid  { grid-template-columns:1fr !important; }
  .feat-grid   { grid-template-columns:1fr !important; }
  .hero-inner  { flex-direction:column !important; }
  .stats-grid  { grid-template-columns:1fr 1fr !important; }
  .price-grid  { grid-template-columns:1fr !important; }
  .test-grid   { grid-template-columns:1fr !important; }
  .tasks-grid  { grid-template-columns:1fr !important; }
  .page-layout { flex-direction:column !important; }
  .page-sidebar { width:100% !important; border-right:none !important; border-bottom:1px solid var(--border-strong) !important; }
  section { padding-left:20px !important; padding-right:20px !important; }
  /* Dashboard on phones: nav lives in the TopBar hamburger drawer (no bottom bar) */
  .dash-shell   { grid-template-columns:1fr !important; }
  .dash-main    { padding:16px 14px 32px 14px !important; }
}
@media (min-width:769px) {
  .show-m { display:none !important; }
}

/* ── Native PWA feel ── */
body { overscroll-behavior-y: contain; } /* body only — on <html> it interferes with trackpad wheel delta */
button, nav { -webkit-tap-highlight-color: transparent; }
button { touch-action: manipulation; user-select: none; }
button:active { transform: scale(.97); }
.feed-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.feed-scroll::-webkit-scrollbar { display: none; }
@media (max-width:768px) {
  input, textarea, select { font-size: 16px !important; } /* stops iOS auto-zoom */
  .msg-shell { height: calc(100dvh - 150px) !important; }
}

/* Top-bar nav links are desktop-only; the hamburger drawer handles mobile nav */
/* Top-bar nav links are desktop-only; the search bar shows on every size
   (on phones the hidden nav links free up the room for it). */
.topbar-nav { display: none; }
@media (min-width:769px) {
  .topbar-nav { display: flex !important; }
}
/* The Post button stays visible on all sizes, but compresses to just '＋' on phones */
@media (max-width:520px) {
  .topbar-post { font-size: 0 !important; padding: 9px 12px !important; }
  .topbar-post::before { content: '＋'; font-size: 1.05rem; }
}

/* ── Mobile layout fixes ──────────────────────────────────────────────────── */
@media (max-width:768px) {
  /* Unclassed inline grids (e.g. content + fixed sidebar) collapse to one column.
     !important is required to beat the inline grid-template-columns. */
  .stack-mobile { grid-template-columns: 1fr !important; }
  /* The hero is full-height with a hidden visual column on phones — drop the
     100vh so it doesn't leave a screen of empty space below the copy. */
  .hero-section { min-height: auto !important; padding-top: 124px !important; padding-bottom: 48px !important; }
  /* Messages: master-detail → one pane at a time on phones. Show the full-width
     conversation list, and swap to the full-width thread once one is opened
     (the in-thread ← button clears the selection to return to the list). */
  .msg-shell .msg-list            { width: 100% !important; border-right: none !important; }
  .msg-shell .msg-thread          { display: none !important; }
  .msg-shell.has-active .msg-list { display: none !important; }
  .msg-shell.has-active .msg-thread { display: flex !important; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  .reveal { opacity:1 !important; transform:none !important; } /* never hide content from reduced-motion users */
}
`
document.head.appendChild(_style)

// ─── GLOBAL APP STATE ─────────────────────────────────────────────────────────
const AuthCtx  = createContext(null)
const StoreCtx = createContext(null)
const ToastCtx = createContext(null)

function useAuth()  { return useContext(AuthCtx) }
function useStore() { return useContext(StoreCtx) }
function useToast() { return useContext(ToastCtx) }

// True on phone-sized viewports — drives the dedicated mobile design (a separate
// layout, not just responsive tweaks). Reacts to rotation/resize. A coarse-pointer
// UA hint nudges edge cases, but width is the decider so it's predictable + testable.
function useIsMobile(bp = 768) {
  const get = () => { try { return window.innerWidth <= bp } catch { return false } }
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const on = () => setMobile(get())
    on() // sync in case width changed between initial render and mount
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return mobile
}

// Shows a one-off toast stashed in sessionStorage by a pre-render flow (e.g. the
// /verify-student email link handled in App before the toast context exists).
function PendingToast() {
  const toast = useToast()
  useEffect(() => {
    const show = () => {
      let raw; try { raw = sessionStorage.getItem('rl_pending_toast') } catch { return }
      if (!raw) return
      try { sessionStorage.removeItem('rl_pending_toast') } catch { /* ignore */ }
      try { const { msg, kind } = JSON.parse(raw); toast(msg, kind || 'success') } catch { /* ignore */ }
    }
    show()
    window.addEventListener('relivr:pending-toast', show)
    return () => window.removeEventListener('relivr:pending-toast', show)
  }, []) // eslint-disable-line
  return null
}

// Data isolation: the store starts EMPTY. It's an optimistic in-memory layer on
// top of the API, never a source of content — seeding it with mock users' data
// meant a failed fetch could show fictional "other people's" tasks/notifications
// to a real signed-in user.
const initialState = {
  tasks:         [],
  bids:          [],
  notifications: [],
  messages:      [],
  disputes:      [],
  reviews:       [],
  escrows:       {},
}

function appReducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK':              return { ...state, tasks: [action.task, ...state.tasks] }
    case 'UPDATE_TASK':           return { ...state, tasks: state.tasks.map(t => t.task_id === action.task_id ? { ...t, ...action.changes } : t) }
    case 'ADD_BID':               return { ...state, bids: [...state.bids, action.bid] }
    case 'UPDATE_BID':            return { ...state, bids: state.bids.map(b => b.bid_id === action.bid_id ? { ...b, ...action.changes } : b) }
    case 'REJECT_OTHER_BIDS':     return { ...state, bids: state.bids.map(b => b.task_id === action.task_id && b.bid_id !== action.accepted_bid_id ? { ...b, status: 'rejected' } : b) }
    case 'WITHDRAW_BID':          return { ...state, bids: state.bids.map(b => b.bid_id === action.bid_id ? { ...b, status: 'withdrawn' } : b) }
    case 'SET_ESCROW':            return { ...state, escrows: { ...state.escrows, [action.task_id]: { status: action.status } } }
    case 'ADD_NOTIFICATION':      return { ...state, notifications: [action.notification, ...state.notifications] }
    case 'MARK_NOTIFICATION_READ':return { ...state, notifications: state.notifications.map(n => n.notification_id === action.id ? { ...n, is_read: true } : n) }
    case 'MARK_ALL_READ':         return { ...state, notifications: state.notifications.map(n => ({ ...n, is_read: true })) }
    case 'ADD_MESSAGE':           return { ...state, messages: [...state.messages, action.message] }
    case 'ADD_DISPUTE':           return { ...state, disputes: [...state.disputes, action.dispute] }
    case 'UPDATE_DISPUTE':        return { ...state, disputes: state.disputes.map(d => d.dispute_id === action.dispute_id ? { ...d, ...action.changes } : d) }
    case 'ADD_REVIEW':            return { ...state, reviews: [...state.reviews, action.review] }
    default:                      return state
  }
}

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const add = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])
  const remove = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])
  const colors = {
    success: { bg:'rgba(16,185,129,0.15)',  border:'rgba(16,185,129,0.4)',  icon:'✓', color:'var(--success)' },
    error:   { bg:'rgba(239,68,68,0.15)',   border:'rgba(239,68,68,0.4)',   icon:'✗', color:'var(--danger)' },
    info:    { bg:'rgba(59,130,246,0.15)',   border:'rgba(59,130,246,0.4)',  icon:'ℹ', color:'var(--info)' },
    warning: { bg:'rgba(126,34,206,0.15)',  border:'rgba(126,34,206,0.4)',  icon:'⚠', color:'var(--accent)' },
  }
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div style={{ position:'fixed', bottom:28, right:28, display:'flex', flexDirection:'column', gap:10, zIndex:9999, pointerEvents:'none' }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info
          return (
            <div key={t.id} onClick={() => remove(t.id)}
              style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:10, maxWidth:360, pointerEvents:'all', cursor:'pointer', animation:'slideUp 0.25s ease both', backdropFilter:'blur(8px)' }}>
              <span style={{ color:c.color, fontSize:'1rem', flexShrink:0, marginTop:1 }}>{c.icon}</span>
              <span style={{ fontSize:'.875rem', color:'var(--text-primary)', lineHeight:1.5 }}>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES (used by both landing and dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${s/60|0}m ago`
  if (s < 86400) return `${s/3600|0}h ago`
  return `${s/86400|0}d ago`
}

function Spinner({ size = 14 }) {
  return <span style={{ width:size, height:size, border:'2px solid transparent', borderTopColor:'currentColor', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' }} />
}

// The brand mark: a seedling — two leaves on one stem (the poster and the
// earner, one campus economy). Mirrors /logo.svg; keep the two in sync.
// Mirrors the owner's reference mark: two plump leaves, a single curved vein
// slit each, the ink leaf's base sweeping into a tail that hooks under the
// orchid leaf. Leaf paths are base-at-origin so `animate` can spring each leaf
// from its base (SMIL — scales around the local origin, loops natively, and is
// simply not rendered when the user prefers reduced motion).
const LEAF_PATH = `M0,0 C-50,-34 -72,-84 -71,-124 C-70,-186 -38,-226 0,-246 C38,-226 70,-186 71,-124 C72,-84 50,-34 0,0 Z
  M-2,-26 C-14,-78 -12,-158 2,-214 L8,-206 C-3,-156 -4,-84 5,-26 Z`
const TAIL_PATH = 'M264,316 C258,354 238,380 182,396 C224,368 246,344 252,312 Z'
function LogoMark({ size = 30, animate = false, ink }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const anim = animate && !reduced
  const inkFill = ink || 'var(--black, #111111)'
  const leafAnim = (delayFrac) => (
    <animateTransform attributeName="transform" type="scale" additive="sum" dur="2.2s" repeatCount="indefinite"
      values="0.001;0.001;1.08;1;1;0.001"
      keyTimes={`0;${delayFrac};${delayFrac + 0.16};${delayFrac + 0.24};0.87;1`}
      calcMode="spline"
      keySplines="0.4,0,0.2,1; 0.22,0.9,0.36,1; 0.4,0,0.2,1; 0.4,0,0.2,1; 0.4,0,0.6,1" />
  )
  return (
    <svg width={size} height={size} viewBox="104 90 308 318" aria-hidden="true" style={{ flexShrink:0, display:'block' }}>
      {/* ink leaf + its tail spring together around the joint (262,322) */}
      <g transform="translate(262 322)">
        <g>
          {anim && leafAnim(0.06)}
          <g transform="rotate(29)">
            <path fill={inkFill} fillRule="evenodd" d={LEAF_PATH} />
          </g>
          <g transform="translate(-262 -322)"><path fill={inkFill} d={TAIL_PATH} /></g>
        </g>
      </g>
      {/* orchid leaf springs from its own base, a beat later */}
      <g transform="translate(222 292)">
        <g>
          {anim && leafAnim(0.22)}
          <g transform="rotate(-29) scale(0.78)">
            <path fill="#c084fc" fillRule="evenodd" d={LEAF_PATH} />
          </g>
        </g>
      </g>
    </svg>
  )
}

// Full-screen / section loading state: the seedling grows on loop. Replaces the
// bare spinner wherever the wait is long enough to brand (session restore, OAuth).
function LogoLoader({ size = 72, label }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ display:'inline-block' }}><LogoMark size={size} animate /></div>
      {label && <p style={{ marginTop:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</p>}
    </div>
  )
}

function Logo({ onClick, light = false }) {
  // `light` renders the ink leaf + wordmark in white for dark grounds (the
  // corporate black footer is ink in both themes, so tokens can't carry it).
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', flexShrink:0 }}>
      <LogoMark size={32} ink={light ? '#f5f5f5' : undefined} />
      <span style={{ fontFamily:'var(--fd)', fontSize:'1.15rem', fontWeight:800, letterSpacing:'-.02em', color:light ? '#ffffff' : undefined }}>ReLivR</span>
    </div>
  )
}

// ─── DASHBOARD PRIMITIVES ────────────────────────────────────────────────────

function Btn({ children, variant='primary', size='md', loading=false, fullWidth=false, style={}, ...p }) {
  const [hov, setHov] = useState(false)
  const sizes = { sm:{padding:'5px 12px',fontSize:'0.72rem'}, md:{padding:'9px 20px',fontSize:'0.82rem'}, lg:{padding:'13px 28px',fontSize:'0.94rem'} }
  const variants = {
    primary:   { background:hov?'var(--amber2)':'var(--accent)', color:'#fff', transform:hov?'translateY(-1px)':'none', boxShadow:hov?'0 4px 20px var(--accent-glow)':'none' },
    secondary: { background:hov?'var(--bg-hover)':'transparent', color:'var(--text-primary)', border:'1px solid var(--border-strong)' },
    ghost:     { background:hov?'var(--bg-hover)':'transparent', color:hov?'var(--text-primary)':'var(--text-secondary)' },
    danger:    { background:hov?'rgba(239,68,68,0.12)':'transparent', color:'var(--danger)', border:'1px solid var(--danger)' },
    success:   { background:hov?'rgba(16,185,129,0.25)':'rgba(16,185,129,0.15)', color:'var(--success)', border:'1px solid rgba(16,185,129,0.3)' },
    warning:   { background:hov?'rgba(126,34,206,0.2)':'rgba(126,34,206,0.1)', color:'var(--accent)', border:'1px solid rgba(126,34,206,0.3)' },
  }
  const v = variants[variant] || variants.primary
  return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'var(--font-display)', fontWeight:700, letterSpacing:'0.01em', borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'all 150ms ease', whiteSpace:'nowrap', border:'none', ...(fullWidth?{width:'100%'}:{}), ...((loading||p.disabled)?{opacity:0.45,cursor:'not-allowed',transform:'none'}:{}), ...sizes[size], ...v, ...style }}
      disabled={loading||p.disabled} {...p}>
      {loading ? <Spinner /> : children}
    </button>
  )
}

function Input({ label, error, hint, style={}, ...p }) {
  const [focused, setFocused] = useState(false)
  const id = useId()
  const hintId = hint || error ? `${id}-desc` : undefined
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && <label htmlFor={id} style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-secondary)' }}>{label}</label>}
      <input id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={hintId}
        style={{ background:'var(--bg-surface)', border:`1px solid ${error?'var(--danger)':focused?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', outline:'none', width:'100%', fontSize:'0.9rem', boxShadow:focused?'0 0 0 3px var(--accent-glow)':'none', transition:'all 150ms ease', ...style }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...p} />
      {error && <span id={hintId} style={{ fontSize:'0.78rem', color:'var(--danger)' }}>{error}</span>}
      {hint && !error && <span id={hintId} style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{hint}</span>}
    </div>
  )
}

function Textarea({ label, error, hint, style={}, ...p }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && <label style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-secondary)' }}>{label}</label>}
      <textarea style={{ background:'var(--bg-surface)', border:`1px solid ${error?'var(--danger)':focused?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', outline:'none', width:'100%', resize:'vertical', minHeight:100, fontSize:'0.9rem', fontFamily:'var(--font-body)', boxShadow:focused?'0 0 0 3px var(--accent-glow)':'none', transition:'all 150ms ease', ...style }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...p} />
      {hint && !error && <span style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>{hint}</span>}
      {error && <span style={{ fontSize:'0.78rem', color:'var(--danger)' }}>{error}</span>}
    </div>
  )
}

function SelectField({ label, value, onChange, children, style={} }) {
  // Caller `style` (widths/flex) goes on the WRAPPER: it's the row's flex item.
  // Spreading it on the <select> put flex-basis on the column axis and blew the
  // dropdowns up to ~130px tall on phones.
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}>
      {label && <label style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-secondary)' }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ width:'100%', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', fontSize:'0.88rem', outline:'none', cursor:'pointer' }}>{children}</select>
    </div>
  )
}

// A task that's still 'open' but whose bidding window has passed reads as
// "Closed for bidding" everywhere its status shows (the backend already rejects
// late bids with a 409 — this makes that state visible).
function taskState(t) {
  if (t?.status === 'open' && t.bids_close_at && new Date(t.bids_close_at) <= new Date()) {
    return { variant: 'bids_closed', label: 'Closed for bidding' }
  }
  return { variant: t?.status, label: (t?.status || '').replace('_', ' ') }
}

// Capitalize the first letter of each word (underscores → spaces first), for
// filter options and status text — e.g. "in_progress" → "In Progress".
function titleCase(s) {
  return String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Client-side SA ID validation — mirrors server/idnumber.js so users get instant
// feedback. The server re-validates authoritatively; this is UX only.
function saIdCheck(raw) {
  const id = String(raw ?? '').replace(/\D/g, '')
  if (!id) return { ok: false, reason: '' }
  if (id.length !== 13) return { ok: false, reason: 'Must be 13 digits' }
  const mm = +id.slice(2, 4), dd = +id.slice(4, 6)
  if (mm < 1 || mm > 12) return { ok: false, reason: 'Invalid birth month' }
  if (dd < 1 || dd > 31) return { ok: false, reason: 'Invalid birth day' }
  if (id[10] !== '0' && id[10] !== '1') return { ok: false, reason: 'Invalid ID number' }
  let sum = 0, alt = false
  for (let i = id.length - 1; i >= 0; i--) { let d = id.charCodeAt(i) - 48; if (alt) { d *= 2; if (d > 9) d -= 9 } sum += d; alt = !alt }
  if (sum % 10 !== 0) return { ok: false, reason: 'Checksum failed — re-check the number' }
  return { ok: true, reason: '' }
}

// One obvious back control everywhere — replaces the old ghost-text "← Back"
// links that were easy to miss and hard to tap.
function BackButton({ onClick, label='Back', style={} }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 16px 9px 12px', borderRadius:100, border:'1px solid var(--border-strong)', background:'var(--bg-surface)', color:'var(--text-primary)', fontWeight:600, fontSize:'.85rem', fontFamily:'var(--font-body)', cursor:'pointer', boxShadow:'var(--shadow-xs)', transition:'border-color 150ms ease, color 150ms ease', marginBottom:18, ...style }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.color='var(--text-primary)' }}>
      <Icon name="arrow-left" size={16} />{label}
    </button>
  )
}

function Badge({ children, variant='default' }) {
  const map = {
    default:     { background:'var(--bg-elevated)',            color:'var(--text-secondary)' },
    draft:       { background:'rgba(180,83,9,0.12)',           color:'var(--warning)' },
    open:        { background:'rgba(16,185,129,0.15)',         color:'var(--success)' },
    bids_closed: { background:'rgba(180,83,9,0.12)',           color:'var(--warning)' },
    in_progress: { background:'rgba(59,130,246,0.15)',         color:'var(--info)' },
    disputed:    { background:'rgba(239,68,68,0.15)',          color:'var(--danger)' },
    completed:   { background:'rgba(126,34,206,0.15)',         color:'var(--accent)' },
    expired:     { background:'var(--bg-elevated)',            color:'var(--text-muted)' },
    admin:       { background:'rgba(239,68,68,0.15)',          color:'var(--danger)' },
    earner:      { background:'rgba(16,185,129,0.15)',         color:'var(--success)' },
    creator:     { background:'rgba(126,34,206,0.15)',         color:'var(--accent)' },
    pending:     { background:'rgba(59,130,246,0.12)',         color:'var(--info)' },
    accepted:    { background:'rgba(16,185,129,0.15)',         color:'var(--success)' },
    rejected:    { background:'var(--bg-elevated)',            color:'var(--text-muted)' },
    withdrawn:   { background:'var(--bg-elevated)',            color:'var(--text-muted)' },
  }
  const v = map[variant] || map.default
  // Title-case (first letter capitalised) rather than shouty ALL-CAPS.
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-mono)', fontSize:'0.63rem', fontWeight:600, letterSpacing:'0.04em', textTransform:'capitalize', ...v }}>{children}</span>
}

function DCard({ children, style={}, onClick, hover=true, className='' }) {
  const [hov, setHov] = useState(false)
  // Redesign: only genuinely-clickable cards LIFT (feedback should match affordance);
  // non-interactive cards get a quiet border emphasis instead of a template-y float.
  const interactive = hover && !!onClick
  return (
    <div className={className} onClick={onClick} onMouseEnter={() => hover&&setHov(true)} onMouseLeave={() => hover&&setHov(false)}
      style={{ background:'var(--bg-surface)', border:`1px solid ${hov?'var(--border-strong)':'var(--border)'}`, borderRadius:'var(--radius-md)', padding:20, transition:'transform 150ms var(--ease), box-shadow 150ms var(--ease), border-color 150ms var(--ease)', ...(interactive&&hov?{transform:'translateY(-2px)',boxShadow:'var(--shadow-md)'}:{}), ...(onClick?{cursor:'pointer'}:{}), ...style }}>
      {children}
    </div>
  )
}

function Tag({ children }) {
  return <span style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:'0.62rem', letterSpacing:'0.06em', textTransform:'uppercase', padding:'2px 8px', borderRadius:'var(--radius-sm)' }}>{children}</span>
}

function Mono({ children, color='var(--text-muted)', size='0.72rem', style={} }) {
  return <span style={{ fontFamily:'var(--font-mono)', fontSize:size, color, letterSpacing:'0.06em', textTransform:'uppercase', ...style }}>{children}</span>
}

function Stars({ rating, interactive=false, onRate }) {
  const [hov, setHov] = useState(0)
  const r = Number(rating) || 0
  const display = hov || r
  return (
    <span style={{ fontFamily:'var(--font-mono)', fontSize:'1rem', color:'var(--warning)', cursor:interactive?'pointer':'default', letterSpacing:2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onMouseEnter={() => interactive&&setHov(i)} onMouseLeave={() => interactive&&setHov(0)} onClick={() => interactive&&onRate&&onRate(i)}
          style={{ color:i<=display?'var(--warning)':'var(--border-strong)', transition:'color 100ms ease' }}>★</span>
      ))}
      {!interactive && <span style={{ color:'var(--text-muted)', marginLeft:4, fontSize:'0.75rem' }}>{r.toFixed(1)}</span>}
    </span>
  )
}

function Divider({ style={} }) { return <div style={{ height:1, background:'var(--border)', width:'100%', ...style }} /> }

function PageTitle({ children, sub }) {
  return (
    <div style={{ marginBottom:28 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.55rem, 4.5vw, 2.4rem)', fontWeight:700, letterSpacing:'-0.01em', lineHeight:1.05 }}>{children}</h1>
      {sub && <Mono style={{ marginTop:6, display:'block' }}>{sub}</Mono>}
    </div>
  )
}

function EmptyState({ icon='inbox', message, action }) {
  return (
    <div style={{ textAlign:'center', padding:'56px 24px' }}>
      <div style={{ width:60, height:60, margin:'0 auto 14px', borderRadius:'50%', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', color:'var(--text-muted)' }}>{hasIcon(icon) ? <Icon name={icon} size={26} color="var(--text-muted)" /> : icon}</div>
      <Mono style={{ display:'block', marginBottom:action?18:0, maxWidth:320, marginLeft:'auto', marginRight:'auto', lineHeight:1.6 }}>{message}</Mono>
      {action && action}
    </div>
  )
}

function StatCard({ label, value, accent=false }) {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ flex:1, minWidth:130, position:'relative', overflow:'hidden', background:accent?'linear-gradient(160deg, var(--bg-surface), var(--accent-dim))':'var(--bg-surface)', border:`1px solid ${accent?'var(--accent-dim)':'var(--border)'}`, borderRadius:'var(--radius-md)', padding:'18px 20px', boxShadow:hov?'var(--shadow-md)':'var(--shadow-xs)', transform:hov?'translateY(-2px)':'none', transition:'box-shadow 180ms var(--ease), transform 180ms var(--ease)' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg, var(--accent), var(--amber2))', opacity:accent?1:0 }} />
      <Mono style={{ display:'block', marginBottom:10, color:'var(--text-muted)' }}>{label}</Mono>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'2.1rem', fontWeight:800, color:accent?'var(--accent)':'var(--text-primary)', lineHeight:1, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{value}</div>
    </div>
  )
}

function Modal({ open, onClose, title, children, maxWidth=480 }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const isMobile = useIsMobile()
  useEffect(() => { if (open) document.body.style.overflow='hidden'; else document.body.style.overflow=''; return () => { document.body.style.overflow='' } }, [open])
  // a11y: close on Escape, and move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.activeElement
    dialogRef.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  // On phones the dialog becomes a native-feeling bottom sheet: full-width, slides
  // up from the bottom, rounded top, drag-handle, and scrolls if it's tall.
  const overlayStyle = { position:'fixed', inset:0, background:'rgba(19,17,24,.45)', display:'flex', zIndex:1000, backdropFilter:'blur(4px)', animation:'fadeIn 0.2s ease',
    ...(isMobile ? { alignItems:'flex-end' } : { alignItems:'center', justifyContent:'center', padding:20 }) }
  const dialogStyle = isMobile
    ? { background:'var(--bg-surface)', borderTop:'1px solid var(--border-strong)', borderTopLeftRadius:'var(--radius-xl)', borderTopRightRadius:'var(--radius-xl)', width:'100%', maxHeight:'92vh', display:'flex', flexDirection:'column', animation:'sheetUp 0.28s cubic-bezier(.32,.72,0,1) both', overflow:'hidden', outline:'none' }
    : { background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, animation:'slideUp 0.2s ease both', overflow:'hidden', outline:'none' }
  return (
    <div onClick={onClose} style={overlayStyle}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={e => e.stopPropagation()} style={dialogStyle}>
        {isMobile && <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 2px', flexShrink:0 }}><span style={{ width:38, height:4, borderRadius:2, background:'var(--border-strong)' }} /></div>}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <span id={titleId} style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', letterSpacing:'-0.01em' }}>{title}</span>
          <button onClick={onClose} aria-label="Close dialog" style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.2rem', cursor:'pointer', lineHeight:1, padding:'2px 6px', borderRadius:'var(--radius-sm)' }}>✕</button>
        </div>
        <div style={{ padding:24, ...(isMobile ? { overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'calc(24px + env(safe-area-inset-bottom))' } : {}) }}>{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel='Confirm', confirmVariant='primary', loading=false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={400}>
      <p style={{ color:'var(--text-secondary)', lineHeight:1.65, marginBottom:24 }}>{message}</p>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
        <Btn variant={confirmVariant} onClick={onConfirm} loading={loading}>{confirmLabel}</Btn>
      </div>
    </Modal>
  )
}

function StepBar({ steps, current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:28 }}>
      {steps.map((s, i) => {
        const done = i < current, active = i === current
        return (
          <React.Fragment key={s}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontSize:'0.72rem', fontWeight:700, background:done?'var(--success)':active?'var(--accent)':'var(--bg-elevated)', color:done||active?'#000':'var(--text-muted)', border:`1px solid ${done?'var(--success)':active?'var(--accent)':'var(--border)'}`, transition:'all 300ms ease' }}>
                {done?'✓':i+1}
              </div>
              <Mono size="0.62rem" color={active?'var(--accent)':done?'var(--success)':'var(--text-muted)'}>{s}</Mono>
            </div>
            {i < steps.length-1 && <div style={{ flex:1, height:1, background:i<current?'var(--success)':'var(--border)', margin:'0 8px', marginBottom:20, transition:'background 300ms ease' }} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE — NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════

function LandingNavbar({ onOpenAuth, onNav, user, onEnterApp }) {
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const navItems = [
    { label:'How It Works', href:'#how-it-works' },
    { label:'Features',     href:'#features' },
    { label:'Pricing',      href:'#pricing' },
    { label:'About',        href:'#about' },
  ]

  const infoPages = [
    { label:'Trust & Safety',   page:'trust-safety' },
    { label:'Help Centre',      page:'help-centre' },
    { label:'Terms of Service', page:'terms' },
    { label:'Privacy Policy',   page:'privacy' },
  ]

  return (
    <>
      <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:100 }}>
      <div style={{ background:'var(--text-primary)', color:'var(--bg-base)', textAlign:'center', padding:'7px 16px', fontSize:'.8rem', fontFamily:'var(--fb)', fontWeight:600, lineHeight:1.45 }}>
        ReLivR is in <strong>beta</strong> — full launch 7 July 2026.<span className="hide-m"> Your feedback shapes what we build.</span> Secure escrow payments coming soon.
      </div>
      <nav style={{ background:'var(--bg-base)', borderBottom:'1px solid var(--border)', boxShadow:scrolled?'var(--shadow-sm)':'none', transition:'box-shadow 300ms ease', padding:'0 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:68 }}>
          <Logo onClick={() => onNav('home')} />
          <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:28 }}>
            {navItems.map(item => <a key={item.label} href={item.href} className="nav-link" style={{ color:'var(--text-primary)' }}>{item.label}</a>)}
          </div>
          <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:10 }}>
            {user ? (
              <button className="btn-dark" onClick={onEnterApp}>Open App →</button>
            ) : (
              <>
                <button className="btn-g" style={{ color:'var(--text-primary)', fontWeight:600 }} onClick={() => onOpenAuth('login')}>Log in</button>
                <button className="btn-dark" onClick={() => onOpenAuth('register')}>Sign up</button>
              </>
            )}
          </div>
          <button className="show-m" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-haspopup="menu"
            style={{ background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer', fontSize:'1.4rem', padding:8 }}><span aria-hidden="true">☰</span></button>
        </div>
      </nav>
      </div>

      <div className={`doverlay ${drawerOpen?'open':''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`drawer ${drawerOpen?'open':''}`}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
          <Logo onClick={() => { onNav('home'); setDrawerOpen(false) }} />
          <button onClick={() => setDrawerOpen(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column' }}>
          {navItems.map(item => (
            <a key={item.label} href={item.href} className="nav-link" onClick={() => setDrawerOpen(false)}
              style={{ padding:'13px 0', borderBottom:'1px solid var(--border)', fontSize:'1rem' }}>{item.label}</a>
          ))}
          {infoPages.map(item => (
            <button key={item.label} onClick={() => { onNav(item.page); setDrawerOpen(false) }}
              style={{ background:'none', border:'none', borderBottom:'1px solid var(--border)', color:'var(--text-muted)', padding:'13px 0', fontSize:'.875rem', textAlign:'left', cursor:'pointer' }}>{item.label}</button>
          ))}
        </div>
        <div style={{ marginTop:28, display:'flex', flexDirection:'column', gap:10 }}>
          {user ? (
            <button className="btn-p" style={{ justifyContent:'center' }} onClick={() => { onEnterApp(); setDrawerOpen(false) }}>Open App →</button>
          ) : (
            <>
              <button className="btn-s" onClick={() => { onOpenAuth('login'); setDrawerOpen(false) }}>Sign In</button>
              <button className="btn-p" style={{ justifyContent:'center' }} onClick={() => { onOpenAuth('register'); setDrawerOpen(false) }}>Get Started →</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── LANDING FOOTER ───────────────────────────────────────────────────────────

function LandingFooter({ onNav }) {
  const links = {
    Product: [
      { label:'How It Works',   page:'how-it-works-page' },
      { label:'Features',       page:'features-page' },
      { label:'Pricing',        page:'pricing-page' },
      { label:'Trust & Safety', page:'trust-safety' },
    ],
    Legal: [
      { label:'Terms of Service', page:'terms' },
      { label:'Privacy Policy',   page:'privacy' },
      { label:'Cookie Policy',    page:'cookies' },
      { label:'POPIA Compliance', page:'popia' },
    ],
    Support: [
      { label:'Help Centre',          page:'help-centre' },
      { label:'Contact Us',           page:'contact' },
      { label:'Report an Issue',      page:'report' },
      { label:'Community Guidelines', page:'guidelines' },
    ],
    Company: [
      { label:'About',             page:'about-page' },
      { label:'Blog',              page:'blog' },
      { label:'Careers',           page:'careers' },
      { label:'Rhodes University', page:null, href:'https://www.ru.ac.za' },
    ],
  }
  return (
    /* Corporate black footer (Uber grammar) — ink in BOTH themes, so colors are
       literal here rather than theme tokens. Links use .foot-link. */
    <footer style={{ padding:'64px 24px 32px', background:'#111111', color:'#b9b9b9' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="footer-grid" style={{ display:'grid', gridTemplateColumns:'2fr repeat(4,1fr)', gap:44, marginBottom:48 }}>
          <div>
            <Logo onClick={() => onNav('home')} light />
            <p style={{ fontSize:'.875rem', color:'#b9b9b9', lineHeight:1.75, maxWidth:240, margin:'14px 0 16px' }}>The local services marketplace for South African communities.</p>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:'#8a8a8a', textTransform:'uppercase', letterSpacing:'.08em' }}>Proudly South African</div>
          </div>
          {Object.entries(links).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize:'.74rem', fontWeight:700, color:'#ffffff', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:16 }}>{cat}</div>
              {items.map(item => (
                <div key={item.label} style={{ marginBottom:10 }}>
                  <button onClick={() => item.page ? onNav(item.page) : item.href && window.open(item.href,'_blank')}
                    className="foot-link" style={{ background:'none', border:'none', fontSize:'.875rem', padding:0, textAlign:'left', cursor:'pointer', transition:'color 150ms' }}>{item.label}</button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid #2c2c2c', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <span style={{ fontSize:'.8rem', color:'#8a8a8a' }}>© 2026 ReLivR (Pty) Ltd · Makhanda, Eastern Cape</span>
          <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
            <button onClick={openCookiePrefs} className="foot-link" style={{ background:'none', border:'none', padding:0, fontSize:'.8rem', cursor:'pointer' }}>Cookie preferences</button>
            <span style={{ fontSize:'.8rem', color:'#8a8a8a' }}>POPIA Compliant</span>
            <span style={{ fontSize:'.8rem', color:'#8a8a8a', display:'inline-flex', alignItems:'center', gap:6 }}>
              <Icon name="globe" size={13} color="#8a8a8a" />English (ZA) · R ZAR
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── AUTH MODAL (unified — used from landing + dashboard sign out) ────────────

// "What brings you to ReLivR?" — the one onboarding question that tailors the
// rest (walkthrough slides, which profile fields we ask for). Shared by the
// email signup (step 2) and the Google post-OAuth onboarding modal.
const INTENT_OPTIONS = [
  { value:'post', icon:'＋', label:'Get things done',  desc:'Post tasks, receive offers' },
  { value:'earn', icon:'◈', label:'Earn money',       desc:'Bid on tasks, build a rep' },
  { value:'both', icon:'⇄', label:'Both',             desc:'The full local economy' },
]
function IntentChips({ value, onChange }) {
  return (
    <div>
      <label>What brings you to ReLivR?</label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:6 }}>
        {INTENT_OPTIONS.map(o => {
          const on = value === o.value
          return (
            <button key={o.value} type="button" onClick={() => onChange(on ? '' : o.value)} aria-pressed={on}
              style={{ padding:'12px 8px', borderRadius:12, cursor:'pointer', textAlign:'center', transition:'all 150ms var(--ease)',
                       border:`1.5px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
                       background:on ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                       boxShadow:on ? 'var(--ring)' : 'none' }}>
              <div style={{ fontSize:'1.15rem', color:on ? 'var(--accent)' : 'var(--text-secondary)', lineHeight:1, marginBottom:6 }}>{o.icon}</div>
              <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:'.78rem', color:on ? 'var(--accent)' : 'var(--text-primary)', lineHeight:1.2 }}>{o.label}</div>
              <div style={{ fontSize:'.62rem', color:'var(--text-muted)', marginTop:3, lineHeight:1.3 }}>{o.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AuthModal({ mode, onClose, onSwitch, onLogin }) {
  const { loginWithGoogle } = useAuth()
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('member')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')
  // Two-step registration: step 1 = account essentials, step 2 = marketplace profile
  const [step, setStep]         = useState(1)
  const [consent, setConsent]   = useState(false)
  const [phone, setPhone]       = useState('')
  const [campus, setCampus]     = useState('')
  const [skills, setSkills]     = useState('')
  const [bio, setBio]           = useState('')
  const [intent, setIntent]     = useState('')
  const [idNumber, setIdNumber] = useState('')
  const idState = saIdCheck(idNumber)

  const CAMPUS_ZONES = useLocations()

  // Reset to step 1 whenever the modal mode flips (login ⇄ register)
  useEffect(() => { setStep(1); setError('') }, [mode])

  function validateStep1() {
    if (mode==='register' && !name.trim()) return 'Please enter your name'
    if (!email.includes('@')) return 'Enter a valid email address'
    if (password.length < 8)  return 'Password must be at least 8 characters'
    if (mode==='register' && !idState.ok) return idState.reason ? `ID number: ${idState.reason.toLowerCase()}` : 'Please enter your 13-digit SA ID number'
    if (mode==='register' && !consent) return 'Please accept the Terms and Privacy Policy to continue'
    return null
  }

  async function submit(e) {
    e.preventDefault()

    // Registration step 1 → validate essentials, then advance to step 2 (no API call yet)
    if (mode === 'register' && step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setError(''); setStep(2)
      return
    }

    // Login validates the same essentials inline
    if (mode === 'login') {
      if (!email.includes('@')) { setError('Enter a valid email address'); return }
      if (!password)            { setError('Enter your password'); return }
    }

    setError(''); setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const body     = mode === 'login'
        ? { email, password }
        : {
            email, password, role,
            displayName: name || email.split('@')[0],
            phoneNumber: phone || null,
            campusZone:  campus || null,
            skills:      skills || null,
            bio:         bio || null,
            intent:      intent || null,
            idNumber:    idNumber.replace(/\D/g, ''),
            popiaConsent: consent,
          }

      // Generous timeout: a cold serverless DB (Neon) can make the first request
      // after an idle period take several seconds. 5s used to abort and silently
      // drop into a fake "demo" session whose token couldn't call the API.
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), 25000)
      const res  = await fetch(API_BASE + endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      })
      clearTimeout(tid)
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Remember the signup intent locally — the walkthrough tailors its slides to it.
      if (mode === 'register' && intent) { try { localStorage.setItem('rl_intent', intent) } catch { /* ignore */ } }

      // Pass token + user info to handleLogin in App root
      onLogin({
        token:       data.token,
        userId:      data.user.userId      || data.user.user_id,
        email:       data.user.email,
        role:        data.user.role,
        displayName: data.user.displayName || data.user.display_name || email.split('@')[0],
        avatarUrl:   data.user.avatarUrl   || data.user.avatar_url   || null,
      })
      onClose()
    } catch (err) {
      // Real failure — surface it. NEVER fake a session: a bogus token can't call
      // the API, so the user would look signed in but see nothing load.
      const msg = err.name === 'AbortError'
        ? 'The server took too long to respond. Please try again in a moment.'
        : 'Couldn’t reach the server. Check your connection and try again.'
      setError(msg)
      setLoading(false)
      return
    } finally {
      setLoading(false)
    }
  }

  // loginWithGoogle comes from AuthCtx (defined in App root)
  // It redirects to /auth/google → Vite proxies to localhost:3001 → Google consent screen

  return (
    <div className="moverlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={mode==='login' ? 'Sign in' : 'Create your account'} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'var(--fd)', fontSize:'1.25rem', fontWeight:800 }}>{mode==='login'?'Welcome back':(step===1?'Create your account':'Set up your profile')}</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', marginTop:2 }}>{mode==='register' ? `ReLivR · Step ${step} of 2` : 'ReLivR · Your community'}</div>
          </div>
          <button onClick={onClose} aria-label="Close dialog" style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem', padding:'4px 8px' }}>✕</button>
        </div>

        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:13 }}>

          {/* Step 2 has no Google button — account creation is already underway */}
          {!(mode==='register' && step===2) && (
          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={googleLoading || loading}
            style={{ width:'100%', padding:'11px 14px', background:'var(--bg-elevated)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 150ms ease', opacity:(googleLoading||loading)?0.5:1 }}
            onMouseEnter={e => { if (!googleLoading && !loading) { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.borderColor='var(--accent)' } }}
            onMouseLeave={e => { e.currentTarget.style.background='var(--bg-elevated)'; e.currentTarget.style.borderColor='var(--border-strong)' }}>
            {googleLoading ? <Spinner /> : (
              <>
                {/* Official Google "G" logo colours */}
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {mode==='login' ? 'Sign in with Google' : 'Sign up with Google'}
              </>
            )}
          </button>

          )}

          {/* ── Divider between Google and email form ── */}
          {!(mode==='register' && step===2) && (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
            <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em' }}>{mode==='login' ? 'or continue with email' : 'or sign up with email'}</span>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>
          )}

          {/* ── Email / password form ── */}
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:13 }}>

            {/* ===== LOGIN ===== */}
            {mode==='login' && (
              <>
                <div><label>Email</label><input type="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ru.ac.za" required /></div>
                <div><label>Password</label><input type="password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
              </>
            )}

            {/* ===== REGISTER · STEP 1 — essentials ===== */}
            {mode==='register' && step===1 && (
              <>
                <div><label>Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Thabo Mkhize" required /></div>
                <div>
                  <label>Email</label><input type="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ru.ac.za" required />
                  <div style={{ fontSize:'.72rem', color:'var(--text-muted)', marginTop:5, lineHeight:1.45 }}>
                    🎓 Use your <strong style={{ color:'var(--text-secondary)' }}>@ru.ac.za</strong> address — verified students unlock student-only deals.
                  </div>
                </div>
                <div><label>Password <span style={{ color:'var(--text-muted)' }}>(min 8 chars)</span></label><input type="password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
                <div>
                  <label>SA ID number</label>
                  <input aria-label="SA ID number" inputMode="numeric" maxLength={16} value={idNumber}
                    onChange={e => setIdNumber(e.target.value)} placeholder="13-digit South African ID"
                    style={{ borderColor: idNumber && !idState.ok ? 'var(--danger)' : (idState.ok ? 'var(--success)' : undefined) }} required />
                  <div style={{ fontSize:'.72rem', marginTop:5, lineHeight:1.45, color: idNumber && !idState.ok ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {idNumber && !idState.ok
                      ? idState.reason
                      : idState.ok
                        ? '✓ Valid ID number'
                        : '🔒 Verifies you\'re a real person. Encrypted at rest — never shown to anyone.'}
                  </div>
                </div>
                <label style={{ display:'flex', gap:8, alignItems:'flex-start', cursor:'pointer' }}>
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width:'auto', marginTop:3, flexShrink:0, accentColor:'var(--accent)' }} />
                  <span style={{ fontSize:'.76rem', color:'var(--text-secondary)', lineHeight:1.5 }}>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color:'var(--accent)', fontWeight:600, textDecoration:'underline' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color:'var(--accent)', fontWeight:600, textDecoration:'underline' }}>Privacy Policy</a>, and consent to ReLivR processing my data under POPIA.</span>
                </label>
              </>
            )}

            {/* ===== REGISTER · STEP 2 — the onboarding questions ===== */}
            {mode==='register' && step===2 && (
              <>
                <IntentChips value={intent} onChange={setIntent} />
                <div>
                  <label>Your area / neighbourhood</label>
                  <select value={campus} onChange={e => setCampus(e.target.value)}>
                    <option value="">Select your area…</option>
                    {CAMPUS_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <div style={{ fontSize:'.72rem', color:'var(--text-muted)', marginTop:5 }}>Helps match you with tasks and deals near you.</div>
                </div>
                <div><label>Phone number <span style={{ color:'var(--text-muted)' }}>(optional)</span></label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 ..." /></div>
                {/* Skills/bio only matter for earners — keep the posting path frictionless */}
                {intent !== 'post' && (
                  <>
                    <div><label>Your skills <span style={{ color:'var(--text-muted)' }}>(comma separated)</span></label><input value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. python, tutoring, design" /></div>
                    <div><label>Short bio <span style={{ color:'var(--text-muted)' }}>(optional)</span></label>
                      <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell others what you’re good at…" style={{ resize:'vertical' }} />
                    </div>
                  </>
                )}
                <p style={{ fontSize:'.76rem', color:'var(--text-muted)', lineHeight:1.5, margin:0 }}>
                  Everything here is optional — skip it and finish later in your profile.
                </p>
              </>
            )}

            {error && <div style={{ background:'rgba(185,28,28,.08)', border:'1px solid rgba(185,28,28,.25)', borderRadius:8, padding:'9px 13px', fontSize:'.82rem', color:'var(--red)' }}>{error}</div>}

            {/* Action buttons */}
            {mode==='register' && step===2 ? (
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={() => { setError(''); setStep(1) }} className="btn-s" style={{ flex:'0 0 auto', justifyContent:'center' }}>← Back</button>
                <button type="submit" className="btn-p" style={{ flex:1, justifyContent:'center' }} disabled={loading || googleLoading}>
                  {loading ? <Spinner /> : 'Create account →'}
                </button>
              </div>
            ) : (
              <button type="submit" className="btn-p" style={{ width:'100%', justifyContent:'center', marginTop:4 }} disabled={loading || googleLoading}>
                {loading ? <Spinner /> : mode==='login' ? 'Sign in →' : 'Continue →'}
              </button>
            )}

            {/* Skip link on step 2 — lets them finish profile later (low friction) */}
            {mode==='register' && step===2 && (
              <button type="button" onClick={submit} disabled={loading}
                style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'.8rem', cursor:'pointer', textDecoration:'underline' }}>
                Skip for now
              </button>
            )}
            <div style={{ textAlign:'center', fontSize:'.85rem', color:'var(--text-secondary)' }}>
              {mode==='login'?'No account? ':'Have an account? '}
              <button type="button" onClick={onSwitch} style={{ background:'none', border:'none', color:'var(--amber)', cursor:'pointer', fontSize:'inherit' }}>
                {mode==='login'?'Sign up free':'Sign in'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GOOGLE ONBOARDING (post-OAuth) ───────────────────────────────────────────
// OAuth signup can't ask questions, so first-time Google users get this modal
// right after the redirect: POPIA consent (legally required before we process
// their data) + the same onboarding questions email signups answer in step 2.
// One call to POST /auth/onboarding completes it; skippable except consent.
function GoogleOnboardingModal({ user, onDone }) {
  const [consent, setConsent] = useState(false)
  const [intent, setIntent]   = useState('')
  const [campus, setCampus]   = useState('')
  const [phone, setPhone]     = useState('')
  const [skills, setSkills]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const CAMPUS_ZONES = useLocations()
  const needsConsent = user.popia_consent === false
  const firstName = (user.displayName || '').split(' ')[0] || 'there'

  async function finish(skipAll) {
    if (needsConsent && !consent) { setError('Please accept the Terms and Privacy Policy to continue'); return }
    setError(''); setLoading(true)
    try {
      const body = skipAll
        ? { popiaConsent: needsConsent ? consent : undefined }
        : { popiaConsent: needsConsent ? consent : undefined,
            intent: intent || null, campusZone: campus || null,
            phoneNumber: phone || null, skills: skills || null }
      const res = await fetch(API_BASE + '/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${localStorage.getItem('rl_token')}` },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message || 'Something went wrong. Please try again.'); setLoading(false); return }
      if (!skipAll && intent) { try { localStorage.setItem('rl_intent', intent) } catch { /* ignore */ } }
      onDone()
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="moverlay">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Finish setting up your account">
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
            : <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--accent-glow)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontWeight:800, flexShrink:0 }}>{firstName.charAt(0).toUpperCase()}</div>}
          <div>
            <div style={{ fontFamily:'var(--fd)', fontSize:'1.2rem', fontWeight:800 }}>Welcome, {firstName} 👋</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', marginTop:2 }}>ReLivR · One quick step</div>
          </div>
        </div>
        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:13 }}>
          <p style={{ fontSize:'.85rem', color:'var(--text-secondary)', lineHeight:1.55, margin:0 }}>
            Your Google account is connected. Tell us a little about you so ReLivR fits your life — it takes 20 seconds.
          </p>
          <IntentChips value={intent} onChange={setIntent} />
          <div>
            <label>Campus residence / area</label>
            <select value={campus} onChange={e => setCampus(e.target.value)}>
              <option value="">Select your area…</option>
              {CAMPUS_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div><label>Phone number <span style={{ color:'var(--text-muted)' }}>(optional)</span></label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 ..." /></div>
          {intent !== 'post' && (
            <div><label>Your skills <span style={{ color:'var(--text-muted)' }}>(comma separated)</span></label><input value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. python, tutoring, design" /></div>
          )}
          {needsConsent && (
            <label style={{ display:'flex', gap:8, alignItems:'flex-start', cursor:'pointer' }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width:'auto', marginTop:3, flexShrink:0, accentColor:'var(--accent)' }} />
              <span style={{ fontSize:'.76rem', color:'var(--text-secondary)', lineHeight:1.5 }}>I agree to the <span style={{ color:'var(--accent)', fontWeight:600 }}>Terms of Service</span> and <span style={{ color:'var(--accent)', fontWeight:600 }}>Privacy Policy</span>, and consent to ReLivR processing my data under POPIA.</span>
            </label>
          )}
          {error && <div style={{ background:'rgba(185,28,28,.08)', border:'1px solid rgba(185,28,28,.25)', borderRadius:8, padding:'9px 13px', fontSize:'.82rem', color:'var(--red)' }}>{error}</div>}
          <button type="button" className="btn-p" style={{ width:'100%', justifyContent:'center' }} disabled={loading} onClick={() => finish(false)}>
            {loading ? <Spinner /> : 'Finish setup →'}
          </button>
          <button type="button" onClick={() => finish(true)} disabled={loading}
            style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'.8rem', cursor:'pointer', textDecoration:'underline' }}>
            Skip for now{needsConsent ? ' (consent still required)' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// Illustrative examples of typical campus tasks — deliberately NOT dressed up as
// live data (no fake timestamps): pre-launch there are no real tasks to show.
const TASK_EXAMPLES = [
  { title:'Fix Python script crashing on import', budget:'R180', tags:['python','debugging'] },
  { title:'Proofread 3000-word essay',            budget:'R120', tags:['writing','editing'] },
  { title:'Laundry pickup & delivery',            budget:'R80',  tags:['errands','delivery'] },
  { title:'React component for a booking widget', budget:'R350', tags:['react','javascript'] },
  { title:'Guitar lesson — 1 hour',               budget:'R150', tags:['music','tutoring'] },
  { title:'Translate doc Zulu → English',         budget:'R200', tags:['translation','lang'] },
]

const FEATURES_DATA = [
  { icon:'zap',     title:'Post in 60 Seconds',   desc:'Describe your task, set a budget, and go live instantly. No lengthy forms, no approval process.' },
  { icon:'target',  title:'Smart Matching',       desc:'Our engine surfaces your task to earners with the exact skills you need — automatically.' },
  { icon:'lock',    title:'Escrow — Coming Soon', desc:'Secure held-until-done payments are on the roadmap. During beta, you agree a price and settle directly.' },
  { icon:'shield',  title:'Trust Scores',         desc:'Every user builds a verified reputation. Know who you\'re working with before you commit.' },
  { icon:'message', title:'Built-in Messaging',   desc:'Negotiate, clarify, and collaborate — all in one place without switching apps.' },
  { icon:'scale',   title:'Dispute Resolution',   desc:'If something goes wrong, our admin team steps in. Fair outcomes, every time.' },
]

const STEPS_DATA = [
  { n:'01', role:'Creator', color:'var(--amber)', title:'Post Your Task',      desc:'Describe what you need, set a budget, add skill tags. Your task goes live immediately.' },
  { n:'02', role:'Earner',  color:'var(--green)', title:'Submit a Bid',        desc:'Browse tasks matching your skills. Write a pitch, name your price, and submit.' },
  { n:'03', role:'Creator', color:'var(--amber)', title:'Accept a Bid', desc:'Review bids and pick the best fit. Secure escrow payments are coming soon — for now, arrange payment with your earner directly.' },
  { n:'04', role:'Both',    color:'var(--purple)',title:'Work & Release',      desc:'Communicate through the platform. When done, release payment. Both sides win.' },
]

// Batch 6: the second "How it works" track — for businesses listing on ReLivR.
const BIZ_STEPS_DATA = [
  { n:'01', title:'List your business',      desc:'Create your free page — photos, hours, contact, and your area. It shows up in the Local directory.' },
  { n:'02', title:'Add catalog & deals',     desc:'List what you sell and post limited-time specials. Student-only deals reach verified students.' },
  { n:'03', title:'Boost & share your QR',   desc:'Promote your page to the top of Local, and print your QR so anyone can open it in a single tap.' },
  { n:'04', title:'Grow with trust',         desc:'Collect reviews, watch views and followers in Analytics, and turn one-off customers into regulars.' },
]

const STATS_DATA = [
  { v:'R0',   l:'Cost to Start' },
  { v:'Beta', l:'Free While in Beta' },
  { v:'24h',  l:'Avg First Bid Time' },
  { v:'Soon', l:'Secure Escrow Coming' },
]

// Honest pre-launch social proof: scenario cards, not invented testimonials.
// Swap for real founding-member quotes (with consent) once the beta produces them.
const SCENARIOS_DATA = [
  { icon:'code',  who:'The skilled',  title:'Turn your skills into extra income', text:'Debug a script between meetings. Build a component over the weekend. Your skills are already valuable — you just haven\'t invoiced them yet.' },
  { icon:'clock', who:'The swamped',  title:'Buy back your afternoon',            text:'Laundry run, essay proofread, groceries collected — post it in a minute and get your hours back for the things only you can do.' },
  { icon:'users', who:'The neighbour', title:'Trade with people you can trust',    text:'Everyone here builds a public track record with every task, and can verify their identity and university. Not a stranger from the internet.' },
]

function CampusStrip() {
  const slots = [
    { img:'/img/campus-tech.webp',     caption:'Tech help, same day', tag:'Tech & Coding' },
    { img:'/img/campus-errands.webp',  caption:'Errands, sorted',     tag:'Errands' },
    { img:'/img/campus-tutoring.webp', caption:'Skills, shared',      tag:'Tutoring' },
  ]
  return (
    <section className="reveal" style={{ padding:'clamp(48px,6vw,66px) 24px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="slabel" style={{ marginBottom:28 }}>Real people, real trust</div>
        <div className="tasks-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
          {slots.map((s,i) => (
            <figure key={i} className="lcard photo-card" style={{ margin:0, padding:0, overflow:'hidden', borderRadius:18 }}>
              <div style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden' }}>
                <img src={s.img} alt={s.caption} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                <span style={{ position:'absolute', top:12, left:12, background:'rgba(19,17,24,.5)', backdropFilter:'blur(8px)', color:'#fff', fontFamily:'var(--fm)', fontSize:'.6rem', letterSpacing:'.08em', textTransform:'uppercase', padding:'5px 11px', borderRadius:100 }}>{s.tag}</span>
              </div>
              <figcaption style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.02rem', padding:'16px 18px' }}>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// Mount-once scroll-reveal driver for the landing page: watches every `.reveal`
// section and adds `.in` as it enters the viewport (then stops watching it —
// reveals play once, never reverse). Falls back to showing everything when
// IntersectionObserver is unavailable, so content can never be stranded hidden.
function RevealObserver() {
  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal:not(.in)')
    if (!('IntersectionObserver' in window)) { nodes.forEach(n => n.classList.add('in')); return }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [])
  return null
}

// ── PWA install ──────────────────────────────────────────────────────────────
// Feature gate: the "Download the app" CTA stays hidden until the PWA install
// experience is signed off for production. Set VITE_ENABLE_INSTALL=true (Vercel +
// local .env) to re-enable — no code change needed. While off we also skip the
// beforeinstallprompt capture below, so we don't suppress the browser's own
// native install affordance in the meantime.
const INSTALL_ENABLED = import.meta.env.VITE_ENABLE_INSTALL === 'true'

// The browser fires `beforeinstallprompt` ONCE, early — usually before any
// component mounts. Capture it at module load and re-broadcast so InstallAppButton
// can offer a one-tap install whenever it renders. (Chromium/Android only; iOS
// Safari + desktop Safari/Firefox don't fire it — those get the help modal.)
let _installPrompt = null
if (INSTALL_ENABLED && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _installPrompt = e
    window.dispatchEvent(new Event('relivr:installable'))
  })
  window.addEventListener('appinstalled', () => { _installPrompt = null })
}
function isStandalone() {
  return typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
}

// Per-platform "Add to Home Screen" steps, for browsers with no install prompt.
function InstallHelpModal({ onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const Step = ({ n, children }) => (
    <li style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
      <span style={{ flexShrink:0, width:20, height:20, borderRadius:'50%', background:'var(--accent-glow)', color:'var(--accent)', fontFamily:'var(--fm)', fontSize:'.65rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{n}</span>
      <span style={{ fontSize:'.85rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{children}</span>
    </li>
  )
  return (
    <div className="moverlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Install ReLivR" onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'var(--fd)', fontSize:'1.15rem', fontWeight:800 }}>Install ReLivR</div>
          <button onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
        </div>
        <div style={{ padding:22 }}>
          <p style={{ fontSize:'.85rem', color:'var(--text-secondary)', lineHeight:1.5, margin:'0 0 16px' }}>
            ReLivR installs like an app — no app store needed. Pick your device:
          </p>
          <div style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--accent)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>iPhone / iPad — Safari</div>
          <ol style={{ listStyle:'none', margin:'0 0 16px', padding:0 }}>
            <Step n="1">Tap the <strong>Share</strong> button (the square with an ↑ arrow).</Step>
            <Step n="2">Scroll down and tap <strong>Add to Home Screen</strong>.</Step>
            <Step n="3">Tap <strong>Add</strong> — ReLivR appears on your home screen.</Step>
          </ol>
          <div style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--accent)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Android / Desktop — Chrome or Edge</div>
          <ol style={{ listStyle:'none', margin:0, padding:0 }}>
            <Step n="1">Open the browser menu (⋮), or look for the <strong>install</strong> icon in the address bar.</Step>
            <Step n="2">Choose <strong>Install ReLivR</strong> / <strong>Add to Home screen</strong>.</Step>
          </ol>
        </div>
      </div>
    </div>
  )
}

// A single "Download the app" button that does the right thing per browser:
// native install where supported, else a per-platform how-to. Hides itself once
// the app is already installed (running standalone) so the landing stays honest.
function InstallAppButton({ variant = 'primary', style }) {
  const [prompt, setPrompt] = useState(_installPrompt)
  const [help, setHelp] = useState(false)
  const [gone, setGone] = useState(isStandalone())
  useEffect(() => {
    const sync = () => setPrompt(_installPrompt)
    const installed = () => setGone(true)
    window.addEventListener('relivr:installable', sync)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('relivr:installable', sync); window.removeEventListener('appinstalled', installed) }
  }, [])
  if (!INSTALL_ENABLED || gone) return null
  async function click() {
    if (prompt) {
      prompt.prompt()
      try { await prompt.userChoice } catch { /* dismissed */ }
      _installPrompt = null; setPrompt(null)
    } else {
      setHelp(true)
    }
  }
  return (
    <>
      <button className={variant === 'secondary' ? 'btn-s' : 'btn-p'} style={style} onClick={click}>⬇ Download the app</button>
      {help && <InstallHelpModal onClose={() => setHelp(false)} />}
    </>
  )
}

function Hero({ onOpenAuth }) {
  // Corporate hero (Thumbtack/TaskRabbit grammar): the centerpiece is a
  // What + Where search form, not CTA buttons. Logged-out, so every entry
  // point funnels into signup — the search intent is the hook, not a query.
  return (
    <section className="hero-section" style={{ display:'flex', alignItems:'center', padding:'116px 24px 72px', position:'relative' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', width:'100%' }}>
        <div className="hero-inner" style={{ display:'flex', alignItems:'center', gap:64 }}>
          <div style={{ flex:1, animation:'fadeUp .6s ease both' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:24 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--verified)', flexShrink:0 }} />
              <span style={{ fontSize:'.78rem', fontWeight:700, color:'var(--text-secondary)', letterSpacing:'.06em', textTransform:'uppercase' }}>Proudly South African · Now in beta</span>
            </div>
            <h1 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(2.8rem,6vw,4.4rem)', lineHeight:1.05, letterSpacing:'-.04em', marginBottom:20, textWrap:'balance' }}>
              Help around<br />the corner.
            </h1>
            <p style={{ fontSize:'clamp(1rem,1.6vw,1.15rem)', color:'var(--text-secondary)', lineHeight:1.6, maxWidth:480, marginBottom:30 }}>
              Book trusted, ID-verified neighbours in Makhanda for anything on your list — from laundry runs to Python bugs.
            </p>
            {/* Search-form centerpiece — submits into signup while logged out */}
            <form onSubmit={e => { e.preventDefault(); onOpenAuth('register') }}
              style={{ background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:14, boxShadow:'var(--shadow-md)', padding:8, display:'flex', gap:8, alignItems:'stretch', flexWrap:'wrap', maxWidth:620 }}>
              <div style={{ flex:'1 1 200px', display:'flex', alignItems:'center', gap:10, padding:'4px 12px', minWidth:0 }}>
                <Icon name="search" size={17} color="var(--text-muted)" />
                <div style={{ minWidth:0, width:'100%' }}>
                  <span style={{ display:'block', fontSize:'.62rem', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-muted)' }}>What do you need done?</span>
                  <input placeholder="Try “laundry pickup”" aria-label="What do you need done"
                    style={{ border:'none', background:'transparent', boxShadow:'none', padding:'2px 0', fontSize:'.95rem', fontWeight:500, borderRadius:0 }} />
                </div>
              </div>
              <div style={{ flex:'0 1 170px', display:'flex', alignItems:'center', gap:10, padding:'4px 12px', borderLeft:'1px solid var(--border)', minWidth:0 }}>
                <Icon name="pin" size={17} color="var(--text-muted)" />
                <div style={{ minWidth:0, width:'100%' }}>
                  <span style={{ display:'block', fontSize:'.62rem', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-muted)' }}>Where</span>
                  <input defaultValue="Makhanda" aria-label="Location"
                    style={{ border:'none', background:'transparent', boxShadow:'none', padding:'2px 0', fontSize:'.95rem', fontWeight:500, borderRadius:0 }} />
                </div>
              </div>
              <button type="submit" className="btn-p" style={{ padding:'0 28px', borderRadius:8 }}>Search</button>
            </form>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:16 }}>
              <span style={{ fontSize:'.82rem', color:'var(--text-muted)', fontWeight:500, marginRight:2 }}>Popular:</span>
              {['Laundry pickup','Maths tutoring','Python help','Moving hands'].map(p => (
                <button key={p} type="button" onClick={() => onOpenAuth('register')}
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:100, padding:'6px 14px', fontSize:'.82rem', fontWeight:500, color:'var(--text-primary)', cursor:'pointer', transition:'border-color 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-strong)'}>{p}</button>
              ))}
              <InstallAppButton variant="secondary" style={{ fontSize:'.82rem', padding:'6px 14px', borderRadius:100, fontWeight:500, border:'1px solid var(--border-strong)' }} />
            </div>
            {/* Proof strip — real numbers pulled up under the search (Thumbtack pattern) */}
            <div style={{ display:'flex', gap:'clamp(20px,3vw,40px)', marginTop:36, flexWrap:'wrap' }}>
              {STATS_DATA.map((s,i) => (
                <div key={i}>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:800, color:'var(--text-primary)', lineHeight:1, letterSpacing:'-.02em' }}>{s.v}</div>
                  <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:5 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Honest product snapshot — a real task-feed panel, not a fake phone */}
          <div className="hide-m" style={{ width:352, flexShrink:0, animation:'slideL .7s .15s ease both', opacity:0, animationFillMode:'forwards' }}>
            <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:7, fontWeight:700, fontSize:'.85rem' }}><Icon name="pin" size={15} color="var(--accent)" />Open near you</span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontFamily:'var(--fm)', fontSize:'.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--live)', background:'var(--live-dim)', padding:'3px 8px', borderRadius:100 }}><span style={{ width:5, height:5, borderRadius:'50%', background:'var(--live)' }} />Live</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column' }}>
                {TASK_EXAMPLES.slice(0,3).map((t,i) => (
                  <div key={i} style={{ padding:'13px 16px', borderBottom:i<2?'1px solid var(--border)':'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:'.85rem', fontWeight:600, lineHeight:1.35 }}>{t.title}</span>
                      <span style={{ fontFamily:'var(--fd)', fontSize:'.92rem', fontWeight:800, color:'var(--text-primary)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{t.budget}</span>
                    </div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {t.tags.map(tag => <span key={tag} style={{ background:'var(--bg-elevated)', color:'var(--text-secondary)', fontFamily:'var(--fm)', fontSize:'.56rem', padding:'2px 7px', borderRadius:'var(--radius-sm)', textTransform:'uppercase', letterSpacing:'.06em' }}>{tag}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'11px 16px', background:'var(--bg-base)', display:'flex', alignItems:'center', gap:7, fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                <Icon name="check-circle" size={13} color="var(--verified)" />Every member is trust-scored
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatsBar() {
  return (
    <section className="reveal" style={{ borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'36px 24px', background:'var(--bg-surface)' }}>
      <div className="stats-grid" style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
        {STATS_DATA.map((s,i) => (
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,3vw,2.6rem)', fontWeight:800, color:'var(--text-primary)', letterSpacing:'-.02em', lineHeight:1, marginBottom:6 }}>{s.v}</div>
            <div style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Batch 6: two scannable tracks — one for people using ReLivR, one for businesses.
function HowItWorks() {
  return (
    <section id="how-it-works" className="reveal" style={{ padding:'clamp(52px,7vw,74px) 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:44 }}>
          <div className="slabel" style={{ marginBottom:14 }}>How It Works</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1, maxWidth:520 }}>Two ways to use ReLivR — pick your track</h2>
        </div>

        {/* Track 1 — people */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <span style={{ width:34, height:34, borderRadius:'var(--radius-sm)', background:'var(--accent-glow)', display:'inline-flex', alignItems:'center', justifyContent:'center' }}><Icon name="hand" size={19} color="var(--accent)" /></span>
          <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.25rem', fontWeight:800, margin:0 }}>For you — post a task or earn</h3>
        </div>
        <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:2, marginBottom:34 }}>
          {STEPS_DATA.map((s,i) => (
            <div key={i} style={{ padding:'30px 24px', background:i%2===0?'var(--bg-surface)':'var(--bg-base)', border:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, color:'var(--border-strong)', lineHeight:1, marginBottom:14, userSelect:'none' }}>{s.n}</div>
              <div style={{ display:'inline-block', background:s.color==='var(--amber)'?'rgba(126,34,206,.1)':s.color==='var(--green)'?'rgba(16,185,129,.1)':'rgba(180,83,9,.1)', border:`1px solid ${s.color==='var(--amber)'?'rgba(126,34,206,.3)':s.color==='var(--green)'?'rgba(16,185,129,.3)':'rgba(180,83,9,.3)'}`, borderRadius:100, padding:'3px 11px', marginBottom:12 }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:s.color, textTransform:'uppercase', letterSpacing:'.1em' }}>{s.role}</span>
              </div>
              <h4 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', fontWeight:700, marginBottom:9 }}>{s.title}</h4>
              <p style={{ fontSize:'.86rem', color:'var(--text-secondary)', lineHeight:1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Track 2 — businesses */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <span style={{ width:34, height:34, borderRadius:'var(--radius-sm)', background:'var(--accent-glow)', display:'inline-flex', alignItems:'center', justifyContent:'center' }}><Icon name="store" size={19} color="var(--accent)" /></span>
          <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.25rem', fontWeight:800, margin:0 }}>For your business — get discovered locally</h3>
        </div>
        <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:2 }}>
          {BIZ_STEPS_DATA.map((s,i) => (
            <div key={i} style={{ padding:'30px 24px', background:i%2===0?'var(--bg-surface)':'var(--bg-base)', border:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, color:'var(--border-strong)', lineHeight:1, marginBottom:14, userSelect:'none' }}>{s.n}</div>
              <div style={{ display:'inline-block', background:'rgba(180,83,9,.1)', border:'1px solid rgba(180,83,9,.3)', borderRadius:100, padding:'3px 11px', marginBottom:12 }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--highlight)', textTransform:'uppercase', letterSpacing:'.1em' }}>Business</span>
              </div>
              <h4 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', fontWeight:700, marginBottom:9 }}>{s.title}</h4>
              <p style={{ fontSize:'.86rem', color:'var(--text-secondary)', lineHeight:1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="reveal" style={{ padding:'clamp(52px,7vw,74px) 24px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:38, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:20 }}>
          <div>
            <div className="slabel" style={{ marginBottom:14 }}>Features</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1 }}>Everything you need.<br />Nothing you don't.</h2>
          </div>
          <p style={{ maxWidth:320, color:'var(--text-secondary)', fontSize:'.9rem', lineHeight:1.7 }}>Built for the way people actually get things done locally. Lightweight, fast, and designed to earn trust.</p>
        </div>
        <div className="feat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          {FEATURES_DATA.map((f,i) => (
            <div key={i} style={{ padding:'32px 28px', background:'var(--bg-base)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', transition:'background 200ms', cursor:'default' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--bg-base)'}>
              <div style={{ width:44, height:44, borderRadius:'var(--radius-md)', background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}><Icon name={f.icon} size={22} color="var(--accent)" /></div>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', fontWeight:700, marginBottom:9 }}>{f.title}</h3>
              <p style={{ fontSize:'.875rem', color:'var(--text-secondary)', lineHeight:1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LiveTasks({ onOpenAuth }) {
  return (
    <section className="reveal" style={{ padding:'clamp(52px,7vw,74px) 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:44, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:16 }}>
          <div>
            <div className="slabel" style={{ marginBottom:14 }}>Example tasks</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, lineHeight:1.1 }}>What gets posted near you</h2>
          </div>
          <button className="btn-s" onClick={() => onOpenAuth('register')}>Browse Real Tasks →</button>
        </div>
        <div className="tasks-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {TASK_EXAMPLES.map((t,i) => (
            <div key={i} className="lcard" style={{ cursor:'pointer' }} onClick={() => onOpenAuth('register')}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <span style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:100, padding:'2px 9px', fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--green)', textTransform:'uppercase', letterSpacing:'.08em' }}>Example</span>
                <span style={{ fontFamily:'var(--fm)', fontSize:'1rem', color:'var(--amber)', fontWeight:500 }}>{t.budget}</span>
              </div>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'.98rem', fontWeight:700, marginBottom:10, lineHeight:1.3 }}>{t.title}</h3>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
                {t.tags.map(tag => <span key={tag} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-strong)', color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.58rem', padding:'2px 7px', borderRadius:3, textTransform:'uppercase', letterSpacing:'.06em' }}>{tag}</span>)}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)' }}>📍 Your area</span>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)' }}>sign up to see live tasks</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing({ onOpenAuth }) {
  return (
    <section id="pricing" className="reveal" style={{ padding:'clamp(52px,7vw,74px) 24px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:38, textAlign:'center' }}>
          <div className="slabel" style={{ justifyContent:'center', marginBottom:14 }}>Pricing</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1, marginBottom:14 }}>Simple. Fair. Transparent.</h2>
          <p style={{ color:'var(--text-secondary)', maxWidth:420, margin:'0 auto', lineHeight:1.7, fontSize:'.9rem' }}>No subscriptions. No hidden fees. We only make money when you do.</p>
        </div>
        <div className="price-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, maxWidth:760, margin:'0 auto' }}>
          <div style={{ background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:14, padding:'32px 28px' }}>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>For Creators</div>
            <div style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, lineHeight:1, marginBottom:5 }}>Free</div>
            <p style={{ color:'var(--text-secondary)', fontSize:'.875rem', marginBottom:24 }}>to post a task</p>
            <Divider style={{ marginBottom:20 }} />
            {['Post unlimited tasks','Receive unlimited bids','Built-in messaging','Escrow payments — coming soon','Dispute resolution support'].map(item => (
              <div key={item} style={{ display:'flex', gap:9, alignItems:'center', marginBottom:10 }}>
                <span style={{ color:'var(--green)', fontSize:'.875rem', flexShrink:0 }}>✓</span>
                <span style={{ fontSize:'.875rem', color:'var(--text-secondary)' }}>{item}</span>
              </div>
            ))}
            <button className="btn-s" style={{ width:'100%', marginTop:24, justifyContent:'center', display:'flex' }} onClick={() => onOpenAuth('register')}>Post a Task Free</button>
          </div>
          <div style={{ background:'var(--bg-base)', border:'1px solid var(--amber)', borderRadius:14, padding:'32px 28px', position:'relative', boxShadow:'0 0 40px rgba(126,34,206,.08)' }}>
            <div style={{ position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)', background:'var(--amber)', color:'#fff', fontFamily:'var(--fm)', fontSize:'.58rem', fontWeight:500, textTransform:'uppercase', letterSpacing:'.1em', padding:'3px 12px', borderRadius:100 }}>Most Popular</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>For Earners</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:5 }}>
              <span style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, lineHeight:1 }}>Free</span>
              <span style={{ color:'var(--text-secondary)', fontSize:'.875rem' }}>during beta</span>
            </div>
            <p style={{ color:'var(--text-secondary)', fontSize:'.875rem', marginBottom:24 }}>secure payouts coming soon</p>
            <Divider style={{ marginBottom:20 }} />
            {['Bid on any open task','Verified trust score','Instant escrow payouts — coming soon','Build a local reputation','Zero upfront cost'].map(item => (
              <div key={item} style={{ display:'flex', gap:9, alignItems:'center', marginBottom:10 }}>
                <span style={{ color:'var(--amber)', fontSize:'.875rem', flexShrink:0 }}>✓</span>
                <span style={{ fontSize:'.875rem', color:'var(--text-secondary)' }}>{item}</span>
              </div>
            ))}
            <button className="btn-p" style={{ width:'100%', marginTop:24, justifyContent:'center', display:'flex' }} onClick={() => onOpenAuth('register')}>Start Earning →</button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Pre-launch: scenario cards instead of testimonials — we have no users yet, so
// invented quotes would be false advertising. Same card language; swap to real
// founding-member quotes post-beta.
function Testimonials() {
  return (
    <section className="reveal" style={{ padding:'clamp(52px,7vw,74px) 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:38 }}>
          <div className="slabel" style={{ marginBottom:14 }}>Made for real life</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1 }}>Whoever you are,<br />ReLivR works for you.</h2>
        </div>
        <div className="test-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {SCENARIOS_DATA.map((t,i) => (
            <div key={i} className="lcard">
              <div style={{ width:44, height:44, borderRadius:'var(--radius-md)', background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}><Icon name={t.icon} size={22} color="var(--accent)" /></div>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', fontWeight:700, marginBottom:10 }}>{t.title}</h3>
              <p style={{ fontSize:'.9rem', color:'var(--text-secondary)', lineHeight:1.8, marginBottom:22 }}>{t.text}</p>
              <div style={{ paddingTop:14, borderTop:'1px solid var(--border)' }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>{t.who}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LandingAbout() {
  return (
    <section id="about" className="reveal" style={{ padding:'clamp(52px,7vw,74px) 24px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="about-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>
          <div>
            <div className="slabel" style={{ marginBottom:18 }}>About ReLivR</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:800, lineHeight:1.1, marginBottom:22 }}>Built for your<br />community.</h2>
            <p style={{ color:'var(--text-secondary)', lineHeight:1.8, marginBottom:18, fontSize:'.9rem' }}>ReLivR started with a simple observation: every community has thousands of talented people who need extra income, and thousands more who need help getting things done. We built the infrastructure to connect them safely.</p>
            <p style={{ color:'var(--text-secondary)', lineHeight:1.8, fontSize:'.9rem' }}>Every feature — from the escrow payment system to the trust score engine — was designed for real, local trust. No bloat. Just a fast, safe marketplace that works.</p>
          </div>
          <div style={{ background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:14, padding:26, fontFamily:'var(--fm)', fontSize:'.78rem', lineHeight:2, color:'var(--text-muted)' }}>
            <div style={{ color:'var(--text-muted)', marginBottom:8, fontSize:'.6rem', textTransform:'uppercase', letterSpacing:'.1em' }}>// Task lifecycle</div>
            {[
              { k:'task.status',       v:"'open'",        c:'var(--amber)' },
              { k:'earner.bid()',      v:'R180',           c:'var(--green)' },
              { k:'escrow.lock()',     v:'✓ secured',      c:'var(--purple)' },
              { k:'task.complete()',   v:'✓ verified',     c:'var(--amber)' },
              { k:'payment.release()', v:'R162 → earner',  c:'var(--green)' },
            ].map((l,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                <span>{l.k}</span><span style={{ color:l.c }}>{l.v}</span>
              </div>
            ))}
            <div style={{ marginTop:14, color:'var(--green)', fontSize:'.72rem' }}>✓ Transaction complete in 48h</div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Beta strip shown above the landing nav.
// Live countdown to the full launch.
function Countdown({ target, onComplete }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(target) - Date.now()))
  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, new Date(target) - Date.now())
      setLeft(ms)
      if (ms === 0 && onComplete) { clearInterval(id); onComplete() }
    }, 1000)
    return () => clearInterval(id)
  }, [target, onComplete])
  const d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24
  const m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60
  const Cell = ({ n, l }) => (
    <div style={{ textAlign:'center', minWidth:74, padding:'16px 12px', borderRadius:16, background:'var(--bg-elevated)', border:'1px solid var(--border)', boxShadow:'0 4px 16px rgba(20,18,30,.05)' }}>
      <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(1.9rem,6vw,2.6rem)', lineHeight:1, color:'var(--amber)', fontVariantNumeric:'tabular-nums' }}>{String(n).padStart(2, '0')}</div>
      <div style={{ fontFamily:'var(--fm)', fontSize:'.58rem', textTransform:'uppercase', letterSpacing:'.14em', color:'var(--text-muted)', marginTop:8 }}>{l}</div>
    </div>
  )
  return (
    <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }} role="timer" aria-label={`${d} days until launch`}>
      <Cell n={d} l="days" /><Cell n={h} l="hours" /><Cell n={m} l="mins" /><Cell n={s} l="secs" />
    </div>
  )
}

// Cloudflare Turnstile bot-check for the public landing forms. Env-gated: with
// no VITE_TURNSTILE_SITE_KEY this renders nothing and the script never loads
// (the server side is equally a no-op without TURNSTILE_SECRET). The script tag
// is injected once and shared by every widget instance.
const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
function Turnstile({ onToken }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!TURNSTILE_KEY) return
    const el = ref.current
    function render() {
      if (el && window.turnstile && !el.dataset.rendered) {
        el.dataset.rendered = '1'
        window.turnstile.render(el, { sitekey: TURNSTILE_KEY, callback: onToken, 'refresh-expired': 'auto' })
      }
    }
    if (window.turnstile) { render(); return }
    let s = document.querySelector('script[data-turnstile]')
    if (!s) {
      s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.dataset.turnstile = '1'
      document.head.appendChild(s)
    }
    s.addEventListener('load', render)
    return () => s.removeEventListener('load', render)
  }, [onToken])
  if (!TURNSTILE_KEY) return null
  return <div ref={ref} style={{ display:'flex', justifyContent:'center', width:'100%' }} />
}

// Launch countdown + reminder waitlist.
function LaunchSection() {
  const [email, setEmail]     = useState('')
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const [tsToken, setTsToken] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!/.+@.+\..+/.test(email)) { setErr('Enter a valid email'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch(API_BASE + '/waitlist', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, turnstileToken: tsToken || undefined }) })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch { setErr('Something went wrong — please try again') } finally { setLoading(false) }
  }
  return (
    <section className="reveal" style={{ padding:'56px 24px', textAlign:'center', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:680, margin:'0 auto' }}>
        <div className="slabel" style={{ justifyContent:'center', marginBottom:14 }}>Full launch · 7 July 2026</div>
        <h2 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(1.6rem,4vw,2.4rem)', marginBottom:22 }}>The countdown is on</h2>
        <div style={{ marginBottom:26 }}><Countdown target={LAUNCH_AT} /></div>
        <p style={{ color:'var(--text-secondary)', marginBottom:20, lineHeight:1.7 }}>
          We're in <strong>beta</strong> now — sign up to use ReLivR today as a founding member, or drop your email and we'll remind you the moment we fully launch.
        </p>
        {done ? (
          <div style={{ color:'var(--green)', fontWeight:600 }}>✓ You're on the list — we'll email you when ReLivR launches.</div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); setErr('') }} placeholder="you@email.com" aria-label="Email for launch reminder"
              style={{ maxWidth:280, padding:'12px 16px', borderRadius:10, border:'1px solid var(--border-strong)', background:'var(--bg-elevated)' }} />
            <button type="submit" className="btn-p" disabled={loading}>{loading ? '…' : 'Remind me at launch'}</button>
            <Turnstile onToken={setTsToken} />
            {err && <div style={{ width:'100%', color:'var(--red)', fontSize:'.8rem' }}>{err}</div>}
          </form>
        )}
      </div>
    </section>
  )
}

// Beta feedback channel.
function FeedbackSection() {
  const [msg, setMsg]     = useState('')
  const [email, setEmail] = useState('')
  const [done, setDone]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [tsToken, setTsToken] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (msg.trim().length < 3) return
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/feedback', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message: msg.trim(), email: email.trim() || undefined, turnstileToken: tsToken || undefined }) })
      if (res.ok) setDone(true)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  return (
    <section id="feedback" className="reveal" style={{ padding:'64px 24px' }}>
      <div style={{ maxWidth:560, margin:'0 auto', textAlign:'center' }}>
        <div className="slabel" style={{ justifyContent:'center', marginBottom:14 }}>Beta feedback</div>
        <h2 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(1.6rem,4vw,2.4rem)', marginBottom:12 }}>Help us shape ReLivR</h2>
        <p style={{ color:'var(--text-secondary)', marginBottom:24, lineHeight:1.7 }}>
          We're building in the open during our beta, and <strong>any and all feedback is greatly appreciated</strong>. Found a bug, have an idea, or just want to say hi? Tell us.
        </p>
        {done ? (
          <div style={{ color:'var(--green)', fontWeight:600 }}>✓ Thank you — your feedback means a lot during our beta.</div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12, textAlign:'left' }}>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Your feedback…" required aria-label="Your feedback"
              style={{ minHeight:120, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border-strong)', background:'var(--bg-elevated)' }} />
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email (optional — if you'd like a reply)" aria-label="Your email, optional"
              style={{ padding:'12px 14px', borderRadius:10, border:'1px solid var(--border-strong)', background:'var(--bg-elevated)' }} />
            <Turnstile onToken={setTsToken} />
            <button type="submit" className="btn-p" disabled={loading} style={{ alignSelf:'center' }}>{loading ? 'Sending…' : 'Send feedback'}</button>
          </form>
        )}
      </div>
    </section>
  )
}

// Holding screen shown to signed-in non-admin users before the launch date.
// The app itself is locked until the countdown ends; this confirms their spot
// as a founding member and auto-reloads into the app the moment we launch.
function LaunchGate({ user, onLogout, onViewLanding }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'48px 24px', background:'var(--bg-base)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-10%', left:'50%', transform:'translateX(-50%)', width:760, height:420, background:'radial-gradient(ellipse,rgba(245,158,11,.10) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1, maxWidth:620, width:'100%' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:999, background:'var(--amber)', color:'#fff', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.14em', fontWeight:700, marginBottom:26 }}>
          ★ Founding Member
        </div>
        <h1 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(2rem,5vw,3.2rem)', lineHeight:1.05, letterSpacing:'-.02em', marginBottom:16 }}>
          You're in, {user.displayName?.split(' ')[0] || 'friend'}.
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:'1.05rem', lineHeight:1.7, marginBottom:34, maxWidth:520, marginLeft:'auto', marginRight:'auto' }}>
          ReLivR opens to everyone on <strong>7 July 2026</strong>. Your account is reserved
          and you'll wear the <strong>★ Founding Member</strong> badge for being here from day one.
          We'll email you the moment the doors open — this page unlocks into the app automatically.
        </p>
        <div style={{ marginBottom:36 }}>
          <Countdown target={LAUNCH_AT} onComplete={() => window.location.reload()} />
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn-p" onClick={() => window.dispatchEvent(new Event('relivr:show-walkthrough'))}>▶ See how ReLivR works</button>
          <button className="btn-s" onClick={onViewLanding}>← Back to site</button>
          <button className="btn-g" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </div>
  )
}

function LandingCTA({ onOpenAuth }) {
  return (
    <section className="reveal" style={{ padding:'clamp(48px,6vw,66px) 24px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', position:'relative', borderRadius:28, overflow:'hidden', boxShadow:'var(--shadow-xl)' }}>
        <img src="/img/community.webp" alt="Neighbours helping each other in the community" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(115deg, rgba(19,17,24,.88) 0%, rgba(19,17,24,.6) 52%, rgba(126,34,206,.5) 100%)' }} />
        <div style={{ position:'relative', zIndex:1, padding:'clamp(44px,7vw,86px) clamp(26px,6vw,72px)', maxWidth:640 }}>
          <div className="slabel" style={{ color:'var(--highlight)', marginBottom:18 }}>Get Started</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,4vw,3.4rem)', fontWeight:800, lineHeight:1.06, marginBottom:18, letterSpacing:'-.02em', color:'#fff' }}>
            Ready to join your<br /><span style={{ color:'var(--highlight)' }}>local economy?</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.82)', maxWidth:440, marginBottom:32, lineHeight:1.7, fontSize:'.98rem' }}>Be part of the founding community — the first members who shape ReLivR from day one, post the first tasks, and earn the first ratings.</p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <button className="btn-p" style={{ fontSize:'.95rem', padding:'14px 34px' }} onClick={() => onOpenAuth('register')}>Create Free Account →</button>
            <button onClick={() => onOpenAuth('login')} style={{ fontSize:'.95rem', padding:'14px 34px', borderRadius:12, border:'1px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.08)', backdropFilter:'blur(8px)', color:'#fff', fontFamily:'var(--fd)', fontWeight:700, cursor:'pointer' }}>Sign In</button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFO PAGE WRAPPERS
// ═══════════════════════════════════════════════════════════════════════════════

function PageWrapper({ title, subtitle, children, onNav }) {
  return (
    <div style={{ paddingTop:90 }}>
      <div style={{ borderBottom:'1px solid var(--border)', padding:'48px 24px 40px', background:'var(--bg-surface)' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <BackButton onClick={() => onNav('home')} label="Back to Home" />
          <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.14em', marginBottom:12 }}>{subtitle}</div>
          <h1 style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:800, lineHeight:1.05 }}>{title}</h1>
        </div>
      </div>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'48px 24px 80px' }}>{children}</div>
    </div>
  )
}

function SidebarPage({ title, subtitle, sections, children, onNav }) {
  const [active, setActive] = useState(sections[0]?.id || '')
  return (
    <div style={{ paddingTop:90 }}>
      <div style={{ borderBottom:'1px solid var(--border)', padding:'48px 24px 40px', background:'var(--bg-surface)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <BackButton onClick={() => onNav('home')} label="Back to Home" />
          <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.14em', marginBottom:12 }}>{subtitle}</div>
          <h1 style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:800, lineHeight:1.05 }}>{title}</h1>
        </div>
      </div>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 24px' }}>
        <div className="page-layout" style={{ display:'flex', gap:0 }}>
          <div className="page-sidebar" style={{ width:240, flexShrink:0, borderRight:'1px solid var(--border)', padding:'32px 0 80px' }}>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.12em', padding:'0 20px', marginBottom:12 }}>On this page</div>
            {sections.map(s => (
              <button key={s.id} onClick={() => { setActive(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior:'smooth', block:'start' }) }}
                style={{ display:'block', width:'100%', textAlign:'left', background:active===s.id?'rgba(126,34,206,.06)':'none', border:'none', borderLeft:active===s.id?'2px solid var(--amber)':'2px solid transparent', color:active===s.id?'var(--amber)':'var(--text-muted)', padding:'9px 20px', fontSize:'.85rem', cursor:'pointer', transition:'all 150ms' }}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ flex:1, padding:'40px 0 80px 48px', maxWidth:720 }} className="prose">{children}</div>
        </div>
      </div>
    </div>
  )
}

function ComingSoonPage({ title, subtitle, onNav }) {
  return (
    <PageWrapper title={title} subtitle={subtitle} onNav={onNav}>
      <div style={{ textAlign:'center', padding:'60px 20px' }}>
        <div style={{ fontSize:'3rem', marginBottom:16, opacity:.3 }}>🚧</div>
        <h2 style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:800, marginBottom:12 }}>Coming Soon</h2>
        <p style={{ color:'var(--text-secondary)', maxWidth:360, margin:'0 auto', lineHeight:1.7 }}>This page is being worked on and will be available shortly.</p>
        <button className="btn-s" style={{ marginTop:28 }} onClick={() => onNav('home')}>← Back to Home</button>
      </div>
    </PageWrapper>
  )
}

// ─── PRODUCT PAGES ────────────────────────────────────────────────────────────

function HowItWorksPage({ onNav }) {
  const sections = [
    { id:'overview',  label:'Overview' },
    { id:'creators',  label:'For Creators' },
    { id:'earners',   label:'For Earners' },
    { id:'payments',  label:'Payments & Escrow' },
    { id:'messaging', label:'Messaging' },
    { id:'disputes',  label:'Disputes' },
  ]
  return (
    <SidebarPage title="How ReLivR Works" subtitle="Product" sections={sections} onNav={onNav}>
      <div id="overview"><h2>Overview</h2><p>ReLivR is a peer-to-peer service marketplace for your local community — open to everyone. It connects people who need tasks done (Creators) with people who have the skills to do them (Earners).</p><div className="highlight"><p>🎓 Anyone can join. If you’re at a South African university, verifying your student email earns a verified-student badge, boosts your trust, and unlocks student-only deals.</p></div></div>
      <div id="creators"><h2>For Creators</h2><h3>Posting a Task</h3><p>Creating a task takes less than 60 seconds. Provide a title, description, budget, deadline, and skill tags. Once posted, your task is immediately visible and earners with matching skills are notified automatically.</p><h3>Reviewing Bids</h3><p>Earners submit bids with a proposed price and pitch. You can review all bids, message earners directly, and take as long as you need before accepting.</p><h3>Accepting a Bid</h3><p>When you accept a bid, all other bids are automatically declined and the winning earner is notified. You are then prompted to fund the escrow — this secures the payment without charging you yet.</p><h3>Releasing Payment</h3><p>Once the task is complete to your satisfaction, you release the payment. Funds transfer immediately to the earner's account. You are then prompted to leave a review.</p></div>
      <div id="earners"><h2>For Earners</h2><h3>Finding Tasks</h3><p>Browse the task feed by skill, keyword, or area. The Suggestions tab surfaces tasks specifically matched to your skill profile using our Jaccard similarity algorithm.</p><h3>Submitting a Bid</h3><p>Write a pitch explaining why you're the right person for the task and propose your price. You can bid on multiple tasks simultaneously and withdraw a bid at any time before it's accepted.</p><h3>Getting Paid</h3><p>Payments are processed via Paystack and paid out to your linked bank account. The platform retains a 10% fee from your payout on each completed task.</p></div>
      <div id="payments"><h2>Payments & Escrow</h2><p>ReLivR uses an escrow model to protect both parties:</p><ul><li>Creator funds escrow → the payment is held securely (no transfer yet)</li><li>Work is completed → Creator releases payment</li><li>The payment is captured → transferred to the earner minus the 10% platform fee</li><li>If disputed → Escrow is frozen until admin resolves it</li></ul><div className="highlight"><p>Your card is authorised but not charged until you release payment. If you raise a dispute before releasing, no charge is made.</p></div></div>
      <div id="messaging"><h2>Messaging</h2><p>Every task has a built-in messaging thread between the creator and the accepted earner. Messages are stored and visible to admin in the event of a dispute — so keep communication professional and on-platform.</p></div>
      <div id="disputes"><h2>Disputes</h2><p>If something goes wrong, either party can raise a dispute. This immediately freezes the escrow and notifies our admin team. The admin reviews all messages, task requirements, and evidence submitted, then decides to either refund the creator or release payment to the earner.</p></div>
    </SidebarPage>
  )
}

function FeaturesPage({ onNav }) {
  const sections = [
    { id:'overview',  label:'All Features' },
    { id:'matching',  label:'Smart Matching' },
    { id:'trust',     label:'Trust Scores' },
    { id:'escrow',    label:'Escrow System' },
    { id:'messaging', label:'Messaging' },
    { id:'admin',     label:'Admin Tools' },
  ]
  return (
    <SidebarPage title="Platform Features" subtitle="Product" sections={sections} onNav={onNav}>
      <div id="overview"><h2>All Features</h2><p>ReLivR is built with a focused feature set designed around the realities of local, peer-to-peer work. Everything was chosen because it solves a real problem for real people.</p></div>
      <div id="matching"><h2>Smart Matching Engine</h2><p>When a task is posted, our matching engine automatically identifies earners whose skill profiles overlap with the task's skill tags using Jaccard similarity scoring. Earners are ranked by skill overlap score, average rating bonus (up to +20% for 5-star earners), and account longevity.</p></div>
      <div id="trust"><h2>Trust Score System</h2><p>Every user has a trust score between 0 and 100, calculated from:</p><ul><li><strong style={{color:'var(--text-primary)'}}>Identity (40pts)</strong> — verified Rhodes student email @ru.ac.za (30pts) + verified email or Google sign-in (10pts)</li><li><strong style={{color:'var(--text-primary)'}}>Track record (40pts)</strong> — completed tasks (up to 20pts) + average rating (up to 20pts)</li><li><strong style={{color:'var(--text-primary)'}}>Longevity (20pts)</strong> — 5 points per month, capped at 20</li><li><strong style={{color:'var(--text-primary)'}}>Dispute penalty</strong> — -10pts per dispute raised against you</li></ul><div className="highlight"><p>Levels: Unverified (0–19) · New (20–49) · Established (50–79) · Verified (80–100)</p></div></div>
      <div id="escrow"><h2>Escrow System</h2><p>Our escrow uses an authorise-then-capture model through our payment provider, Paystack. Funds are authorised when escrow is funded, but no actual charge occurs until the creator releases payment. The 10% platform fee is deducted from the earner's payout, not added to the creator's charge.</p></div>
      <div id="messaging"><h2>Messaging</h2><p>Built-in direct messaging with task-scoped threads, pre-bid inquiry messages, read receipts, and message history preserved for dispute evidence. New messages reach you by email (instantly or in a daily digest — your choice in Profile → Security).</p></div>
      <div id="admin"><h2>Admin Tools</h2><p>The admin dashboard provides a full dispute queue with FIFO ordering, complete message logs for any task, escrow state visibility, user management, audit timelines, and one-click refund or release from the dispute detail view.</p></div>
    </SidebarPage>
  )
}

function PricingPage({ onNav, onOpenAuth }) {
  const sections = [
    { id:'overview', label:'Pricing Overview' },
    { id:'creators', label:'For Creators' },
    { id:'earners',  label:'For Earners' },
    { id:'fees',     label:'Fee Breakdown' },
    { id:'faq',      label:'FAQ' },
  ]
  return (
    <SidebarPage title="Pricing" subtitle="Product" sections={sections} onNav={onNav}>
      <div id="overview"><h2>Pricing Overview</h2><p>ReLivR uses a simple success-based pricing model. We make money only when transactions succeed — aligning our incentives with yours.</p><div className="highlight"><p>No monthly fees. No posting fees. No signup fees. 10% is deducted from the earner's payout on each completed task.</p></div></div>
      <div id="creators"><h2>For Creators</h2><p>Posting tasks is completely free. You only pay the agreed task price when you release payment after the work is complete. There are no additional fees charged to creators beyond the agreed task price.</p></div>
      <div id="earners"><h2>For Earners</h2><p>Bidding and winning tasks is free. When a task is completed and payment is released, ReLivR retains 10% of the task value as a platform fee. Example: You win a R500 task. When the creator releases payment, you receive R450. ReLivR retains R50.</p></div>
      <div id="fees"><h2>Fee Breakdown</h2>
        <table><thead><tr><th>Action</th><th>Creator</th><th>Earner</th></tr></thead><tbody>
          {[['Post a task','Free','—'],['Submit a bid','—','Free'],['Task completed','Task price','Task price minus 10%'],['Dispute raised','Free','Free'],['Refund (dispute)','Full refund','No payout']].map(([a,c,e]) => (
            <tr key={a}><td>{a}</td><td>{c}</td><td>{e}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div id="faq"><h2>Frequently Asked Questions</h2><h3>What if a dispute is raised?</h3><p>If resolved in the creator's favour, escrow is cancelled and no charge is made. If resolved in the earner's favour, payment is released as normal minus the 10% platform fee.</p><h3>Are there VAT implications?</h3><p>ReLivR is not currently VAT registered. Earners are responsible for declaring their earnings to SARS as individual income.</p><h3>Can prices be negotiated outside the platform?</h3><p>All transactions must go through ReLivR's escrow system. Off-platform payments are not covered by our trust or dispute protection.</p></div>
    </SidebarPage>
  )
}

function TrustSafetyPage({ onNav }) {
  const sections = [
    { id:'overview',     label:'Trust & Safety' },
    { id:'trust-scores', label:'Trust Scores' },
    { id:'verification', label:'Verification' },
    { id:'escrow',       label:'Payment Safety' },
    { id:'reporting',    label:'Reporting Issues' },
    { id:'prohibited',   label:'Prohibited Conduct' },
  ]
  return (
    <SidebarPage title="Trust & Safety" subtitle="Product" sections={sections} onNav={onNav}>
      <div id="overview"><h2>Our Commitment to Safety</h2><p>ReLivR is built on the principle that two neighbours in the same community should be able to transact with confidence. Every feature exists to make that possible.</p><div className="highlight"><p>🔒 All payments are held in escrow and never leave the platform until both parties are satisfied — or an admin resolves a dispute.</p></div></div>
      <div id="trust-scores"><h2>Trust Scores</h2><p>Every user has a visible trust score calculated from verifiable signals: verified identity, completed transactions, earned ratings, and account history. A high trust score is not a guarantee of quality, but it is a meaningful signal that a user has a real, verified identity and a track record on the platform.</p></div>
      <div id="verification"><h2>Identity Verification</h2><p>Verifying a South African university student email earns a verified-student badge and boosts your trust. Email verification and Google sign-in further confirm a real identity and help prevent anonymous bad-faith accounts from accumulating trust.</p></div>
      <div id="escrow"><h2>Payment Safety</h2><p>ReLivR never holds your money directly — payments are processed and held in escrow by our payment provider, Paystack, a PCI-DSS-compliant processor. Your card details are never stored by ReLivR.</p></div>
      <div id="reporting"><h2>Reporting Issues</h2><p>If you encounter a problem:</p><ul><li><strong style={{color:'var(--text-primary)'}}>Raise a dispute</strong> — for unresolved task delivery issues. Freezes escrow immediately.</li><li><strong style={{color:'var(--text-primary)'}}>Report a user</strong> — for conduct violations, harassment, or fraud.</li><li><strong style={{color:'var(--text-primary)'}}>Contact support</strong> — for account issues or technical problems.</li></ul></div>
      <div id="prohibited"><h2>Prohibited Conduct</h2><p>The following result in immediate account suspension:</p><ul><li>Off-platform payment requests or arrangements</li><li>Creating fake reviews or inflating trust scores</li><li>Harassment, threats, or discriminatory language</li><li>Posting tasks or services that are illegal under South African law</li><li>Academic dishonesty services</li></ul></div>
    </SidebarPage>
  )
}

// ─── LEGAL PAGES ─────────────────────────────────────────────────────────────

function TermsPage({ onNav }) {
  const sections = [
    { id:'intro',       label:'Introduction' },
    { id:'eligibility', label:'Eligibility' },
    { id:'accounts',    label:'Accounts' },
    { id:'acceptable',  label:'Acceptable Use' },
    { id:'ip',          label:'Intellectual Property' },
    { id:'payments',    label:'Payments & Fees' },
    { id:'billing',     label:'Subscriptions & Billing' },
    { id:'refunds',     label:'Refunds & Disputes' },
    { id:'liability',   label:'Disclaimer & Liability' },
    { id:'termination', label:'Termination' },
    { id:'governing',   label:'Governing Law' },
  ]
  return (
    <SidebarPage title="Terms of Service" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 28 June 2026</p>
      <div id="intro"><h2>1. Introduction</h2><p>These Terms govern your access to and use of the ReLivR platform, including our website, apps, features and related services (the "Platform"). By creating an account or using the Platform, you agree to these Terms, our Privacy Policy, and any referenced policies.</p><p>ReLivR is a technology platform that connects people who need everyday tasks done with independent taskers who can help. Unless stated otherwise, ReLivR is not the provider of the requested services and is not the employer, agent or representative of any tasker. We may update these Terms and will give reasonable notice of material changes where required by law.</p></div>
      <div id="eligibility"><h2>2. Eligibility</h2><p>You must be at least 18 years old (or have the consent of a parent or legal guardian where permitted by applicable law) and have the legal capacity to enter into this agreement. ReLivR is launching at Rhodes University and expanding from there, but an account is not restricted to any single campus.</p></div>
      <div id="accounts"><h2>3. Accounts</h2><p>When registering you agree to provide accurate, complete and up-to-date information and to keep your login credentials secure. You may create only one account per person and may not transfer, sell or share your account. We may suspend, restrict or terminate any account that contains inaccurate information, violates these Terms, or poses a risk to the safety, security or integrity of the Platform.</p></div>
      <div id="acceptable"><h2>4. Acceptable Use</h2><p>You agree to use the Platform only for lawful purposes. You may not:</p><ul><li>Use the Platform for unlawful, fraudulent, deceptive or misleading purposes</li><li>Request or deliver illegal goods, stolen property, weapons, controlled substances or hazardous materials</li><li>Harass, threaten, discriminate against, intimidate or abuse other users, taskers or ReLivR staff</li><li>Provide false information, impersonate another person, or create multiple accounts for deceptive purposes</li><li>Circumvent payments, fees or processes established by ReLivR</li><li>Cause harm, injury, property damage or unreasonable inconvenience to others</li></ul><p>We may investigate suspected violations, suspend or terminate offending accounts, and cooperate with law enforcement where necessary.</p></div>
      <div id="ip"><h2>5. Intellectual Property</h2><p>The Platform and all related intellectual property are owned by ReLivR or its licensors. We grant you a limited, non-exclusive, non-transferable, revocable licence to use the Platform for its intended purpose. You may not copy, modify, reverse-engineer, scrape, resell or sublicense any part of the Platform, or use our branding, without our written consent.</p></div>
      <div id="payments"><h2>6. Payments &amp; Platform Fees</h2><p>You agree to pay all charges associated with tasks you request. Payments are processed through our payment provider (Paystack), with ReLivR acting as a limited payment-collection agent between Users and Taskers. ReLivR may charge service, platform, processing, cancellation or subscription fees; any applicable fees are disclosed before you confirm a transaction.</p><div className="highlight"><p>Payments and escrow are being rolled out. During beta, posting and bidding are free — see the <a href="#" onClick={(e)=>{e.preventDefault();onNav&&onNav('pricing')}}>Pricing</a> page for current fees.</p></div></div>
      <div id="billing"><h2>7. Subscriptions &amp; Billing</h2><p>ReLivR may offer optional subscriptions that unlock premium features. Subscriptions are billed in advance on the cycle you choose (monthly or annually) and renew until cancelled. By subscribing you authorise ReLivR or its payment processor to charge your payment method for applicable fees and taxes. We will give reasonable notice of material pricing changes.</p></div>
      <div id="refunds"><h2>8. Refunds, Disputes &amp; Chargebacks</h2><p>Payments are generally final and non-refundable except where required by law or approved by ReLivR. You may raise disputes through our support channels; ReLivR may investigate and, where appropriate, issue partial or full refunds, reverse payments or withhold funds. You may cancel a subscription at any time in your account settings — cancellation takes effect at the end of the current billing period, with no partial refund for unused time unless required by law. Fraudulent or abusive chargebacks may result in suspension or termination.</p></div>
      <div id="liability"><h2>9. Disclaimer &amp; Limitation of Liability</h2><p>The Platform is provided on an "as is" and "as available" basis. ReLivR does not guarantee the conduct, quality, suitability, legality or performance of any user, tasker or third party. To the maximum extent permitted by law, ReLivR is not liable for indirect, incidental, special or consequential damages, and our total liability will not exceed the total amount you paid through the Platform in the six (6) months preceding the event giving rise to the claim. Nothing in these Terms excludes liability that cannot be excluded under applicable law.</p></div>
      <div id="termination"><h2>10. Termination</h2><p>We may suspend, restrict or terminate your account for violations of these Terms, fraud, false information, or risk to the Platform or its users. You may close your account at any time after resolving pending transactions. On termination, your right to use the Platform ends; we may retain certain information as required by law (see the Privacy Policy).</p></div>
      <div id="governing"><h2>11. Governing Law</h2><p>These Terms are governed by the laws of the Republic of South Africa, and the South African courts have exclusive jurisdiction over any dispute, subject to applicable consumer-protection law.</p><div className="highlight"><p>Questions? Email <a href="mailto:support.relivr@gmail.com">support.relivr@gmail.com</a></p></div></div>
    </SidebarPage>
  )
}

function PrivacyPage({ onNav }) {
  const sections = [
    { id:'intro',     label:'Introduction' },
    { id:'collect',   label:'What We Collect' },
    { id:'lawful',    label:'Lawful Basis' },
    { id:'use',       label:'How We Use It' },
    { id:'share',     label:'Who We Share With' },
    { id:'transfers', label:'Cross-Border' },
    { id:'retention', label:'Data Retention' },
    { id:'rights',    label:'Your Rights' },
    { id:'automated', label:'Automated Processing' },
    { id:'children',  label:'Children & Special Info' },
    { id:'marketing', label:'Direct Marketing' },
    { id:'security',  label:'Security' },
    { id:'contact',   label:'Contact' },
  ]
  return (
    <SidebarPage title="Privacy Policy" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 28 June 2026</p>
      <div id="intro"><h2>1. Introduction</h2><p>ReLivR is committed to protecting your personal information and processes it in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and other applicable South African law. This policy explains what we collect, how we use it, who we share it with, and your rights.</p></div>
      <div id="collect"><h2>2. What We Collect</h2><ul><li>Identity and profile information — your name, display name, profile photo, headline, skills, and any bio or services you add</li><li>Identity verification — your South African ID number, collected at sign-up to confirm you are a real person. It is <strong style={{color:'var(--text-primary)'}}>encrypted at rest</strong>, never shown to other users, and used only for verification and fraud prevention.</li><li>Contact information — email address, phone number, and physical or campus address</li><li>Account information — login credentials and preferences</li><li>Payment and transaction information — once payments are enabled</li><li>Location — your campus or area (which you choose from a list) helps facilitate tasks. Separately, if you tap "Sort by distance" on Browse Tasks or Local, your browser asks your device for its current position and uses it — on your device only — to sort results by proximity. That coordinate is never sent to or stored on our servers; it exists only in your browser for that browsing session.</li><li>Communications — messages with other users and with support</li><li>Technical and device information — IP address, device/browser type, a hashed identifier derived from your browser (used to detect new sign-ins), cookies, local storage and usage data</li><li>Content you create — tasks, bids, reviews and ratings, and (for businesses) listings and deal posts</li><li>Social and activity information — the users and businesses you follow and the deals you redeem</li></ul><p>Some information (name, email, password) is required to use the Platform; other information is optional.</p></div>
      <div id="lawful"><h2>3. Lawful Basis for Processing</h2><p>We process personal information where you have consented, where it is necessary to perform our contract with you, to comply with a legal obligation, to protect a legitimate interest, or as otherwise permitted by law — consistent with POPIA's eight conditions for lawful processing.</p></div>
      <div id="use"><h2>4. How We Use It</h2><p>We use your information to create and manage accounts, match users with taskers, process payments, facilitate communication, verify identity and prevent fraud, provide support, improve and secure the Platform, comply with legal obligations, and send service-related notifications. <strong style={{color:'var(--text-primary)'}}>We do not sell your personal information.</strong></p></div>
      <div id="share"><h2>5. Who We Share With</h2><p>We share personal information only as needed to operate the Platform:</p><ul><li>Payment processors (e.g. Paystack), once payments are enabled</li><li>Cloud hosting and database providers (e.g. Railway, Vercel, Neon)</li><li>Image-hosting providers for photos you upload (e.g. Cloudinary)</li><li>Authentication and email providers (e.g. Google / Gmail, and email-delivery services)</li><li>Analytics providers that help us improve the Platform</li><li>Other users and businesses when you interact — for example, your display name is shared with the other party when you post a task, bid, message or leave a review; and when you redeem a business's deal, your name is shared with that business. Your public profile and reviews are visible to other users.</li><li>Law enforcement or regulators where required by law</li></ul></div>
      <div id="transfers"><h2>6. Cross-Border Transfers</h2><p>Some of our providers process or store information outside South Africa, including in the European Union and the United States. Where information is transferred across borders, we ensure an adequate level of protection consistent with section 72 of POPIA.</p></div>
      <div id="retention"><h2>7. Data Retention</h2><p>We keep personal information only as long as necessary, then delete or anonymise it. Account data is kept while your account is active (and anonymised when you delete it); payment records are kept for the period required by tax and financial-record laws (generally up to five years, once payments are enabled); support communications and security logs are kept for a limited period; and consent records are kept until you change them. We may retain information longer where required by law or to resolve disputes.</p></div>
      <div id="rights"><h2>8. Your Rights Under POPIA</h2><p>You may access your information, correct it, request deletion (where permitted), object to certain processing (including direct marketing), withdraw consent, and request a copy of your data in a portable format. You can download your data and delete your account at any time from <strong style={{color:'var(--text-primary)'}}>Profile → Security</strong>. You may also lodge a complaint with the Information Regulator.</p><div className="highlight"><p>Information Regulator: <a href="https://inforeg.org.za">inforeg.org.za</a> · complaints.IR@inforegulator.org.za</p></div></div>
      <div id="automated"><h2>9. Automated Processing &amp; Profiling</h2><p>We use limited automated processing to operate the Platform — for example, matching tasks with taskers, calculating a reliability score from on-platform activity, and screening for fraud and abuse. These do not produce legal consequences for you without human involvement, and you may contact us to query a decision that significantly affects you.</p></div>
      <div id="children"><h2>10. Children &amp; Special Information</h2><p>ReLivR is intended for users aged 18 and older and is not directed at children. We do not knowingly collect personal information from children, and we do not seek to collect special personal information (such as health, race or biometric data). Please do not submit such information through the Platform.</p></div>
      <div id="marketing"><h2>11. Direct Marketing</h2><p>We send service-related messages (security, account and task notifications) as part of providing the Platform. We only send marketing communications where permitted by law, and you can opt out at any time using the unsubscribe option or your notification settings (Profile → Security), where you can choose instant, daily-digest, or no activity emails.</p></div>
      <div id="security"><h2>12. Security</h2><p>We use encryption in transit and for sensitive data, access controls, JWT-based authentication, audit logs, rate limiting and periodic security reviews. If a data breach occurs, we will investigate and, where required by law, notify affected users and the Information Regulator as soon as reasonably possible.</p></div>
      <div id="contact"><h2>13. Contact</h2><p>Information Officer: Uthando Mkwanazi — <a href="mailto:uthando.mkwanazi@gmail.com">uthando.mkwanazi@gmail.com</a><br />General queries: <a href="mailto:support.relivr@gmail.com">support.relivr@gmail.com</a></p></div>
    </SidebarPage>
  )
}

function CookiesPage({ onNav }) {
  const sections = [
    { id:'what',    label:'What Are Cookies' },
    { id:'types',   label:'Types We Use' },
    { id:'consent', label:'Consent Model' },
    { id:'banner',  label:'Cookie Banner' },
    { id:'control', label:'Managing Cookies' },
  ]
  return (
    <SidebarPage title="Cookie Policy" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 28 June 2026</p>
      <div id="what"><h2>1. What Are Cookies</h2><p>Cookies are small text files and similar technologies — including pixel tags, web beacons, SDKs and local storage — stored on your device when you use ReLivR. They help us remember your preferences, keep you signed in, improve functionality, analyse usage and enhance security.</p><div className="highlight"><p>At present ReLivR primarily uses strictly necessary and analytics technologies, including browser local storage to keep you signed in. We do not currently serve third-party advertising cookies.</p></div></div>
      <div id="types"><h2>2. Types We Use</h2><h3>Strictly Necessary</h3><p>Essential for the operation, security and functionality of the Platform (including keeping you signed in). These cannot be disabled.</p><h3>Analytics &amp; Performance</h3><p>Help us understand how the Platform is used so we can improve it. Aggregated where possible.</p><h3>Functional</h3><p>Remember your preferences and settings for a more personalised experience.</p><h3>Advertising &amp; Marketing</h3><p>Not currently used. If introduced, they would only run with your consent where required by law.</p><h3>Third-Party</h3><p>Some technologies may be placed by trusted providers that support analytics, payments, fraud prevention or functionality, under their own privacy policies.</p></div>
      <div id="consent"><h2>3. POPIA-Compliant Consent</h2><p>Except for strictly necessary cookies, we will obtain your consent before placing or activating cookies and tracking technologies where required by law. You may accept all cookies, reject non-essential cookies, or customise your preferences by category, and you may withdraw or change consent at any time.</p></div>
      <div id="banner"><h2>4. Cookie Banner</h2><p>On your first visit, ReLivR will display a cookie notice that explains our use of cookies, links to this policy, lets you accept, reject or customise non-essential cookies, and records your preferences where required by law. We will not deploy non-essential cookies until appropriate consent has been obtained where legally required.</p></div>
      <div id="control"><h2>5. Managing Cookies</h2><p>You can manage cookie preferences through settings on the Platform or through your browser. Most browsers let you block, delete or restrict cookies — though disabling some may affect functionality. Changing your preferences does not affect the lawfulness of processing carried out before you withdrew consent.</p><p><button onClick={openCookiePrefs} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'10px 18px', fontWeight:700, fontSize:'.85rem', cursor:'pointer' }}>Manage cookie preferences</button></p><div className="highlight"><p>Questions? Email <a href="mailto:support.relivr@gmail.com">support.relivr@gmail.com</a></p></div></div>
    </SidebarPage>
  )
}

function POPIAPage({ onNav }) {
  const sections = [
    { id:'overview',   label:'Commitment' },
    { id:'conditions', label:'Eight Conditions' },
    { id:'security',   label:'Security Measures' },
    { id:'operators',  label:'Operators' },
    { id:'breaches',   label:'Breach Notification' },
    { id:'officer',    label:'Information Officer' },
    { id:'complaints', label:'Complaints' },
  ]
  return (
    <SidebarPage title="POPIA Compliance" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 28 June 2026</p>
      <div id="overview"><h2>Our Commitment</h2><p>ReLivR is committed to protecting the privacy, confidentiality, integrity and availability of personal information entrusted to us. We process personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA), applicable regulations and industry best practices.</p></div>
      <div id="conditions"><h2>Eight Conditions for Lawful Processing</h2><p>We process personal information in line with POPIA's eight conditions:</p><ul><li>Accountability</li><li>Processing Limitation</li><li>Purpose Specification</li><li>Further Processing Limitation</li><li>Information Quality</li><li>Openness</li><li>Security Safeguards</li><li>Data Subject Participation</li></ul><p>We regularly review our procedures and controls to maintain ongoing compliance.</p></div>
      <div id="security"><h2>Information Security Measures</h2><p>We implement reasonable technical and organisational safeguards to protect personal information against loss, unauthorised access, misuse, alteration, disclosure or destruction. These include encryption, secure hosting, access controls, authentication mechanisms, audit logs, staff awareness and periodic security assessments.</p></div>
      <div id="operators"><h2>Operators &amp; Third Parties</h2><p>We may engage operators and service providers — including hosting providers, payment processors, identity-verification providers, analytics providers and customer-support services — to help run the Platform. We require them to process personal information only on our instructions, maintain appropriate safeguards and comply with applicable data-protection law.</p></div>
      <div id="breaches"><h2>Data Breach Notification</h2><p>Where we have reasonable grounds to believe personal information has been accessed, acquired or disclosed by an unauthorised person, we will investigate and, where required by law, notify affected data subjects and the Information Regulator as soon as reasonably possible — through the Regulator's designated eServices portal — with enough information for affected individuals to take protective measures.</p></div>
      <div id="officer"><h2>Information Officer</h2><p>We have appointed an Information Officer responsible for overseeing POPIA compliance, responding to data-subject requests, managing security incidents, and liaising with the Information Regulator.</p><div className="highlight"><p>Information Officer: Uthando Mkwanazi · <a href="mailto:uthando.mkwanazi@gmail.com">uthando.mkwanazi@gmail.com</a></p></div></div>
      <div id="complaints"><h2>Complaints</h2><p>If you believe we have processed your personal information unlawfully, please contact our Information Officer above. You also have the right to lodge a complaint with the Information Regulator of South Africa or to seek other remedies available under applicable law.</p><div className="highlight"><p>Information Regulator: <a href="https://inforeg.org.za">inforeg.org.za</a> · complaints.IR@inforegulator.org.za</p></div></div>
    </SidebarPage>
  )
}

// ─── SUPPORT PAGES ────────────────────────────────────────────────────────────

function HelpCentrePage({ onNav }) {
  const sections = [
    { id:'getting-started', label:'Getting Started' },
    { id:'creators',        label:'For Creators' },
    { id:'earners',         label:'For Earners' },
    { id:'payments',        label:'Payments' },
    { id:'account',         label:'My Account' },
    { id:'technical',       label:'Technical Issues' },
  ]
  return (
    <SidebarPage title="Help Centre" subtitle="Support" sections={sections} onNav={onNav}>
      <div id="getting-started"><h2>Getting Started</h2><h3>How do I create an account?</h3><p>Click "Get Started" on the homepage, fill in your name, email, and password, and choose whether you want to post tasks (Creator) or earn money (Earner). You can explore both roles after signup.</p><h3>Is it free to sign up?</h3><p>Yes. Creating an account is completely free. There are no monthly fees or charges for browsing.</p><h3>Do I need a university email?</h3><p>No — anyone can join with any email. If you’re at a South African university, verifying your student email earns a verified-student badge, increases your trust score, and unlocks student-only deals.</p></div>
      <div id="creators"><h2>For Creators</h2><h3>How do I post a task?</h3><p>Log in, click "Post Task", fill in the details (title, description, budget, deadline, skill tags), review, and submit. It goes live immediately.</p><h3>What if the earner does poor work?</h3><p>Don't release payment. Use in-platform messaging to give specific feedback and request revisions. If the earner refuses, raise a dispute. Do not release payment until you are satisfied.</p></div>
      <div id="earners"><h2>For Earners</h2><h3>How do I write a good pitch?</h3><p>Be specific. Reference the task directly, explain your relevant experience, give a realistic timeline, and be honest about your price. Generic pitches get ignored.</p><h3>How quickly do I get paid?</h3><p>Once the creator releases payment, Paystack processes the payout. Payout timing is typically 1–3 business days for South African bank accounts.</p></div>
      <div id="payments"><h2>Payments</h2><h3>My payment failed. What do I do?</h3><p>Check your card details are correct and that you have sufficient funds. If the problem persists, try a different card or contact your bank.</p><h3>Can I get a refund if I'm not happy?</h3><p>Refunds are only processed through the dispute resolution system. Do not release payment until you are satisfied — once released we cannot reverse the transfer.</p></div>
      <div id="account"><h2>My Account</h2><h3>How do I change my password?</h3><p>Go to Profile → Security → Change Password. You will need your current password to set a new one.</p><h3>How do I delete my account?</h3><p>Go to Profile → Security → Delete Account. Pending transactions must be resolved before deletion.</p></div>
      <div id="technical"><h2>Technical Issues</h2><h3>The app doesn't work on my phone.</h3><p>ReLivR is designed to work on all modern mobile browsers. Try Chrome on Android or Safari on iOS. If the problem persists, please report it.</p><div className="highlight"><p>Still stuck? Email <a href="mailto:support@reliv.co.za">support@reliv.co.za</a> — we respond within 24 hours.</p></div></div>
    </SidebarPage>
  )
}

function ContactPage({ onNav }) {
  const [form, setForm]     = useState({ name:'', email:'', subject:'', message:'' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 900)
  }

  return (
    <PageWrapper title="Contact Us" subtitle="Support" onNav={onNav}>
      <div className="about-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48 }}>
        <div>
          <p style={{ color:'var(--text-secondary)', lineHeight:1.8, marginBottom:28, fontSize:'.9rem' }}>Have a question, problem, or feedback? We read every message and respond within 24 hours on business days.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { icon:'message', label:'General enquiries', value:'hello@reliv.co.za' },
              { icon:'lock',    label:'Privacy & data',    value:'privacy@reliv.co.za' },
              { icon:'scale',   label:'Legal',             value:'legal@reliv.co.za' },
              { icon:'shield',  label:'Technical support', value:'support@reliv.co.za' },
            ].map(item => (
              <div key={item.label} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ flexShrink:0, color:'var(--accent)' }}><Icon name={item.icon} size={20} /></span>
                <div>
                  <div style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:2 }}>{item.label}</div>
                  <a href={`mailto:${item.value}`} style={{ color:'var(--amber)', fontSize:'.875rem' }}>{item.value}</a>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          {sent ? (
            <div style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✓</div>
              <div style={{ fontFamily:'var(--fd)', fontSize:'1.3rem', fontWeight:800, marginBottom:8 }}>Message sent!</div>
              <p style={{ color:'var(--text-secondary)', fontSize:'.875rem' }}>We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><label>Your Name</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Full name" /></div>
              <div><label>Email Address</label><input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="you@example.com" /></div>
              <div><label>Subject</label>
                <select value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))}>
                  <option value="">Select a subject</option>
                  <option>General enquiry</option><option>Payment issue</option>
                  <option>Account problem</option><option>Report a user</option>
                  <option>Technical issue</option><option>Legal matter</option><option>Other</option>
                </select>
              </div>
              <div><label>Message</label><textarea value={form.message} onChange={e => setForm(f=>({...f,message:e.target.value}))} placeholder="Describe your issue in as much detail as possible…" style={{ minHeight:140 }} /></div>
              <button type="submit" className="btn-p" style={{ alignSelf:'flex-start' }} disabled={loading}>
                {loading ? <Spinner /> : 'Send Message →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function GuidelinesPage({ onNav }) {
  const sections = [
    { id:'overview',    label:'Overview' },
    { id:'respect',     label:'Respect' },
    { id:'honesty',     label:'Honesty' },
    { id:'tasks',       label:'Acceptable Tasks' },
    { id:'payments',    label:'Payments' },
    { id:'enforcement', label:'Enforcement' },
  ]
  return (
    <SidebarPage title="Community Guidelines" subtitle="Support" sections={sections} onNav={onNav}>
      <div id="overview"><h2>Our Community Standards</h2><p>ReLivR works because members trust each other. These guidelines exist to protect that trust and ensure the platform remains a safe, fair place for everyone in the community.</p></div>
      <div id="respect"><h2>Respect</h2><p>Every person on ReLivR is a member of your local community. Treat them accordingly.</p><ul><li>Communicate professionally, even when disagreements arise</li><li>No harassment, threats, hate speech, or discriminatory language</li><li>Respect boundaries — if someone withdraws from a transaction, accept it</li><li>Do not share other users' personal information outside the platform</li></ul></div>
      <div id="honesty"><h2>Honesty</h2><ul><li>Represent your skills and experience accurately</li><li>Describe tasks accurately — do not misrepresent scope or requirements</li><li>Do not create fake reviews or manipulate trust scores</li><li>Do not impersonate other users or create multiple accounts</li></ul></div>
      <div id="tasks"><h2>Acceptable Tasks</h2><p>Not permitted:</p><ul><li>Anything illegal under South African law</li><li>Academic dishonesty — writing essays for submission as original work</li><li>Adult or sexual content of any kind</li><li>Services designed to harm or harass an individual</li></ul><p>Tutoring, explaining concepts, proofreading with attribution, and study assistance are acceptable.</p></div>
      <div id="payments"><h2>Payment Integrity</h2><ul><li>All payments must go through the escrow system</li><li>Do not release payment if the work is not completed to the agreed standard</li><li>Do not raise frivolous disputes to delay payment</li></ul></div>
      <div id="enforcement"><h2>Enforcement</h2><p>Depending on severity: Warning → Trust score penalty → Temporary suspension → Permanent ban → Referral to university or law enforcement.</p><div className="highlight"><p>Report violations: <a href="mailto:trust@reliv.co.za">trust@reliv.co.za</a></p></div></div>
    </SidebarPage>
  )
}

function ReportPage({ onNav }) {
  const [form, setForm]     = useState({ type:'', userId:'', description:'', evidence:'' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!form.type || !form.description) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 900)
  }

  return (
    <PageWrapper title="Report an Issue" subtitle="Support" onNav={onNav}>
      <p style={{ color:'var(--text-secondary)', lineHeight:1.8, marginBottom:32, fontSize:'.9rem', maxWidth:560 }}>Use this form to report a user, task, or platform issue. All reports are reviewed within 24 hours and kept confidential.</p>
      {sent ? (
        <div style={{ textAlign:'center', padding:'40px 20px', maxWidth:400 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✓</div>
          <div style={{ fontFamily:'var(--fd)', fontSize:'1.3rem', fontWeight:800, marginBottom:8 }}>Report submitted</div>
          <p style={{ color:'var(--text-secondary)', fontSize:'.875rem' }}>Our team will review your report and take appropriate action.</p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:560 }}>
          <div><label>Report Type</label>
            <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
              <option value="">Select report type</option>
              <option>Harassment or abusive behaviour</option>
              <option>Fraud or scam</option>
              <option>Fake reviews or trust score manipulation</option>
              <option>Prohibited task or service</option>
              <option>Academic dishonesty</option>
              <option>Off-platform payment request</option>
              <option>Technical bug or platform issue</option>
            </select>
          </div>
          <div><label>User ID or task link (if applicable)</label><input value={form.userId} onChange={e => setForm(f=>({...f,userId:e.target.value}))} placeholder="e.g. username or task #" /></div>
          <div><label>Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Describe what happened in as much detail as possible." style={{ minHeight:160 }} /></div>
          <div><label>Evidence (links or descriptions)</label><textarea value={form.evidence} onChange={e => setForm(f=>({...f,evidence:e.target.value}))} placeholder="Paste links to screenshots or describe any evidence you have." style={{ minHeight:80 }} /></div>
          <button type="submit" className="btn-p" style={{ alignSelf:'flex-start' }} disabled={loading}>
            {loading ? <Spinner /> : 'Submit Report →'}
          </button>
        </form>
      )}
    </PageWrapper>
  )
}

// ─── OAUTH CALLBACK PAGE ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT GATE — blocks app use until POPIA consent is explicitly given.
// Fires mainly for new Google users (OAuth can't capture consent at sign-in).
// ═══════════════════════════════════════════════════════════════════════════════
function ConsentGate({ onConsented, onDecline, onViewPrivacy }) {
  const toast = useToast()
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  async function accept() {
    if (!checked) { toast('Please tick the box to continue', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch(API_BASE + '/auth/consent', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rl_token')}` },
      })
      if (!res.ok) throw new Error('Could not record consent')
      onConsented()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(20,16,30,.72)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', maxWidth:460, width:'100%', padding:28, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize:'1.8rem', marginBottom:10 }}>🔒</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.35rem', marginBottom:10 }}>One quick thing before you start</h2>
        <p style={{ color:'var(--text-secondary)', lineHeight:1.6, fontSize:'.92rem', marginBottom:18 }}>
          To use ReLivR we need your agreement to how we handle your personal information, in line with South Africa’s POPIA. We collect only what’s needed to run the marketplace, and never sell your data.
        </p>
        <label style={{ display:'flex', gap:10, alignItems:'flex-start', cursor:'pointer', marginBottom:20, padding:'12px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', border:`1px solid ${checked?'var(--accent)':'var(--border)'}` }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop:3, width:16, height:16, cursor:'pointer', accentColor:'var(--accent)' }} />
          <span style={{ fontSize:'.86rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
            I agree to ReLivR’s processing of my personal information and have read the{' '}
            <button type="button" onClick={onViewPrivacy} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', padding:0, fontSize:'.86rem', textDecoration:'underline' }}>Privacy Policy</button>.
          </span>
        </label>
        <div style={{ display:'flex', gap:10 }}>
          <Btn loading={saving} onClick={accept} style={{ flex:1 }}>Agree & continue</Btn>
          <Btn variant="ghost" onClick={onDecline}>Cancel</Btn>
        </div>
        <p style={{ fontSize:'.72rem', color:'var(--text-muted)', marginTop:14, textAlign:'center' }}>
          Declining will sign you out — we can’t create your account without this consent.
        </p>
      </div>
    </div>
  )
}

// Google redirects back to http://localhost:3000/oauth-callback?token=xxx&...
// Vite serves index.html, React reads the query params and completes login.

function OAuthCallback() {
  const { handleOAuthCallback } = useAuth()
  const [error, setError] = useState(null)

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token')
    const userId   = params.get('userId')
    const errParam = params.get('auth_error') || params.get('error')

    // Clear the sensitive params from the browser URL bar immediately
    window.history.replaceState({}, document.title, '/')

    if (errParam) {
      setError(decodeURIComponent(errParam).replace(/_/g, ' '))
      return
    }

    if (!token || !userId) {
      setError('No authentication data received. Please try signing in again.')
      return
    }

    // handleOAuthCallback reads the params, sets user state, and calls setView('dashboard')
    const ok = handleOAuthCallback(params)
    if (!ok) {
      setError('Failed to process Google login. Please try again.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg-base)', color:'var(--text-primary)', padding:24 }}>
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius-md)', padding:24, maxWidth:400, textAlign:'center' }}>
          <div style={{ fontSize:'2rem', marginBottom:12 }}>⚠️</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', marginBottom:8 }}>Authentication Error</h2>
          <p style={{ color:'var(--text-secondary)', marginBottom:16 }}>{error}</p>
          <button className="btn-p" onClick={() => window.location.href = '/'}>Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg-base)', color:'var(--text-primary)' }}>
      <LogoLoader size={84} label="Completing Google sign-in…" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

// Monoline speech-bubble icon for Messages — replaces the ambiguous ◎ that mirrored
// the Alerts ◉ sitting right beside it. Uses currentColor + sizes to ~1em so it drops
// straight into the existing glyph nav.
function ChatIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display:'block' }}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  )
}

function TopBar({ page, setPage, unreadCount, onGoHome, onViewLanding, onSearch, theme, onToggleTheme }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const [searchText, setSearchText] = useState('')
  const isCreator = user.role === 'creator'
  // Desktop nav links — role-aware. These render in the top bar on every screen
  // wide enough to fit them, so navigation never depends on the mobile bottom bar.
  const isAdmin = user.role === 'admin'
  const navLinks = isAdmin
    ? [ { id:'dashboard', label:'Dashboard' }, { id:'admin-disputes', label:'Disputes' }, { id:'admin-users', label:'Users' }, { id:'admin-tasks', label:'Tasks' }, { id:'admin-businesses', label:'Businesses' }, { id:'admin-deals', label:'Deals' }, { id:'admin-locations', label:'Locations' }, { id:'admin-flags', label:'Flags' }, { id:'admin-audit', label:'Audit' } ]
    : [
        // "Browse" removed — it duplicated the Home route (the logo + mobile Home
        // tab both go to tasks-browse). Keeps the desktop nav free of redundancy.
        { id:'local-browse', label:'Local' },
        { id:'deals',        label:'Deals' },
        { id:'following',    label:'Following' },
        { id:'schedule',     label:'Schedule' },
        { id:'tasks-mine',   label:'My Tasks' },
        { id:'my-bids',      label:'My Bids' },
        { id:'my-orders',    label:'My Orders' },
      ]

  // ── Mobile chrome: compact header + full-width search + hamburger nav drawer ──
  if (isMobile) {
    const memberNav = [
      { id:'tasks-browse', label:'Home',       icon:'home' },
      { id:'tasks-new',    label:'Post a task', icon:'plus' },
      { id:'local-browse', label:'Local',      icon:'store' },
      { id:'deals',        label:'Deals',      icon:'tag' },
      { id:'following',    label:'Following',  icon:'heart' },
      { id:'schedule',     label:'Schedule',   icon:'calendar' },
      { id:'tasks-mine',   label:'My Tasks',   icon:'inbox' },
      { id:'my-bids',      label:'My Bids',    icon:'briefcase' },
      { id:'my-orders',    label:'My Orders',  icon:'store' },
      { id:'messages',     label:'Messages',   icon:'message' },
      { id:'notifications',label:'Notifications', icon:'bell' },
      { id:'profile',      label:'My Profile', icon:'user' },
      { id:'dashboard',    label:'Stats & Activity', icon:'chart' },
    ]
    const adminNav = [
      { id:'dashboard',       label:'Dashboard',  icon:'chart' },
      { id:'admin-disputes',  label:'Disputes',   icon:'scale' },
      { id:'admin-users',     label:'Users',      icon:'users' },
      { id:'admin-businesses',label:'Businesses', icon:'store' },
      { id:'admin-deals',     label:'Deals',      icon:'tag' },
      { id:'admin-tasks',     label:'All Tasks',  icon:'inbox' },
      { id:'admin-locations', label:'Locations',  icon:'pin' },
      { id:'admin-flags',     label:'Flags',      icon:'target' },
      { id:'notifications',   label:'Notifications', icon:'bell' },
      { id:'profile',         label:'My Profile', icon:'user' },
    ]
    const nav = isAdmin ? adminNav : memberNav
    const go = (id) => { setPage(id); setDrawerOpen(false) }
    const iconBtn = { width:40, height:40, borderRadius:'50%', border:'none', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
    const drawerRow = (active) => ({ display:'flex', alignItems:'center', gap:14, width:'100%', padding:'12px 20px', background:active?'var(--accent-glow)':'none', border:'none', borderLeft:`3px solid ${active?'var(--accent)':'transparent'}`, color:active?'var(--accent)':'var(--text-secondary)', fontSize:'.95rem', fontWeight:active?700:500, cursor:'pointer', textAlign:'left', fontFamily:'var(--font-body)' })
    const footRow = { display:'flex', alignItems:'center', gap:14, width:'100%', padding:'12px 20px', background:'none', border:'none', fontSize:'.9rem', color:'var(--text-secondary)', cursor:'pointer', textAlign:'left', fontFamily:'var(--font-body)' }
    return (
      <>
        <header style={{ position:'sticky', top:0, zIndex:90, background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, height:54, padding:'0 8px 0 6px' }}>
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" style={iconBtn}><Icon name="menu" size={22} color="var(--text-primary)" /></button>
            <Logo onClick={onGoHome} />
            <button onClick={() => setPage('notifications')} aria-label={unreadCount>0?`Alerts, ${unreadCount} unread`:'Alerts'}
              style={{ ...iconBtn, marginLeft:'auto', position:'relative', color:page==='notifications'?'var(--accent)':'var(--text-secondary)' }}>
              <Icon name="bell" size={21} />
              {unreadCount>0 && <span style={{ position:'absolute', top:5, right:5, background:'var(--danger)', color:'#fff', fontFamily:'var(--font-mono)', fontSize:'.52rem', fontWeight:700, minWidth:15, height:15, lineHeight:'15px', borderRadius:8, textAlign:'center', padding:'0 3px', boxShadow:'0 0 0 2px var(--bg-surface)' }}>{unreadCount>99?'99+':unreadCount}</span>}
            </button>
          </div>
          {/* Full-width search row — no longer squeezed */}
          <form role="search" style={{ padding:'0 12px 10px' }}
            onSubmit={e => { e.preventDefault(); const q = searchText.trim(); if (q) onSearch?.(q) }}>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', display:'flex', pointerEvents:'none' }}><Icon name="search" size={17} /></span>
              <input value={searchText} onChange={e => setSearchText(e.target.value)} aria-label="Search people, businesses, and tasks"
                placeholder="Search people, businesses, tasks…"
                style={{ width:'100%', padding:'11px 16px 11px 38px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'16px' }} />
            </div>
          </form>
        </header>

        {/* Slide-in nav drawer — transform driven inline so it can't be overridden */}
        <div className="doverlay" onClick={() => setDrawerOpen(false)} style={{ opacity:drawerOpen?1:0, pointerEvents:drawerOpen?'all':'none' }} />
        <aside className="drawer" style={{ padding:0, width:290, transform:drawerOpen?'translateX(0)':'translateX(100%)' }} aria-hidden={!drawerOpen}>
          <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover' }} />
              : <span style={{ width:44, height:44, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, color:'var(--accent)', flexShrink:0 }}>{(user.displayName||user.email||'?').charAt(0).toUpperCase()}</span>}
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:'.95rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.displayName || user.email?.split('@')[0]}</div>
              <div style={{ fontSize:'.72rem', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.email}</div>
            </div>
          </div>
          <nav style={{ padding:'6px 0' }}>
            {nav.map(item => {
              const active = page === item.id
              return (
                <button key={item.id} onClick={() => go(item.id)} style={drawerRow(active)}>
                  <Icon name={item.icon} size={19} color={active?'var(--accent)':'var(--text-muted)'} />
                  <span style={{ flex:1 }}>{item.label}</span>
                  {item.id==='notifications' && unreadCount>0 && <span style={{ background:'var(--danger)', color:'#fff', fontFamily:'var(--font-mono)', fontSize:'.6rem', fontWeight:700, padding:'1px 7px', borderRadius:10 }}>{unreadCount>99?'99+':unreadCount}</span>}
                </button>
              )
            })}
          </nav>
          <div style={{ borderTop:'1px solid var(--border)', padding:'6px 0', marginTop:2 }}>
            {onToggleTheme && <button onClick={onToggleTheme} style={footRow}><Icon name={theme==='dark'?'sun':'moon'} size={17} color="var(--text-muted)" />{theme==='dark'?'Light mode':'Dark mode'}</button>}
            <button onClick={() => { window.dispatchEvent(new Event('relivr:show-walkthrough')); setDrawerOpen(false) }} style={footRow}><Icon name="target" size={17} color="var(--text-muted)" />How ReLivR works</button>
            {onViewLanding && <button onClick={() => { onViewLanding(); setDrawerOpen(false) }} style={footRow}><Icon name="home" size={17} color="var(--text-muted)" />View public site</button>}
            <button onClick={() => { setDrawerOpen(false); logout() }} style={{ ...footRow, color:'var(--danger)' }}><Icon name="arrow" size={17} color="var(--danger)" style={{ transform:'rotate(180deg)' }} />Sign out</button>
          </div>
        </aside>
      </>
    )
  }

  return (
    <header style={{ position:'sticky', top:0, zIndex:90, background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', alignItems:'center', gap:14, height:60, padding:'0 20px' }}>
        <Logo onClick={onViewLanding || onGoHome} />

        {/* Desktop nav links — hidden on narrow screens (bottom bar takes over there) */}
        <nav className="topbar-nav" style={{ alignItems:'center', gap:2, marginLeft:6 }}>
          <button onClick={onGoHome}
            style={{ padding:'7px 12px', borderRadius:9, border:'none', background:'transparent', color:'var(--text-secondary)', fontSize:'.875rem', fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer', transition:'all 120ms ease' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Home</button>
          {navLinks.map(l => {
            const active = page === l.id
            return (
              <button key={l.id} onClick={() => setPage(l.id)}
                style={{ padding:'7px 12px', borderRadius:9, border:'none', background:active?'var(--accent-glow)':'transparent', color:active?'var(--accent)':'var(--text-secondary)', fontSize:'.875rem', fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer', transition:'all 120ms ease' }}
                onMouseEnter={e=>{ if(!active) e.currentTarget.style.background='var(--bg-hover)' }}
                onMouseLeave={e=>{ if(!active) e.currentTarget.style.background='transparent' }}>{l.label}</button>
            )
          })}
        </nav>

        {/* Universal search — people, businesses, and tasks. Submit → results page. */}
        <form className="topbar-search" role="search" style={{ flex:1, maxWidth:380, margin:'0 12px' }}
          onSubmit={e => { e.preventDefault(); const q = searchText.trim(); if (q) onSearch?.(q) }}>
          <div style={{ position:'relative' }}>
            <span aria-hidden="true" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'.95rem', pointerEvents:'none' }}>⌕</span>
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              aria-label="Search people, businesses, and tasks"
              placeholder="Search people, businesses, tasks…"
              style={{ width:'100%', padding:'9px 16px 9px 34px', borderRadius:100, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'.875rem' }} />
          </div>
        </form>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
          <button className="btn-p topbar-post" style={{ padding:'9px 18px', fontSize:'.85rem' }} onClick={() => setPage('tasks-new')}>＋ Post a Task</button>
          <button className="icon-btn" onClick={() => setPage('messages')} aria-label="Messages" title="Messages"
            style={{ width:38, height:38, borderRadius:'50%', border:'none', background:page==='messages'?'var(--accent-glow)':'transparent', color:page==='messages'?'var(--accent)':'var(--text-secondary)', fontSize:'1.05rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChatIcon size={19} /></button>
          <button className="icon-btn" onClick={() => setPage('notifications')} title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount!==1?'s':''}` : 'Alerts'}
            aria-label={unreadCount > 0 ? `Alerts, ${unreadCount} unread` : 'Alerts'}
            style={{ position:'relative', width:38, height:38, borderRadius:'50%', border:'none', background:page==='notifications'?'var(--accent-glow)':'transparent', color:page==='notifications'?'var(--accent)':'var(--text-secondary)', fontSize:'1.05rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span aria-hidden="true">◉</span>{unreadCount>0 && <span className="notif-badge" style={{ position:'absolute', top:2, right:2, background:'var(--danger)', color:'#fff', fontFamily:'var(--font-mono)', fontSize:'.55rem', fontWeight:700, minWidth:16, height:16, lineHeight:'16px', borderRadius:8, textAlign:'center', padding:'0 3px', boxShadow:'0 0 0 2px var(--bg-surface)' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {/* Avatar menu */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen} style={{ background:'none', border:'none', padding:2, cursor:'pointer', display:'flex' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--accent-dim)' }} />
                : <span aria-hidden="true" style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'.9rem', color:'var(--accent)' }}>{(user.displayName||user.email||'?').charAt(0).toUpperCase()}</span>}
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:91 }} />
                <div style={{ position:'absolute', right:0, top:44, zIndex:92, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:14, boxShadow:'0 12px 32px rgba(19,17,24,.14)', minWidth:200, overflow:'hidden', animation:'fadeUp .15s ease both' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>{user.displayName || user.email?.split('@')[0]}</div>
                    <Mono>{user.email}</Mono>
                  </div>
                  {[
                    { label:'My Profile', go:'profile' },
                    { label:'My Tasks', go:'tasks-mine' },
                    { label:'My Bids',  go:'my-bids' },
                    { label:'My Orders', go:'my-orders' },
                    // On mobile these have no bottom-tab, so surface them here too.
                    ...(isMobile && !isAdmin ? [
                      { label:'Local', go:'local-browse' },
                      { label:'Following', go:'following' },
                      { label:'Schedule', go:'schedule' },
                    ] : []),
                    { label:'Stats & Activity', go:'dashboard' },
                  ].map(item => (
                    <button key={item.go} onClick={() => { setPage(item.go); setMenuOpen(false) }}
                      style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', fontSize:'.875rem', color:'var(--text-secondary)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>{item.label}</button>
                  ))}
                  {onToggleTheme && <button onClick={onToggleTheme}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', borderTop:'1px solid var(--border)', fontSize:'.875rem', color:'var(--text-secondary)', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>{theme==='dark'?'Light mode':'Dark mode'}</button>}
                  <button onClick={() => { window.dispatchEvent(new Event('relivr:show-walkthrough')); setMenuOpen(false) }}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', borderTop:'1px solid var(--border)', fontSize:'.875rem', color:'var(--text-secondary)', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>How ReLivR works</button>
                  {onViewLanding && (
                    <button onClick={() => { onViewLanding(); setMenuOpen(false) }}
                      style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', borderTop:'1px solid var(--border)', fontSize:'.875rem', color:'var(--text-secondary)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>View public site</button>
                  )}
                  <button onClick={logout}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', borderTop:'1px solid var(--border)', fontSize:'.875rem', color:'var(--danger)', cursor:'pointer' }}>Sign Out</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

// DashSidebar (the mobile bottom tab bar) was removed — the hamburger drawer in
// TopBar is the sole mobile navigation now; desktop always used the TopBar links.

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGES
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ setPage, setSelectedTask }) {
  const { user } = useAuth()
  const { state } = useStore()
  const myTasks   = state.tasks.filter(t => t.creator_id==='u1')
  const openCount = state.tasks.filter(t => t.status==='open').length
  const doneCount = state.tasks.filter(t => t.status==='completed').length
  const myBids    = state.bids.filter(b => b.bidder_id==='u3')

  return (
    <div className="page-enter">
      <PageTitle sub={`Welcome back — ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}`}>Dashboard</PageTitle>
      <div style={{ display:'flex', gap:14, marginBottom:32, flexWrap:'wrap' }}>
        {user.role!=='admin' && <>
          <StatCard label="Tasks Posted" value={myTasks.length} />
          <StatCard label="Active Bids"  value={myBids.filter(b=>b.status==='pending'||b.status==='accepted').length} accent />
          <StatCard label="Completed"    value={doneCount} />
          <StatCard label="Open Tasks"   value={openCount} />
        </>}
        {user.role==='admin' && <>
          <StatCard label="Open Disputes" value={state.disputes.filter(d=>d.status==='open').length} accent />
          <StatCard label="Total Tasks"   value={state.tasks.length} />
          <StatCard label="Active Users"  value="24" />
          <StatCard label="Platform Fees" value="R340" />
        </>}
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:28, flexWrap:'wrap' }}>
        {user.role!=='admin' && <>
          <Btn onClick={() => setPage('tasks-new')}>+ Post New Task</Btn>
          <Btn variant="secondary" onClick={() => setPage('tasks-browse')}>Browse Tasks</Btn>
          <Btn variant="secondary" onClick={() => setPage('my-bids')}>My Bids</Btn>
          <Btn variant="secondary" onClick={() => setPage('messages')}>Messages</Btn>
        </>}
        {user.role==='admin' && <>
          <Btn onClick={() => setPage('admin-disputes')}>Review Disputes</Btn>
          <Btn variant="secondary" onClick={() => setPage('admin-users')}>Manage Users</Btn>
        </>}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <Mono size="0.75rem" color="var(--text-secondary)">Recent Activity</Mono>
        <Btn variant="ghost" size="sm" onClick={() => setPage('tasks-browse')}>View All →</Btn>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {state.tasks.slice(0,5).map(task => (
          <DCard key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }} style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 18px' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                <Badge variant={taskState(task).variant}>{taskState(task).label}</Badge>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.95rem' }}>{task.title}</span>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{task.skill_tags.slice(0,3).map(t => <Tag key={t}>{t}</Tag>)}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.05rem', color:'var(--accent)', fontWeight:500 }}>R{task.budget}</div>
              <Mono>{new Date(task.deadline).toLocaleDateString()}</Mono>
            </div>
          </DCard>
        ))}
      </div>
    </div>
  )
}

// ─── MARKETPLACE CATEGORY SYSTEM ─────────────────────────────────────────────
// Every task gets illustrated cover art derived from its tags — gradient +
// icon — so the feed reads like a marketplace of services, not a data table.
const CATEGORIES = [
  { name:'Tech & Coding',   icon:'💻', g:['#ede9fe','#c4b5fd'], kw:['python','react','node','javascript','debug','api','postgres','sql','database','mobile','firebase','etl','machine','rest'] },
  { name:'Tutoring',        icon:'📚', g:['#fef3c7','#fcd34d'], kw:['tutor','math','lesson','teach','study','exam'] },
  { name:'Errands',         icon:'🛵', g:['#dcfce7','#86efac'], kw:['laundry','delivery','errand','pickup','shopping','collect'] },
  { name:'Design',          icon:'🎨', g:['#fce7f3','#f9a8d4'], kw:['design','figma','ui','ux','logo','poster'] },
  { name:'Writing',         icon:'✍️', g:['#e0f2fe','#7dd3fc'], kw:['writing','editing','proofread','essay','translat','lang','transcrib'] },
  { name:'Music & Arts',    icon:'🎸', g:['#fee2e2','#fca5a5'], kw:['music','guitar','piano','art','photo'] },
  { name:'Moving & Labour', icon:'📦', g:['#ffedd5','#fdba74'], kw:['moving','furniture','labour','clean','garden'] },
  { name:'Other',           icon:'✨', g:['#f3f1ec','#ddd8cb'], kw:[] },
]

// Redesign: map category name → Icon name, so both the fallback list above AND
// DB-fetched categories render a real stroked icon (never the old emoji).
const CATEGORY_ICON = {
  'Tech & Coding':'code', 'Tutoring':'book', 'Errands':'bike', 'Design':'palette',
  'Writing':'pen', 'Music & Arts':'music', 'Moving & Labour':'truck', 'Other':'sparkles',
}
const categoryIcon = (name) => CATEGORY_ICON[name] || 'sparkles'

function categoryFor(task) {
  const hay = ((task.skill_tags || []).join(' ') + ' ' + (task.title || '')).toLowerCase()
  return CATEGORIES.find(c => c.kw.some(k => hay.includes(k))) || CATEGORIES[CATEGORIES.length - 1]
}

// ─── SKILL-TAG SUGGESTIONS ───────────────────────────────────────────────────
// Reads a task's title + description and proposes skill tags to add — so a poster
// who writes "laundry picked up from X and delivered to Y" is offered
// "Errands · Delivery · Laundry · Pickup" instead of leaving tags empty. Good tags
// feed the Jaccard matching engine, so this directly improves earner matching.
// Rule-based on purpose: instant, free, and fully client-side (POPIA — the
// description never leaves the browser). An optional AI tier can layer on later.
//
// Trigger phrase → canonical tag. Multi-word keys are checked as substrings, so
// "drop off" matches before "off". Keep triggers lowercase.
const TAG_KEYWORDS = {
  // Errands & delivery
  laundry:'Laundry', washing:'Laundry', ironing:'Ironing',
  deliver:'Delivery', delivery:'Delivery', courier:'Delivery', 'drop off':'Delivery', dropoff:'Delivery', 'drop-off':'Delivery',
  'pick up':'Pickup', pickup:'Pickup', 'pick-up':'Pickup', collect:'Pickup', fetch:'Pickup',
  shopping:'Shopping', groceries:'Groceries', errand:'Errands',
  // Tech & coding
  python:'Python', react:'React', node:'Node.js', javascript:'JavaScript', typescript:'TypeScript',
  debug:'Debugging', bug:'Debugging', api:'API', postgres:'PostgreSQL', sql:'SQL', database:'Database',
  website:'Web Development', 'web app':'Web Development', mobile:'Mobile', firebase:'Firebase',
  // Tutoring
  tutor:'Tutoring', teach:'Tutoring', lesson:'Lessons', math:'Maths', maths:'Maths',
  calculus:'Maths', physics:'Physics', chemistry:'Chemistry', exam:'Exam Prep', study:'Study Help',
  // Writing
  proofread:'Proofreading', 'proof read':'Proofreading', essay:'Essay', editing:'Editing', edit:'Editing',
  writing:'Writing', 'copy writing':'Copywriting', copywriting:'Copywriting', translat:'Translation', transcrib:'Transcription',
  // Design
  design:'Design', figma:'Figma', logo:'Logo Design', poster:'Poster', 'ui/ux':'UI/UX', illustrat:'Illustration',
  // Music & arts
  guitar:'Guitar', piano:'Piano', music:'Music', 'photo':'Photography', video:'Videography', art:'Art',
  // Moving & labour
  moving:'Moving', furniture:'Furniture', clean:'Cleaning', garden:'Gardening', labour:'Labour', assembl:'Assembly',
}

// Suggest up to `limit` skill tags for a free-text description (+ optional title).
// Returns matched category names first (broad, drive the feed filter), then the
// specific tags above — de-duplicated and excluding anything already added.
function suggestTags(text, existing = [], limit = 6) {
  const hay = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' '
  const have = new Set(existing.map(t => String(t).toLowerCase().trim()))
  const out = []
  const seen = new Set()
  const push = (tag) => {
    const key = tag.toLowerCase()
    if (!seen.has(key) && !have.has(key)) { seen.add(key); out.push(tag) }
  }
  // Match a keyword only at a word boundary, so short triggers like "ui" or "art"
  // don't fire inside "req(ui)re" or "st(art)". Stems still work: "translat"
  // matches "translation" because it's the start of that word.
  const hit = (kw) => new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)
  // 1) Matched categories first — these are the "Errands"-style broad tags.
  for (const c of CATEGORIES) {
    if (c.name === 'Other') continue
    if (c.kw.some(hit)) push(c.name)
  }
  // 2) Specific skill tags from trigger phrases.
  for (const [kw, tag] of Object.entries(TAG_KEYWORDS)) {
    if (hit(kw)) push(tag)
  }
  return out.slice(0, limit)
}

// Data-driven category list for the filter rail — fetched from GET /categories
// (so a new category is a DB insert, not a deploy), falling back to the constant.
function useCategories() {
  const [cats, setCats] = useState(CATEGORIES)
  useEffect(() => {
    let alive = true
    fetch(API_BASE + '/categories')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('categories fetch failed'))))
      .then(d => { if (alive && d.categories?.length) setCats(d.categories) })
      .catch(() => { /* keep the fallback */ })
    return () => { alive = false }
  }, [])
  return cats
}

// Batch 4: horizontal rail of providers who are available right now — either
// online (heartbeat in the last 5 min) or inside their declared working hours.
// Auth-only, coarse (a green dot / "open now" pill, never an exact timestamp).
// Renders nothing when the list is empty, so it never leaves a dead gap.
function AvailableNowRail({ openProfile }) {
  const [providers, setProviders] = useState([])
  const token = () => localStorage.getItem('rl_token')
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(API_BASE + '/availability/now', { headers: { Authorization: `Bearer ${token()}` } })
        if (!res.ok) return
        const { providers } = await res.json()
        if (!cancelled) setProviders(Array.isArray(providers) ? providers : [])
      } catch { /* backend offline — just hide the rail */ }
    }
    load()
    const id = setInterval(load, 90_000) // keep the dots fresh without hammering
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (providers.length === 0) return null
  return (
    <div style={{ marginBottom:18 }}>
      <div className="slabel" style={{ color:'var(--text-secondary)', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--live)', boxShadow:'0 0 0 3px color-mix(in srgb, var(--live) 22%, transparent)' }} />
        Available now
      </div>
      <div className="feed-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
        {providers.map(p => (
          <button key={p.userId} onClick={() => openProfile(p.userId)}
            title={p.headline || (p.online ? 'Online now' : 'Within working hours')}
            style={{ flex:'0 0 auto', display:'flex', alignItems:'center', gap:10, padding:'8px 14px 8px 8px', borderRadius:100, cursor:'pointer', border:'1px solid var(--border)', background:'var(--bg-surface)', transition:'border-color 150ms ease, transform 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>
            <span style={{ position:'relative', flexShrink:0 }}>
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover' }} />
                : <span style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'.85rem' }}>{(p.displayName || '?').charAt(0).toUpperCase()}</span>}
              {p.online && <span aria-label="Online" title="Online" style={{ position:'absolute', right:-1, bottom:-1, width:11, height:11, borderRadius:'50%', background:'var(--live)', border:'2px solid var(--bg-surface)' }} />}
            </span>
            <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.2 }}>
              <span style={{ fontWeight:600, fontSize:'.85rem', whiteSpace:'nowrap' }}>{p.displayName || 'ReLivR user'}</span>
              <span style={{ fontSize:'.68rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                {p.online ? 'online' : 'open now'}{p.avgRating > 0 ? ` · ★ ${Number(p.avgRating).toFixed(1)}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Promoted businesses on the tasks feed — the payoff of a business's "Boost".
// Only shows genuinely-boosted, active businesses; clearly labelled "Promoted";
// clicking reuses the QR deep-link plumbing to open the business in Local.
function FeaturedBusinessStrip({ setPage }) {
  const [biz, setBiz] = useState([])
  useEffect(() => {
    let cancelled = false
    fetch(API_BASE + '/businesses/featured')
      .then(r => r.ok ? r.json() : { businesses: [] })
      .then(d => { if (!cancelled) setBiz(Array.isArray(d.businesses) ? d.businesses : []) })
      .catch(() => { /* offline — hide */ })
    return () => { cancelled = true }
  }, [])
  if (biz.length === 0) return null
  const open = (id) => { try { sessionStorage.setItem('rl_pending_biz', id) } catch { /* noop */ } ; setPage('local-browse') }
  return (
    <div style={{ marginBottom:18 }}>
      <div className="slabel" style={{ color:'var(--text-secondary)', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
        <Icon name="store" size={13} color="var(--highlight)" /> Promoted locally
      </div>
      <div className="feed-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
        {biz.map(b => (
          <button key={b.business_id} onClick={() => open(b.business_id)}
            style={{ position:'relative', flex:'0 0 auto', width:230, textAlign:'left', display:'flex', gap:11, alignItems:'center', padding:'11px 13px', borderRadius:'var(--radius-md)', cursor:'pointer', border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', transition:'border-color 150ms ease, transform 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none' }}>
            <span style={{ position:'absolute', top:7, right:9, fontFamily:'var(--font-mono)', fontSize:'.52rem', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-muted)' }}>Ad</span>
            {b.logo_url
              ? <img src={b.logo_url} alt="" style={{ width:40, height:40, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
              : <span style={{ width:40, height:40, borderRadius:10, background:'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Icon name="store" size={19} color="var(--accent)" /></span>}
            <span style={{ minWidth:0 }}>
              <span style={{ display:'block', fontWeight:700, fontSize:'.85rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.name}</span>
              <span style={{ display:'block', fontFamily:'var(--font-mono)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.04em', marginTop:2 }}>{b.category || 'Local business'}{b.avg_rating > 0 ? ` · ★ ${Number(b.avg_rating).toFixed(1)}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TaskBrowse({ setPage, setSelectedTask, openProfile }) {
  const { state } = useStore()
  const [skill, setSkill]   = useState('')
  const [cat, setCat]       = useState(null)
  const cats = useCategories()
  const [status, setStatus] = useState('all')
  const [sort, setSort]     = useState('newest')
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const token = () => localStorage.getItem('rl_token')
  const zoneCoords = useZoneCoords()
  const [myLoc, setMyLoc] = useState(null) // {lat,lng} for this browse session only, or null

  // Load open tasks from the database (shared across all accounts)
  async function loadTasks() {
    try {
      // Pull a broad set; filtering/sorting happens client-side below
      const res = await fetch(API_BASE + '/tasks?status=open&limit=100', { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      // Normalise: ensure skill_tags is always an array
      setTasks((data.tasks || []).map(t => ({ ...t, skill_tags: t.skill_tags || [] })))
      setOffline(false)
    } catch {
      setTasks(state.tasks)   // offline fallback to mock
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTasks() }, []) // eslint-disable-line
  useEffect(() => {
    if (offline) return
    const id = setInterval(loadTasks, 8000)  // new tasks appear within ~8s
    return () => clearInterval(id)
  }, [offline]) // eslint-disable-line

  const bidCount = (taskId) => {
    // Backend includes bid_count when available; fall back to mock store
    const t = tasks.find(x => x.task_id === taskId)
    if (t && typeof t.bid_count === 'number') return t.bid_count
    return state.bids.filter(b=>b.task_id===taskId && b.status!=='withdrawn').length
  }

  // Distance from `myLoc` to a task's zone centroid — undefined when either
  // side of the comparison is unknown (no consent yet, or the task has no zone).
  const taskDistance = (t) => {
    if (!myLoc || !t.campus_zone || !zoneCoords[t.campus_zone]) return undefined
    const z = zoneCoords[t.campus_zone]
    return distanceKm(myLoc.lat, myLoc.lng, z.lat, z.lng)
  }

  const filtered = tasks
    .filter(t => (status==='all'||t.status===status) && (!cat || categoryFor(t).name===cat) && (!skill||(t.skill_tags||[]).some(s=>s.toLowerCase().includes(skill.toLowerCase()))||t.title.toLowerCase().includes(skill.toLowerCase())))
    .sort((a,b) => {
      if (sort==='distance') { const da = taskDistance(a), db = taskDistance(b); if (da==null&&db==null) return 0; if (da==null) return 1; if (db==null) return -1; return da-db }
      if (sort==='newest')    return new Date(b.created_at)-new Date(a.created_at)
      if (sort==='budget-hi') return parseFloat(b.budget)-parseFloat(a.budget)
      if (sort==='budget-lo') return parseFloat(a.budget)-parseFloat(b.budget)
      if (sort==='deadline')  return new Date(a.deadline)-new Date(b.deadline)
      return 0
    })

  const filtersActive = skill||cat||status!=='all'||sort!=='newest'

  // Live category counts from the loaded open tasks (Serv-style "populated" signal).
  // Honest: reflects the tasks actually loaded, never a fabricated number.
  const catCounts = {}
  tasks.forEach(t => { if (t.status === 'open') { const n = categoryFor(t).name; catCounts[n] = (catCounts[n] || 0) + 1 } })

  return (
    <div className="page-enter">
      {/* Marketplace hero — search-first, like Fiverr/FB Marketplace */}
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.5rem,3vw,2.1rem)', letterSpacing:'-0.01em', marginBottom:14 }}>What do you need done?</h1>
        <div style={{ position:'relative', maxWidth:560 }}>
          <span style={{ position:'absolute', left:15, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', display:'flex' }}><Icon name="search" size={18} /></span>
          <input id="feed-search" placeholder="Search — laundry, python, tutoring…" value={skill} onChange={e => setSkill(e.target.value)}
            style={{ padding:'14px 16px 14px 44px', borderRadius:14, fontSize:'1rem', background:'var(--bg-surface)', boxShadow:'0 1px 4px rgba(19,17,24,.07)' }} />
        </div>
      </div>

      {/* Illustrated category rail */}
      <div className="feed-scroll" style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:18, paddingBottom:4 }}>
        {cats.map(c => {
          const active = cat === c.name
          return (
            <button key={c.name} onClick={() => setCat(active ? null : c.name)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:100, whiteSpace:'nowrap', cursor:'pointer', transition:'all 150ms ease', border:`1px solid ${active?'var(--text-primary)':'var(--border-strong)'}`, background:active?'var(--text-primary)':'var(--bg-surface)', color:active?'var(--bg-base)':'var(--text-primary)', fontWeight:600, fontSize:'.85rem', fontFamily:'var(--font-body)' }}>
              <Icon name={categoryIcon(c.name)} size={15} color={active?'var(--bg-base)':'var(--text-muted)'} />{titleCase(c.name)}
              {catCounts[c.name] > 0 && <span style={{ fontSize:'.75rem', fontWeight:500, color:active?'var(--bg-base)':'var(--text-muted)', opacity:.75 }}>{catCounts[c.name]}</span>}
            </button>
          )
        })}
      </div>

      <AvailableNowRail openProfile={openProfile} />
      <FeaturedBusinessStrip setPage={setPage} />

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <Mono>{filtered.length} open task{filtered.length!==1?'s':''} near you</Mono>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap', flex:'1 1 auto', justifyContent:'flex-end' }}>
        <SelectField value={status} onChange={e => setStatus(e.target.value)} style={{ flex:'1 1 130px', minWidth:120 }}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="disputed">Disputed</option>
        </SelectField>
        <SelectField value={sort} onChange={e => setSort(e.target.value)} style={{ flex:'1 1 140px', minWidth:130 }}>
          <option value="newest">Newest First</option>
          {myLoc && <option value="distance">Nearest First</option>}
          <option value="budget-hi">Budget: High → Low</option>
          <option value="budget-lo">Budget: Low → High</option>
          <option value="deadline">Deadline: Soonest</option>
        </SelectField>
          <NearMeToggle active={!!myLoc}
            onLocated={loc => { setMyLoc(loc); setSort('distance') }}
            onCleared={() => { setMyLoc(null); if (sort==='distance') setSort('newest') }} />
          {filtersActive && <Btn variant="ghost" size="sm" onClick={() => { setSkill(''); setCat(null); setStatus('all'); setSort('newest'); setMyLoc(null) }}>✕ Clear</Btn>}
        </div>
      </div>
      {loading && <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>}
      {/* Corporate LIST rows (Thumbtack/TaskRabbit results grammar) — the
          category's gradient art becomes the row thumbnail. */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {!loading && filtered.map(task => {
          const c = categoryFor(task)
          const dist = taskDistance(task)
          const state = taskState(task)
          return (
          <div key={task.task_id} className="task-row" onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }}
            role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); setSelectedTask(task.task_id); setPage('task-detail') } }}>
            <div className="task-row-thumb" style={{ background:`linear-gradient(135deg, ${c.g[0]}, ${c.g[1]})` }}>
              <Icon name={categoryIcon(c.name)} size={38} color="rgba(0,0,0,.45)" />
            </div>
            <div style={{ flex:1, minWidth:0, padding:'15px 18px', display:'flex', flexDirection:'column', gap:6 }}>
              <span style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text-muted)' }}>{c.name}</span>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.06rem', fontWeight:700, lineHeight:1.3, letterSpacing:'-.01em', margin:0 }}>{task.title}{task.assignment_mode==='fcfs' && <span style={{ marginLeft:8, verticalAlign:'middle', display:'inline-block', fontSize:'.6rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', padding:'2px 7px', borderRadius:999, background:'var(--text-primary)', color:'var(--bg-base)' }}>Claim now</span>}</h2>
              <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', fontSize:'.8rem', color:'var(--text-muted)' }}>
                <Icon name="pin" size={12} /><span>{task.campus_zone || 'Your area'}{dist!=null?` · ${dist<1?Math.round(dist*1000)+'m':dist.toFixed(1)+'km'} away`:''}</span>
                <span>· {timeAgo(task.created_at)}</span>
                {task.expected_duration && <span>· {task.expected_duration}</span>}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:2 }}>{task.skill_tags.slice(0,3).map(t => <Tag key={t}>{t}</Tag>)}</div>
            </div>
            <div className="task-row-side">
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.25rem', letterSpacing:'-.02em', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>R{task.budget}</div>
                <div style={{ fontSize:'.7rem', color:'var(--text-muted)', marginTop:3 }}>{task.assignment_mode==='fcfs'?'fixed price':'budget'}</div>
              </div>
              <Badge variant={state.variant}>{state.label}</Badge>
              <span style={{ fontSize:'.74rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{task.assignment_mode==='fcfs' ? 'First come, first serve' : `${bidCount(task.task_id)} bid${bidCount(task.task_id)!==1?'s':''}`} · Due {new Date(task.deadline).toLocaleDateString()}</span>
            </div>
          </div>
          )
        })}
        {filtered.length===0 && <div><EmptyState icon="inbox" message="No tasks match your filter" action={filtersActive?<Btn variant="secondary" size="sm" onClick={() => { setSkill(''); setCat(null); setStatus('all'); setSort('newest') }}>Clear Filters</Btn>:null} /></div>}
      </div>
    </div>
  )
}

// C3: a compact progress stepper for the two-party task journey.
function StatusTimeline({ status }) {
  const steps = [['open','Posted'], ['in_progress','In progress'], ['submitted','Submitted'], ['completed','Completed']]
  const order = steps.map(s => s[0])
  const cur = order.indexOf(status === 'disputed' ? 'submitted' : status)
  return (
    <DCard hover={false} style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'flex-start' }}>
        {steps.map(([key, label], i) => {
          const done = i <= cur
          return (
            <React.Fragment key={key}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flexShrink:0, width:64 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.68rem', fontWeight:700, background:done?'var(--accent)':'var(--bg-elevated)', color:done?'#fff':'var(--text-muted)', border:done?'none':'1px solid var(--border)' }}>{done?'✓':i+1}</div>
                <span style={{ fontSize:'.64rem', textAlign:'center', color:i===cur?'var(--accent)':'var(--text-muted)', fontWeight:i===cur?700:500 }}>{label}</span>
              </div>
              {i < steps.length-1 && <div style={{ flex:1, height:2, background:i<cur?'var(--accent)':'var(--border)', marginTop:10 }} />}
            </React.Fragment>
          )
        })}
      </div>
    </DCard>
  )
}

// C1/C2: the price handshake between the two parties of an awarded task. Either
// proposes; the other confirms; acceptance becomes the on-platform agreed price.
function TaskAgreementPanel({ taskId, task, otherName, onAgreed }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const myId = (() => { try { return JSON.parse(localStorage.getItem('rl_user') || 'null')?.userId } catch { return null } })()
  const [data, setData] = useState(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => fetch(`${API_BASE}/tasks/${taskId}/agreements`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : { agreements: [], agreedAmount: null }).then(setData).catch(() => setData({ agreements: [], agreedAmount: null }))
  useEffect(() => { load() }, [taskId]) // eslint-disable-line

  const pending = data?.agreements?.find(a => a.status === 'proposed')
  const agreed = data?.agreedAmount ?? task.agreed_amount

  async function propose() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/agreements`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ amount: amt, note: note.trim() || null }) })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not propose')
      toast(`Price proposed — waiting for ${otherName} to confirm`, 'success'); setAmount(''); setNote(''); load()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  async function respond(agreementId, accept) {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/agreements/${agreementId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ accept }) })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not respond')
      toast(accept ? 'Price agreed ✓' : 'Proposal declined', accept ? 'success' : 'info')
      if (accept && d.agreedAmount != null && onAgreed) onAgreed(d.agreedAmount)
      load()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <DCard hover={false}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:8 }}>
        <Mono size="0.68rem" color="var(--accent)">Price agreement</Mono>
        {agreed != null && <span style={{ fontFamily:'var(--font-display)', fontWeight:800 }}>Agreed: R{agreed}</span>}
      </div>
      {pending ? (
        <div style={{ border:'1px solid var(--accent)', background:'var(--accent-glow)', borderRadius:'var(--radius-sm)', padding:12 }}>
          <div style={{ fontWeight:700 }}>R{pending.amount} proposed {pending.proposed_by === myId ? 'by you' : `by ${otherName}`}</div>
          {pending.note && <p style={{ fontSize:'.82rem', color:'var(--text-secondary)', margin:'6px 0 0', lineHeight:1.5 }}>{pending.note}</p>}
          {pending.proposed_by === myId
            ? <Mono style={{ display:'block', marginTop:8, color:'var(--text-muted)' }}>Waiting for {otherName} to confirm…</Mono>
            : <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                <Btn variant="success" size="sm" loading={busy} onClick={() => respond(pending.agreement_id, true)}>Accept R{pending.amount}</Btn>
                <Btn variant="secondary" size="sm" onClick={() => respond(pending.agreement_id, false)}>Decline</Btn>
              </div>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Input label="Propose a price (R)" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder={agreed != null ? String(agreed) : 'e.g. 350'} />
          <Input label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} placeholder="Why the change?" />
          <Btn size="sm" loading={busy} onClick={propose}>Propose to {otherName}</Btn>
        </div>
      )}
      {data?.agreements?.length > 0 && (
        <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:6 }}>
          {data.agreements.slice(0, 6).map(a => (
            <div key={a.agreement_id} style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem', color:'var(--text-secondary)' }}>
              <span>R{a.amount} · {a.proposed_by_name || 'User'}</span>
              <span style={{ color: a.status==='accepted'?'var(--success)':a.status==='declined'?'var(--danger)':'var(--text-muted)' }}>{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </DCard>
  )
}

function TaskDetail({ taskId, setPage, openChat }) {
  const { user } = useAuth()
  const { state, dispatch } = useStore()
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')

  // Live task + bids from the database (shared across accounts)
  const [task, setTask]   = useState(state.tasks.find(t => t.task_id===taskId) || null)
  const [bids, setBids]   = useState(state.bids.filter(b => b.task_id===taskId&&b.status!=='withdrawn'))
  const [loadingTask, setLoadingTask] = useState(true)
  const escrow = state.escrows[taskId]
  const [editOpen, setEditOpen]   = useState(false)
  const [editForm, setEditForm]   = useState({ title:'', description:'', budget:'', deadline:'' })
  const [editSaving, setEditSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [extending, setExtending]   = useState(false)

  function openEdit() {
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      budget: String(task.budget || ''),
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : '',
    })
    setEditOpen(true)
  }
  async function saveEdit() {
    setEditSaving(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          budget: parseFloat(editForm.budget),
          deadline: new Date(editForm.deadline).toISOString(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not save changes')
      setTask({ ...data.task, skill_tags: data.task.skill_tags || [] })
      setEditOpen(false)
      toast('Task updated', 'success')
    } catch (err) { toast(err.message, 'error') } finally { setEditSaving(false) }
  }
  async function cancelTask() {
    const reason = window.prompt('Cancel this task? Any pending bids will be declined.\n\nOptional — tell bidders why (leave blank to skip):')
    if (reason === null) return   // creator dismissed the dialog
    setCancelling(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/cancel`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ reason: reason.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not cancel task')
      toast('Task cancelled', 'success')
      setPage('tasks-mine')
    } catch (err) { toast(err.message, 'error') } finally { setCancelling(false) }
  }

  async function extendTask() {
    setExtending(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/extend`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not extend task')
      setTask(t => ({ ...t, deadline: data.task.deadline }))
      toast('Deadline extended by 7 days', 'success')
    } catch (err) { toast(err.message, 'error') } finally { setExtending(false) }
  }

  async function loadTask({ silent = false } = {}) {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setTask({ ...data.task, skill_tags: data.task.skill_tags || [] })
      setBids((data.bids || []).filter(b => b.status !== 'withdrawn'))
    } catch {
      // offline fallback to mock store
      if (!silent) {
        setTask(state.tasks.find(t => t.task_id===taskId) || null)
        setBids(state.bids.filter(b => b.task_id===taskId&&b.status!=='withdrawn'))
      }
    } finally {
      setLoadingTask(false)
    }
  }

  useEffect(() => { loadTask() }, [taskId]) // eslint-disable-line
  // Poll so a new bid (or acceptance) from the other account appears within ~5s
  useEffect(() => {
    const id = setInterval(() => loadTask({ silent:true }), 5000)
    return () => clearInterval(id)
  }, [taskId]) // eslint-disable-line

  const [bidAmount, setBidAmount]   = useState('')
  const [bidPitch, setBidPitch]     = useState('')
  const [bidErrors, setBidErrors]   = useState({})
  const [bidLoading, setBidLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [acceptModal, setAcceptModal] = useState(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [releaseModal, setReleaseModal]   = useState(false)
  const [releaseLoading, setReleaseLoading] = useState(false)
  const [fundModal, setFundModal]         = useState(false)
  const [fundLoading, setFundLoading]     = useState(false)
  const [disputeModal, setDisputeModal]   = useState(false)
  const [disputeText, setDisputeText]     = useState('')
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [reviewModal, setReviewModal]     = useState(false)
  const [reviewRating, setReviewRating]   = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewDone, setReviewDone]       = useState(!!state.reviews.find(r=>r.task_id===taskId))

  const myBid      = bids.find(b=>b.bidder_id===user.userId)
  const alreadyBid = !!myBid && myBid.status!=='withdrawn'
  const isOwner    = task && task.creator_id === user.userId
  const isCreator  = isOwner                       // can manage this task
  const isEarner   = task && !isOwner              // can bid on it
  const isFcfs     = task?.assignment_mode === 'fcfs'   // fixed-price, claim-to-win
  const bidsClosed = !!(task && task.bids_close_at && new Date(task.bids_close_at) <= new Date())
  const acceptedBid = bids.find(b=>b.status==='accepted')
  const currentStatus = task?.status

  if (loadingTask && !task) return <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>
  if (!task) return <EmptyState message="Task not found" action={<Btn onClick={() => setPage('tasks-browse')}>← Back</Btn>} />

  async function submitBid() {
    const errs = {}
    if (!bidAmount||isNaN(bidAmount)||parseFloat(bidAmount)<=0) errs.amount='Enter a valid amount'
    if (!bidPitch.trim()||bidPitch.trim().length<20) errs.pitch='Pitch must be at least 20 characters'
    if (Object.keys(errs).length) { setBidErrors(errs); return }
    setBidErrors({}); setBidLoading(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/bids`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ amount: parseFloat(bidAmount), pitch: bidPitch.trim() }),
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.message || 'Could not submit bid')
      toast(`Bid of R${bidAmount} submitted!`, 'success')
      setBidAmount(''); setBidPitch('')
      await loadTask({ silent:true })   // refresh so the new bid shows immediately
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBidLoading(false)
    }
  }

  // FCFS: claim the fixed-price task outright. A 409 means someone beat us to it.
  async function submitClaim() {
    setClaimLoading(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/claim`, {
        method:'POST',
        headers:{ Authorization:`Bearer ${token()}` },
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.message || 'Could not claim this task')
      toast('Task claimed — it\'s yours. Message the poster to coordinate.', 'success')
      await loadTask({ silent:true })   // flips to in_progress, assigned to me
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setClaimLoading(false)
    }
  }

  async function confirmAccept() {
    setAcceptLoading(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/bids/${acceptModal.bid_id}/accept`, {
        method:'PATCH',
        headers:{ Authorization:`Bearer ${token()}` },
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.message || 'Could not accept bid')
      toast('Bid accepted! The earner has been notified.', 'success')
      setAcceptModal(null)
      await loadTask({ silent:true })   // task flips to in_progress for both accounts
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setAcceptLoading(false)
    }
  }

  function confirmFund() {
    setFundLoading(true)
    setTimeout(() => {
      dispatch({ type:'SET_ESCROW', task_id:taskId, status:'funded' })
      toast('Escrow funded! Earner notified to begin.', 'success')
      setFundLoading(false); setFundModal(false)
    }, 1200)
  }

  async function confirmComplete() {
    setReleaseLoading(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
        method:'PATCH',
        headers:{ Authorization:`Bearer ${token()}` },
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.message || 'Could not mark complete')
      toast('Task marked complete! You can now leave a review.', 'success')
      setReleaseModal(false)
      await loadTask({ silent:true })
      setTimeout(() => setReviewModal(true), 500)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setReleaseLoading(false)
    }
  }

  async function submitWork() {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/submit`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not submit work')
      toast('Work submitted — the creator will review it', 'success')
      await loadTask({ silent:true })
    } catch (err) { toast(err.message, 'error') }
  }
  async function requestChanges() {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/request-changes`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not request changes')
      toast('Sent back to the earner for changes', 'success')
      await loadTask({ silent:true })
    } catch (err) { toast(err.message, 'error') }
  }

  function confirmDispute() {
    if (!disputeText.trim()||disputeText.trim().length<20) { toast('Please provide at least 20 characters', 'error'); return }
    setDisputeLoading(true)
    setTimeout(() => {
      dispatch({ type:'UPDATE_TASK', task_id:taskId, changes:{status:'disputed'} })
      dispatch({ type:'SET_ESCROW', task_id:taskId, status:'disputed' })
      dispatch({ type:'ADD_DISPUTE', dispute:{ dispute_id:`d${Date.now()}`, task_id:taskId, task_title:task.title, creator_email:user.email, earner_email:'earner@demo.com', reason:disputeText.trim(), status:'open', opened_at:new Date().toISOString(), amount_cents:parseFloat(task.budget)*100, evidence_urls:[] } })
      toast('Dispute raised. Admin will review within 24 hours.', 'warning')
      setDisputeLoading(false); setDisputeModal(false); setDisputeText('')
    }, 1000)
  }

  async function submitReview() {
    if (!reviewRating) { toast('Please select a star rating', 'error'); return }
    setReviewLoading(true)
    try {
      const res = await fetch(API_BASE + '/reviews', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ task_id: taskId, rating: reviewRating, comment: reviewComment.trim() }),
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.message || 'Could not submit review')
      toast('Review submitted — thank you!', 'success')
      setReviewModal(false); setReviewDone(true)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setReviewLoading(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth:920 }}>
      <BackButton onClick={() => { if (window.history.length > 1) window.history.back(); else setPage('tasks-browse') }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
            <Badge variant={taskState({ ...task, status: currentStatus }).variant}>{taskState({ ...task, status: currentStatus }).label}</Badge>
            <Mono>Task #{task.task_id}</Mono>
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.9rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.03em', lineHeight:1.1, maxWidth:580 }}>{task.title}</h1>
          {task.creator_name && (
            <div style={{ marginTop:8 }}>
              <Mono>Posted by </Mono>
              <span onClick={() => openProfile(task.creator_id)} style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--accent)', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.08em' }}>{isOwner ? 'you' : task.creator_name}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.6rem', color:'var(--accent)', fontWeight:500 }}>R{task.budget}</div>
          <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
        </div>
      </div>

      {/* Creator controls — only while the task is still open */}
      {task.creator_id === user?.userId && task.status === 'open' && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <Btn variant="secondary" size="sm" onClick={openEdit}>Edit task</Btn>
          <Btn variant="secondary" size="sm" loading={extending} onClick={extendTask}>Extend +7 days</Btn>
          <Btn variant="danger" size="sm" loading={cancelling} onClick={cancelTask}>Cancel task</Btn>
        </div>
      )}

      {escrow&&isCreator&&(
        <div style={{ marginBottom:20, padding:'14px 18px', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', ...(escrow.status==='funded'?{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)'}:escrow.status==='released'?{background:'rgba(126,34,206,0.1)',border:'1px solid rgba(126,34,206,0.3)'}:escrow.status==='disputed'?{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}:{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)'}) }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:'1.1rem' }}>{escrow.status==='funded'?'🔒':escrow.status==='released'?'✓':escrow.status==='disputed'?'⚠':'💳'}</span>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{escrow.status==='pending_payment'?'Escrow awaiting payment':escrow.status==='funded'?'Escrow funded — work in progress':escrow.status==='released'?'Payment released to earner':escrow.status==='disputed'?'Disputed — under admin review':'Escrow status'}</div>
              {escrow.status==='funded'&&<Mono size="0.65rem">{`R${task.budget} held securely`}</Mono>}
            </div>
          </div>
          {escrow.status==='pending_payment'&&<Btn variant="primary" size="sm" onClick={() => setFundModal(true)}>Fund Escrow — ${task.budget}</Btn>}
        </div>
      )}

      <div className="stack-mobile" style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <DCard hover={false}><Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:10 }}>Description</Mono><p style={{ color:'var(--text-secondary)', lineHeight:1.75 }}>{task.description}</p></DCard>
          <DCard hover={false}><Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:10 }}>Required Skills</Mono><div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{task.skill_tags.map(t => <Tag key={t}>{t}</Tag>)}</div></DCard>

          {isFcfs ? (
            <DCard hover={false}>
              <Mono size="0.68rem" color="var(--accent)" style={{ display:'block', marginBottom:10 }}>First come, first serve</Mono>
              {currentStatus==='open'
                ? <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{isOwner ? `Fixed price of R${task.budget}. The first earner to claim it is assigned automatically — no bids to review.` : `Fixed price of R${task.budget}. No bidding — claim it to start.`}</p>
                : <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.6 }}>This task was claimed{acceptedBid?'':''} at its fixed price of R{task.agreed_amount ?? task.budget}.</p>}
            </DCard>
          ) : (
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Bids ({bids.length})</Mono>
            {bids.length===0 ? <EmptyState icon="inbox" message="No bids yet" /> : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[...bids].sort((a,b)=>parseFloat(a.amount)-parseFloat(b.amount)).map(bid => (
                  <div key={bid.bid_id} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'14px 16px', border:`1px solid ${bid.status==='accepted'?'var(--accent)':'var(--border)'}`, opacity:bid.status==='rejected'?0.55:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <span onClick={() => openProfile(bid.bidder_id)} style={{ fontWeight:600, fontSize:'0.9rem', cursor:'pointer', textDecoration:'underline', textDecorationColor:'var(--border-strong)', textUnderlineOffset:3 }}>{bid.display_name}</span>
                        {bid.bidder_id===user.userId&&<span style={{ marginLeft:8, fontSize:'0.72rem', color:'var(--accent)', fontFamily:'var(--font-mono)' }}>(You)</span>}
                        <div style={{ marginTop:3 }}><Stars rating={bid.avg_rating} /></div>
                      </div>
                      <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'1.05rem', color:'var(--accent)' }}>R{bid.amount}</span>
                        <Badge variant={bid.status}>{bid.status}</Badge>
                      </div>
                    </div>
                    <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:isCreator&&bid.status==='pending'?12:0 }}>{bid.pitch}</p>
                    {isCreator&&(
                      <div style={{ display:'flex', gap:8 }}>
                        {bid.status==='pending'&&currentStatus==='open'&&<Btn variant="primary" size="sm" onClick={() => setAcceptModal(bid)}>Accept This Bid</Btn>}
                        <Btn variant="secondary" size="sm" onClick={() => openChat(bid.bidder_id, bid.display_name)}>💬 Message</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DCard>
          )}

          {/* C3: progress timeline once work is under way */}
          {currentStatus!=='open' && currentStatus!=='cancelled' && currentStatus!=='expired' && <StatusTimeline status={currentStatus} />}
          {/* C1/C2: price handshake — visible to the two parties while the task is active */}
          {(isOwner || task.assigned_to===user?.userId) && ['in_progress','submitted'].includes(currentStatus) && (
            <TaskAgreementPanel taskId={taskId} task={task}
              otherName={isOwner ? (acceptedBid?.display_name || 'the earner') : (task.creator_name || 'the creator')}
              onAgreed={amt => setTask(t => ({ ...t, agreed_amount: amt }))} />
          )}
          {/* ── Completion handshake ── */}
          {/* Earner submits finished work */}
          {task.assigned_to===user?.userId&&currentStatus==='in_progress'&&(
            <DCard hover={false} style={{ border:'1px solid var(--accent)', background:'var(--accent-glow)' }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Finished the work?</div>
              <p style={{ fontSize:'0.84rem', color:'var(--text-secondary)', marginBottom:14, lineHeight:1.5 }}>Submit it for the creator to review and confirm.</p>
              <Btn variant="success" fullWidth onClick={submitWork}>Submit work for review</Btn>
            </DCard>
          )}
          {/* Creator at in_progress can still complete directly */}
          {isOwner&&currentStatus==='in_progress'&&(
            <DCard hover={false} style={{ border:'1px solid var(--border-strong)' }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Work finished?</div>
              <p style={{ fontSize:'0.84rem', color:'var(--text-secondary)', marginBottom:14, lineHeight:1.5 }}>Waiting for {acceptedBid?.display_name || 'the earner'} to submit — or mark it complete yourself.</p>
              <Btn variant="success" fullWidth onClick={() => setReleaseModal(true)}>✓ Mark Task Complete</Btn>
            </DCard>
          )}
          {/* Creator reviews submitted work: confirm or send back */}
          {isOwner&&currentStatus==='submitted'&&(
            <DCard hover={false} style={{ border:'1px solid var(--accent)', background:'var(--accent-glow)' }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Work submitted for review</div>
              <p style={{ fontSize:'0.84rem', color:'var(--text-secondary)', marginBottom:14, lineHeight:1.5 }}>{acceptedBid?.display_name || 'The earner'} marked this done. Confirm completion, or send it back for changes.</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Btn variant="success" onClick={() => setReleaseModal(true)}>✓ Confirm completion</Btn>
                <Btn variant="secondary" onClick={requestChanges}>Request changes</Btn>
              </div>
            </DCard>
          )}
          {/* Earner waiting on the creator */}
          {task.assigned_to===user?.userId&&currentStatus==='submitted'&&(
            <DCard hover={false} style={{ border:'1px solid var(--border-strong)' }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Submitted — awaiting confirmation</div>
              <p style={{ fontSize:'0.84rem', color:'var(--text-secondary)', lineHeight:1.5 }}>The creator is reviewing your work. You'll be notified when they confirm.</p>
            </DCard>
          )}
          {/* After completion, either participant can leave one review */}
          {currentStatus==='completed'&&!reviewDone&&(isOwner||(alreadyBid&&myBid.status==='accepted'))&&(
            <DCard hover={false} style={{ border:'1px solid var(--accent)', background:'var(--accent-glow)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div><div style={{ fontWeight:600, marginBottom:4 }}>Task complete — leave a review</div><p style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>Help build trust on ReLivR.</p></div>
                <Btn onClick={() => setReviewModal(true)}>Leave Review</Btn>
              </div>
            </DCard>
          )}
          {currentStatus==='completed'&&reviewDone&&(
            <DCard hover={false} style={{ border:'1px solid var(--success)', textAlign:'center', padding:24 }}>
              <div style={{ fontSize:'1.8rem', marginBottom:6 }}>✓</div>
              <Mono color="var(--success)" size="0.8rem">Review submitted — thank you!</Mono>
            </DCard>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {isEarner&&isFcfs&&currentStatus==='open'&&(
            <DCard hover={false} style={{ border:'1px solid var(--text-primary)' }}>
              <Mono size="0.68rem" color="var(--accent)" style={{ display:'block', marginBottom:10 }}>First come, first serve</Mono>
              <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>R{task.budget}</div>
              <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:14, lineHeight:1.5 }}>Fixed price — no bidding. Claim it now and it's yours to start. First to claim wins.</p>
              <Btn fullWidth loading={claimLoading} onClick={submitClaim}>Claim this task</Btn>
            </DCard>
          )}
          {isEarner&&!isFcfs&&currentStatus==='open'&&!alreadyBid&&bidsClosed&&(
            <DCard hover={false} style={{ border:'1px solid var(--border)', textAlign:'center', padding:20 }}>
              <Mono color="var(--text-muted)" size="0.8rem">Bidding has closed for this task.</Mono>
            </DCard>
          )}
          {isEarner&&!isFcfs&&currentStatus==='open'&&!alreadyBid&&!bidsClosed&&(
            <DCard hover={false}>
              <Mono size="0.68rem" color="var(--accent)" style={{ display:'block', marginBottom:14 }}>Submit Your Bid</Mono>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <Input label={`Your Price (R) — Budget: R${task.budget}`} type="number" min="1" placeholder="e.g. 750" value={bidAmount} onChange={e => { setBidAmount(e.target.value); setBidErrors(v=>({...v,amount:null})) }} error={bidErrors.amount} />
                <Textarea label="Pitch (min 20 characters)" placeholder="Why are you the best fit?" value={bidPitch} onChange={e => { setBidPitch(e.target.value); setBidErrors(v=>({...v,pitch:null})) }} style={{ minHeight:120 }} error={bidErrors.pitch} />
                <Btn fullWidth loading={bidLoading} onClick={submitBid}>Submit Bid</Btn>
              </div>
            </DCard>
          )}
          {isEarner&&alreadyBid&&myBid.status==='pending'&&(
            <DCard hover={false} style={{ border:'1px solid var(--info)' }}>
              <Mono size="0.68rem" color="var(--info)" style={{ display:'block', marginBottom:10 }}>Your Bid</Mono>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.3rem', color:'var(--accent)', marginBottom:6 }}>R{myBid.amount}</div>
              <p style={{ fontSize:'0.83rem', color:'var(--text-secondary)', marginBottom:14, lineHeight:1.5 }}>{myBid.pitch}</p>
              <Btn variant="danger" size="sm" fullWidth onClick={() => { dispatch({type:'WITHDRAW_BID',bid_id:myBid.bid_id}); toast('Bid withdrawn','info') }}>Withdraw Bid</Btn>
            </DCard>
          )}
          {isEarner&&alreadyBid&&myBid.status==='accepted'&&(
            <DCard hover={false} style={{ border:'1px solid var(--success)', textAlign:'center', padding:24 }}>
              <div style={{ fontSize:'1.8rem', marginBottom:8 }}>🎉</div>
              <Mono color="var(--success)" size="0.8rem">Your bid was accepted!</Mono>
              <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginTop:6 }}>You can start work now. Message the poster to coordinate.</p>
            </DCard>
          )}
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Task Details</Mono>
            {[['Budget',`R${task.budget}`],['Deadline',new Date(task.deadline).toLocaleDateString()],...(task.expected_duration?[['Duration',task.expected_duration]]:[]),['Status',currentStatus?.replace('_',' ')],['Posted',new Date(task.created_at).toLocaleDateString()],...(isFcfs?[['Type','First come, first serve']]:[['Bids',`${bids.length} bid${bids.length!==1?'s':''}`],...(task.bids_close_at?[['Bids close',new Date(task.bids_close_at).toLocaleDateString()]]:[])]),['Task ID',`#${task.task_id}`]].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <Mono>{k}</Mono><span style={{ fontSize:'0.85rem', color:'var(--text-primary)', fontWeight:500 }}>{v}</span>
              </div>
            ))}
          </DCard>
          {(() => {
            // Determine who the "other party" is for this task
            let chatUserId = null, chatName = null
            if (isOwner && acceptedBid) { chatUserId = acceptedBid.bidder_id; chatName = acceptedBid.display_name }
            else if (!isOwner)          { chatUserId = task.creator_id; chatName = task.creator_name || 'Task creator' }
            if (!chatUserId) return null
            return <Btn variant="secondary" fullWidth onClick={() => openChat(chatUserId, chatName)}>💬 Message {chatName?.split(' ')[0] || 'them'}</Btn>
          })()}
        </div>
      </div>

      <ConfirmModal open={!!acceptModal} onClose={() => setAcceptModal(null)} onConfirm={confirmAccept} loading={acceptLoading} title="Accept This Bid" confirmLabel="Accept & Move to Escrow" confirmVariant="primary" message={acceptModal?`Accept ${acceptModal.display_name}'s bid of R${acceptModal.amount}? All other bids will be rejected.`:''} />
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit task" maxWidth={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Input label="Title" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title:e.target.value }))} />
          <div>
            <label>Description</label>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description:e.target.value }))} style={{ minHeight:120 }} />
          </div>
          <Input label="Budget (R)" type="number" value={editForm.budget} onChange={e => setEditForm(f => ({ ...f, budget:e.target.value }))} />
          <Input label="Deadline" type="date" min={new Date().toISOString().slice(0,10)} value={editForm.deadline} onChange={e => setEditForm(f => ({ ...f, deadline:e.target.value }))} />
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Btn>
            <Btn variant="primary" loading={editSaving} onClick={saveEdit}>Save changes</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={fundModal} onClose={() => setFundModal(false)} title="Fund Escrow" maxWidth={440}>
        <p style={{ color:'var(--text-secondary)', lineHeight:1.65, marginBottom:16 }}>Fund escrow for <strong style={{ color:'var(--text-primary)' }}>{task.title}</strong>.</p>
        <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'14px 16px', marginBottom:20 }}>
          {[['Task Budget',`R${task.budget}`],['Platform Fee (10%)',`R${(parseFloat(task.budget)*0.1).toFixed(2)}`],['Total',`R${(parseFloat(task.budget)*1.1).toFixed(2)}`]].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
              <Mono>{k}</Mono><span style={{ fontFamily:'var(--font-mono)', color:k==='Total'?'var(--accent)':'var(--text-primary)', fontWeight:k==='Total'?600:400 }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:20, lineHeight:1.5 }}>In demo mode no actual charge occurs. In production this is processed securely via Paystack.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={() => setFundModal(false)} disabled={fundLoading}>Cancel</Btn>
          <Btn variant="primary" onClick={confirmFund} loading={fundLoading}>Confirm & Fund Escrow</Btn>
        </div>
      </Modal>
      <ConfirmModal open={releaseModal} onClose={() => setReleaseModal(false)} onConfirm={confirmComplete} loading={releaseLoading} title="Mark Task Complete" confirmLabel="Yes, mark complete" confirmVariant="success" message={`Confirm that this task has been completed${acceptedBid?` by ${acceptedBid.display_name}`:''}? You'll both be able to leave a review afterwards.`} />
      <Modal open={disputeModal} onClose={() => setDisputeModal(false)} title="Raise a Dispute" maxWidth={500}>
        <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem', marginBottom:16, lineHeight:1.6 }}>Raising a dispute freezes the escrow and notifies our admin team. Be specific about what was agreed vs what was delivered.</p>
        <Textarea label="Reason for dispute (min 20 characters)" value={disputeText} onChange={e => setDisputeText(e.target.value)} placeholder="Describe the issue clearly…" style={{ minHeight:140 }} />
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <Btn variant="ghost" onClick={() => setDisputeModal(false)} disabled={disputeLoading}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmDispute} loading={disputeLoading}>Submit Dispute</Btn>
        </div>
      </Modal>
      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Leave a Review" maxWidth={440}>
        <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem', marginBottom:20, lineHeight:1.6 }}>Rate your experience with {acceptedBid?.display_name||'the earner'}.</p>
        <div style={{ marginBottom:20 }}>
          <Mono style={{ display:'block', marginBottom:10 }}>Rating</Mono>
          <Stars rating={reviewRating} interactive onRate={setReviewRating} />
          {reviewRating>0&&<Mono color="var(--accent)" size="0.7rem" style={{ marginTop:6, display:'block' }}>{['','Poor','Fair','Good','Very Good','Excellent'][reviewRating]}</Mono>}
        </div>
        <Textarea label="Comment (optional)" value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share details of your experience…" style={{ minHeight:90 }} />
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <Btn variant="ghost" onClick={() => setReviewModal(false)} disabled={reviewLoading}>Skip</Btn>
          <Btn variant="primary" onClick={submitReview} loading={reviewLoading} disabled={!reviewRating}>Submit Review</Btn>
        </div>
      </Modal>
    </div>
  )
}

const TASK_DURATIONS = ['Under 1 hour', '1–3 hours', 'Half day', 'Full day', 'Multi-day']

function TaskNew({ setPage, setSelectedTask }) {
  const { dispatch } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [step, setStep] = useState(0)
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDead] = useState('')
  const [duration, setDuration]   = useState('')
  const [bidsClose, setBidsClose] = useState('')
  // 'bid' = earners bid, you pick a winner. 'fcfs' = fixed price, first to claim wins.
  const [assignmentMode, setAssignmentMode] = useState('bid')
  const [tags, setTags]     = useState('')
  const [zone, setZone]     = useState('') // A5: lets Browse Tasks sort this by proximity
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [createdId, setCreatedId] = useState(null)
  const [wasDraft, setWasDraft] = useState(false)     // success screen wording
  const [draftId, setDraftId] = useState(null)        // editing an existing draft
  const zones = useLocations()
  const STEPS = ['Details','Budget & Date','Skills','Review']

  // Draft-edit handoff: MyTasks puts the draft id in sessionStorage before
  // navigating here; we load it once, prefill the form, and clear the key.
  useEffect(() => {
    let id = null
    try { id = sessionStorage.getItem('rl_edit_draft'); sessionStorage.removeItem('rl_edit_draft') } catch { /* ignore */ }
    if (!id) return
    fetch(`${API_BASE}/tasks/${id}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const t = d?.task
        if (!t || t.status !== 'draft') return
        setDraftId(t.task_id)
        setTitle(t.title || '')
        setDesc(t.description || '')
        setBudget(t.budget != null ? String(t.budget) : '')
        setDead(t.deadline ? new Date(t.deadline).toISOString().slice(0, 10) : '')
        setDuration(t.expected_duration || '')
        setBidsClose(t.bids_close_at ? new Date(t.bids_close_at).toISOString().slice(0, 10) : '')
        setAssignmentMode(t.assignment_mode === 'fcfs' ? 'fcfs' : 'bid')
        setTags((t.skill_tags || []).join(', '))
        setZone(t.campus_zone || '')
      })
      .catch(() => { /* draft unavailable — start fresh */ })
  }, []) // eslint-disable-line

  // Save whatever is filled in as a private draft — only the title is required.
  async function saveDraft() {
    if (!title.trim() || title.trim().length < 5) {
      setErrors({ title: 'Give your draft a title (5+ characters) so you can find it later' })
      setStep(0)
      return
    }
    setSavingDraft(true)
    const skillTags = tags.split(',').map(s=>s.trim()).filter(Boolean)
    const bodyPayload = {
      title: title.trim(),
      description: desc.trim() || null,
      budget: budget && !isNaN(budget) && parseFloat(budget) > 0 ? parseFloat(budget) : null,
      deadline: deadline && new Date(deadline) > new Date() ? new Date(deadline).toISOString() : null,
      skill_tags: skillTags,
      expected_duration: duration || null,
      bids_close_at: bidsClose ? new Date(bidsClose).toISOString() : null,
      assignment_mode: assignmentMode,
      campus_zone: zone || null,
    }
    try {
      const res = draftId
        ? await fetch(`${API_BASE}/tasks/${draftId}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify(bodyPayload) })
        : await fetch(API_BASE + '/tasks', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify({ ...bodyPayload, status: 'draft' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not save draft')
      toast('Draft saved — finish it any time from My Tasks → Drafts', 'success')
      setSelectedTask(null)
      setPage('tasks-mine')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingDraft(false)
    }
  }

  function validateStep() {
    const e = {}
    if (step===0) { if (!title.trim()||title.trim().length<5) e.title='Title must be at least 5 characters'; if (!desc.trim()||desc.trim().length<20) e.desc='Description must be at least 20 characters' }
    if (step===1) { if (!budget||isNaN(budget)||parseFloat(budget)<=0) e.budget='Enter a valid budget'; if (!deadline) e.deadline='Deadline is required'; else if (new Date(deadline)<=new Date()) e.deadline='Deadline must be in the future' }
    if (step===2) { if (!tags.trim()) e.tags='Add at least one skill tag' }
    return e
  }

  function next() { const e=validateStep(); if (Object.keys(e).length){setErrors(e);return}; setErrors({}); setStep(s=>s+1) }
  function back() { setErrors({}); setStep(s=>s-1) }

  async function submit() {
    setLoading(true)
    const skillTags = tags.split(',').map(s=>s.trim()).filter(Boolean)
    const livePayload = {
      title: title.trim(),
      description: desc.trim(),
      budget: parseFloat(budget),
      deadline: new Date(deadline).toISOString(),
      skill_tags: skillTags,
      expected_duration: duration || null,
      bids_close_at: bidsClose ? new Date(bidsClose).toISOString() : null,
      assignment_mode: assignmentMode,
      campus_zone: zone || null,
    }
    try {
      let res, data
      if (draftId) {
        // Editing an existing draft: save the final fields, then publish it —
        // never POST a duplicate.
        res = await fetch(`${API_BASE}/tasks/${draftId}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify(livePayload) })
        if (!res.ok) { data = await res.json().catch(() => ({})); throw new Error(data.message || 'Could not save draft') }
        res = await fetch(`${API_BASE}/tasks/${draftId}/publish`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
        if (!res.ok) { data = await res.json().catch(() => ({})); throw new Error(data.message || 'Could not publish draft') }
        data = await res.json()
        setWasDraft(true)
      } else {
        res = await fetch(API_BASE + '/tasks', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
          body: JSON.stringify(livePayload),
        })
        if (!res.ok) {
          data = await res.json().catch(() => ({}))
          throw new Error(data.message || 'Could not post task')
        }
        data = await res.json()
      }
      const id = data.task.task_id
      toast(`Task "${title}" ${draftId ? 'published' : 'posted successfully'}!`, 'success')
      setCreatedId(id)
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        // Genuinely offline (no server) — keep working locally so dev isn't blocked
        const id = `task_${Date.now()}`
        dispatch({ type:'ADD_TASK', task:{ task_id:id, creator_id:user.userId, assigned_to:null, status:'open', title:title.trim(), description:desc.trim(), budget, deadline:new Date(deadline).toISOString(), skill_tags:skillTags, created_at:new Date().toISOString() } })
        toast('Backend offline — task saved locally only', 'warning')
        setCreatedId(id)
      } else {
        // Server rejected it (validation / DB error) — show the real reason, do NOT fake success
        toast(err.message, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  if (createdId) return (
    <div className="page-enter" style={{ maxWidth:580 }}>
      <DCard hover={false} style={{ textAlign:'center', padding:'48px 32px', border:'1px solid var(--success)' }}>
        <div style={{ fontSize:'3rem', marginBottom:12 }}>✓</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', fontWeight:700, marginBottom:8 }}>{wasDraft ? 'Draft Published!' : 'Task Posted!'}</h2>
        <p style={{ color:'var(--text-muted)', marginBottom:24, lineHeight:1.6 }}>Your task is live. Earners with matching skills have been notified.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Btn onClick={() => { setSelectedTask(createdId); setPage('task-detail') }}>View Task</Btn>
          <Btn variant="secondary" onClick={() => { setSelectedTask(null); setPage('tasks-mine') }}>All My Tasks</Btn>
          <Btn variant="ghost" onClick={() => { setTitle(''); setDesc(''); setBudget(''); setDead(''); setDuration(''); setBidsClose(''); setAssignmentMode('bid'); setTags(''); setCreatedId(null); setStep(0) }}>Post Another</Btn>
        </div>
      </DCard>
    </div>
  )

  return (
    <div className="page-enter" style={{ maxWidth:640 }}>
      <PageTitle sub="Earners are matched and notified by skill tags automatically">Post a New Task</PageTitle>
      <StepBar steps={STEPS} current={step} />
      <DCard hover={false}>
        {step===0&&<div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <Input label="Task Title" placeholder="e.g. Build a REST API for my startup" value={title} onChange={e=>{setTitle(e.target.value);setErrors(v=>({...v,title:null}))}} error={errors.title} />
          <Textarea label="Description" placeholder="Describe what you need done in detail." value={desc} onChange={e=>{setDesc(e.target.value);setErrors(v=>({...v,desc:null}))}} style={{ minHeight:160 }} error={errors.desc} />
          <SelectField label="Location (optional — lets earners sort by distance)" value={zone} onChange={e=>setZone(e.target.value)}>
            <option value="">Not specified</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </SelectField>
        </div>}
        {step===1&&<div style={{ display:'grid', gap:18 }}>
          {/* How the task gets assigned — bidding vs first-come-first-serve. */}
          <div>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>How do you want to assign it?</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { v:'bid',  t:'Take bids',        d:'Earners bid, you pick who and at what price.' },
                { v:'fcfs', t:'First come, first serve', d:'Fixed price — the first earner to claim gets it, instantly.' },
              ].map(o => {
                const on = assignmentMode === o.v
                return (
                  <button key={o.v} type="button" onClick={()=>setAssignmentMode(o.v)}
                    style={{ textAlign:'left', padding:'12px 14px', borderRadius:'var(--radius-md)', cursor:'pointer',
                      border:`1.5px solid ${on?'var(--text-primary)':'var(--border)'}`,
                      background:on?'var(--bg-elevated)':'var(--bg-surface)', color:'var(--text-primary)',
                      transition:'border-color 150ms ease' }}>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>{o.t}</div>
                    <div style={{ fontSize:'.76rem', color:'var(--text-muted)', marginTop:3, lineHeight:1.35 }}>{o.d}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
            <Input label={assignmentMode==='fcfs'?'Fixed price (R)':'Budget (R)'} type="number" min="1" placeholder="e.g. 500" value={budget} onChange={e=>{setBudget(e.target.value);setErrors(v=>({...v,budget:null}))}} error={errors.budget} hint={assignmentMode==='fcfs'?'The earner is paid exactly this — no negotiation':undefined} />
            <Input label="Deadline" type="date" min={new Date().toISOString().slice(0,10)} value={deadline} onChange={e=>{setDead(e.target.value);setErrors(v=>({...v,deadline:null}))}} error={errors.deadline} />
            <SelectField label="Expected duration" value={duration} onChange={e=>setDuration(e.target.value)}>
              <option value="">Not sure</option>
              {TASK_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </SelectField>
            {assignmentMode==='bid' && <Input label="Bidding closes" type="date" min={new Date().toISOString().slice(0,10)} value={bidsClose} onChange={e=>setBidsClose(e.target.value)} hint="Optional — no new bids after this date" />}
          </div>
        </div>}
        {step===2&&(() => {
          const current = tags.split(',').map(s=>s.trim()).filter(Boolean)
          const suggestions = suggestTags(title + ' ' + desc, current)
          const addTag = (t) => { setTags(prev => { const arr = prev.split(',').map(s=>s.trim()).filter(Boolean); if (!arr.some(x=>x.toLowerCase()===t.toLowerCase())) arr.push(t); return arr.join(', ') }); setErrors(v=>({...v,tags:null})) }
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <Input label="Skill Tags (comma separated)" placeholder="e.g. react, node.js, postgres" value={tags} onChange={e=>{setTags(e.target.value);setErrors(v=>({...v,tags:null}))}} hint="Used to automatically match and notify earners" error={errors.tags} />
              {suggestions.length>0 && (
                <div>
                  <Mono size="0.62rem" style={{ display:'flex', alignItems:'center', gap:6, marginBottom:9, color:'var(--text-muted)' }}>
                    <Icon name="sparkles" size={12} color="var(--accent)" />Suggested from your description
                  </Mono>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {suggestions.map(t => (
                      <button key={t} type="button" onClick={() => addTag(t)} title={`Add “${t}” tag`}
                        style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 13px', borderRadius:100, cursor:'pointer', border:'1px dashed var(--border-strong)', background:'var(--accent-glow)', color:'var(--accent)', fontFamily:'var(--font-body)', fontWeight:600, fontSize:'.8rem', transition:'all 150ms ease' }}>
                        <span style={{ fontSize:'.95rem', lineHeight:1, marginTop:-1 }}>+</span>{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
        {step===3&&<div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Mono style={{ display:'block', marginBottom:4 }}>Review your task</Mono>
          {[['Title',title],['Budget',`R${budget}`],['Deadline',deadline?new Date(deadline).toLocaleDateString():'—'],['Location',zone||'Not specified'],['Skills',tags||'—']].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <Mono>{k}</Mono><span style={{ fontSize:'0.875rem', color:'var(--text-primary)', maxWidth:320, textAlign:'right' }}>{v}</span>
            </div>
          ))}
          <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', padding:'12px 14px', marginTop:4 }}>
            <Mono size="0.65rem" style={{ display:'block', marginBottom:6 }}>Description preview</Mono>
            <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{desc}</p>
          </div>
        </div>}
      </DCard>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:16, gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:10 }}>
          {step>0&&<Btn variant="secondary" onClick={back}>← Back</Btn>}
          <Btn variant="ghost" onClick={() => setPage('dashboard')}>Cancel</Btn>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="secondary" loading={savingDraft} onClick={saveDraft} title="Save what you have and finish later">
            {draftId ? 'Save Draft' : 'Save as Draft'}
          </Btn>
          {step<STEPS.length-1?<Btn onClick={next}>Next →</Btn>:<Btn loading={loading} onClick={submit}>{draftId ? 'Publish Draft' : 'Post Task'}</Btn>}
        </div>
      </div>
    </div>
  )
}

// Reusable + recurring task templates manager (shown on My Tasks).
function TemplatesPanel({ setPage, setSelectedTask }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [templates, setTemplates] = useState([])
  const [show, setShow]   = useState(false)
  const [open, setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { title:'', description:'', budget:'', deadlineDays:'7', recurrence:'none' }
  const [form, setForm]   = useState(blank)

  async function load() {
    try {
      const res = await fetch(API_BASE + '/templates', { headers:{ Authorization:`Bearer ${token()}` } })
      if (res.ok) { const d = await res.json(); setTemplates(d.templates || []) }
    } catch { /* offline */ }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function create() {
    setSaving(true)
    try {
      const res = await fetch(API_BASE + '/templates', {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ title:form.title.trim(), description:form.description.trim(), budget:parseFloat(form.budget), deadlineDays:parseInt(form.deadlineDays,10)||7, recurrence:form.recurrence }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not save template')
      setOpen(false); setForm(blank); setShow(true); toast('Template saved', 'success'); load()
    } catch (err) { toast(err.message, 'error') } finally { setSaving(false) }
  }
  async function use(id) {
    try {
      const res = await fetch(`${API_BASE}/templates/${id}/use`, { method:'POST', headers:{ Authorization:`Bearer ${token()}` } })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not create task')
      toast('Task created from template', 'success'); setSelectedTask(d.task.task_id); setPage('task-detail')
    } catch (err) { toast(err.message, 'error') }
  }
  async function remove(id) {
    if (!window.confirm('Delete this template?')) return
    try { const res = await fetch(`${API_BASE}/templates/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token()}` } }); if (res.ok) { toast('Template deleted', 'success'); load() } } catch { /* ignore */ }
  }

  return (
    <DCard hover={false} style={{ marginBottom:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <Mono>Templates{templates.length > 0 ? ` · ${templates.length}` : ''}</Mono>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="secondary" size="sm" onClick={() => setOpen(true)}>+ New template</Btn>
          {templates.length > 0 && <Btn variant="ghost" size="sm" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</Btn>}
        </div>
      </div>
      {show && templates.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
          {templates.map(t => (
            <div key={t.template_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:'0.9rem', display:'flex', gap:8, alignItems:'center' }}>{t.title}{t.recurrence !== 'none' && <Tag>{t.recurrence}</Tag>}</div>
                <Mono>R{t.budget} · due in {t.deadline_days}d</Mono>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <Btn size="sm" onClick={() => use(t.template_id)}>Use</Btn>
                <Btn variant="ghost" size="sm" onClick={() => remove(t.template_id)}>✕</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New task template" maxWidth={480}>
        <form autoComplete="off" onSubmit={e => { e.preventDefault(); create() }} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Anti-autofill honeypot: Chrome pins its saved phone/name onto the first
              text field regardless of a single field's autoComplete. An off-screen
              decoy input absorbs it so the real Title stays clean. */}
          <input type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" style={{ position:'absolute', opacity:0, height:0, width:0, pointerEvents:'none' }} />
          <Input label="Title" name="template-title" autoComplete="off" value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} />
          <div><label>Description</label><textarea autoComplete="off" value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} style={{ minHeight:100 }} /></div>
          <Input label="Budget (R)" type="number" name="template-budget" autoComplete="off" value={form.budget} onChange={e => setForm(f => ({ ...f, budget:e.target.value }))} />
          <Input label="Deadline (days from posting)" type="number" name="template-deadline" autoComplete="off" value={form.deadlineDays} onChange={e => setForm(f => ({ ...f, deadlineDays:e.target.value }))} />
          <div>
            <label>Recurrence</label>
            <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence:e.target.value }))}>
              <option value="none">One-off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn variant="ghost" type="button" onClick={() => setOpen(false)} disabled={saving}>Cancel</Btn>
            <Btn variant="primary" type="button" loading={saving} onClick={create}>Save template</Btn>
          </div>
        </form>
      </Modal>
    </DCard>
  )
}

function MyTasks({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [myTasks, setMyTasks] = useState([])
  const [busyId, setBusyId] = useState(null)
  const token = () => localStorage.getItem('rl_token')

  // Drafts: publish (validated server-side), edit (hand the id to the post form
  // via sessionStorage — TaskNew picks it up on mount), or discard.
  function editDraft(task) {
    try { sessionStorage.setItem('rl_edit_draft', task.task_id) } catch { /* ignore */ }
    setPage('tasks-new')
  }
  async function publishDraft(task) {
    setBusyId(task.task_id)
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.task_id}/publish`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(d.message || 'Could not publish draft', 'error')
        if (res.status === 422) editDraft(task) // take them straight to finishing it
        return
      }
      toast('Draft published — your task is live!', 'success')
      load()
    } catch { toast('Could not reach the server', 'error') } finally { setBusyId(null) }
  }
  async function discardDraft(task) {
    if (!window.confirm(`Discard the draft "${task.title}"? This can't be undone.`)) return
    setBusyId(task.task_id)
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.task_id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token()}` } })
      if (!res.ok) throw new Error()
      toast('Draft discarded', 'success')
      load()
    } catch { toast('Could not discard draft', 'error') } finally { setBusyId(null) }
  }

  async function load() {
    try {
      const res = await fetch(API_BASE + '/tasks/mine', { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      // Only tasks I created (mine returns created + assigned)
      setMyTasks((data.tasks || []).filter(t => t.creator_id === user.userId).map(t => ({ ...t, skill_tags: t.skill_tags || [] })))
    } catch {
      setMyTasks(state.tasks.filter(t => t.creator_id===user.userId))
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line
  useEffect(() => { const id = setInterval(load, 15000); return () => clearInterval(id) }, []) // eslint-disable-line

  const filtered = myTasks.filter(t => filter==='all'||t.status===filter)
  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <PageTitle sub={`${myTasks.length} tasks posted`}>My Tasks</PageTitle>
        <Btn onClick={() => setPage('tasks-new')}>+ New Task</Btn>
      </div>
      <TemplatesPanel setPage={setPage} setSelectedTask={setSelectedTask} />
      <div className="feed-scroll" style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-elevated)', borderRadius:12, padding:3, overflowX:'auto', maxWidth:'fit-content' }}>
        {['all','draft','open','in_progress','completed','disputed','expired'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', textTransform:'capitalize', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(19,17,24,.14)':'none' }}>
            {s==='draft' ? 'Drafts' : s.replace('_',' ')} ({s==='all'?myTasks.length:myTasks.filter(t=>t.status===s).length})
          </button>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filtered.map(task => {
          const isDraft = task.status === 'draft'
          const pendingBids = typeof task.bid_count === 'number'
            ? task.bid_count
            : state.bids.filter(b=>b.task_id===task.task_id&&b.status==='pending').length
          return (
            <DCard key={task.task_id} onClick={() => { if (isDraft) { editDraft(task) } else { setSelectedTask(task.task_id); setPage('task-detail') } }} style={{ display:'flex', alignItems:'center', gap:20, padding:'16px 20px', flexWrap:'wrap', ...(isDraft?{ borderStyle:'dashed' }:{}) }}>
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:6 }}>
                  <Badge variant={taskState(task).variant}>{taskState(task).label}</Badge>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:600 }}>{task.title}</span>
                </div>
                <div style={{ display:'flex', gap:6 }}>{task.skill_tags.slice(0,3).map(t=><Tag key={t}>{t}</Tag>)}</div>
              </div>
              {isDraft ? (
                // Drafts: no bids/dates to show (fields may be empty) — actions instead.
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  <Mono style={{ marginRight:6 }}>{task.budget != null ? `R${task.budget}` : 'No budget yet'}</Mono>
                  <Btn variant="secondary" size="sm" onClick={() => editDraft(task)}>Edit</Btn>
                  <Btn size="sm" loading={busyId===task.task_id} onClick={() => publishDraft(task)}>Publish</Btn>
                  <Btn variant="ghost" size="sm" disabled={busyId===task.task_id} onClick={() => discardDraft(task)}>✕</Btn>
                </div>
              ) : (
                <div style={{ display:'flex', gap:24, alignItems:'center', flexShrink:0 }}>
                  {pendingBids>0&&<div style={{ textAlign:'center' }}><div style={{ fontFamily:'var(--font-mono)', fontSize:'1.2rem', fontWeight:500, color:'var(--accent)' }}>{pendingBids}</div><Mono>new bids</Mono></div>}
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:500 }}>R{task.budget}</div>
                    <Mono>Due {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}</Mono>
                  </div>
                </div>
              )}
            </DCard>
          )
        })}
        {filtered.length===0&&<EmptyState icon="inbox" message={filter==='draft' ? 'No drafts — use "Save as Draft" while posting' : `No ${filter==='all'?'':filter.replace('_',' ')} tasks`} action={<Btn size="sm" onClick={() => setPage('tasks-new')}>Post a Task</Btn>} />}
      </div>
    </div>
  )
}

function MyBids({ setPage, setSelectedTask }) {
  const { state, dispatch } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [myBids, setMyBids] = useState([])
  const [filter, setFilter] = useState('all')
  const token = () => localStorage.getItem('rl_token')

  async function load() {
    try {
      const res = await fetch(API_BASE + '/tasks/bids/mine', { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      // Map backend shape → what the card expects (task info is flattened on each bid)
      setMyBids((data.bids || []).map(b => ({
        ...b,
        _task: { task_id: b.task_id, title: b.task_title, budget: b.task_budget, status: b.task_status, deadline: b.task_deadline },
      })))
    } catch {
      setMyBids(state.bids.filter(b => b.bidder_id===user.userId).map(b => ({ ...b, _task: state.tasks.find(t=>t.task_id===b.task_id) })))
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line
  useEffect(() => { const id = setInterval(load, 15000); return () => clearInterval(id) }, []) // eslint-disable-line

  async function withdraw(bidId) {
    try {
      const res = await fetch(`${API_BASE}/tasks/bids/${bidId}/withdraw`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
      if (!res.ok) throw new Error('failed')
      toast('Bid withdrawn','info')
      load()
    } catch {
      dispatch({type:'WITHDRAW_BID',bid_id:bidId}); toast('Bid withdrawn','info')
    }
  }

  const filtered = myBids.filter(b => filter==='all'||b.status===filter)
  return (
    <div className="page-enter">
      <PageTitle sub={`${myBids.length} bids placed`}>My Bids</PageTitle>
      <div className="feed-scroll" style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-elevated)', borderRadius:12, padding:3, overflowX:'auto', maxWidth:'fit-content' }}>
        {['all','pending','accepted','rejected','withdrawn'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(19,17,24,.14)':'none' }}>
            {s} ({s==='all'?myBids.length:myBids.filter(b=>b.status===s).length})
          </button>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filtered.map(bid => {
          const task = bid._task
          return (
            <DCard key={bid.bid_id} hover={bid.status!=='withdrawn'} style={{ opacity:bid.status==='withdrawn'?0.55:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:6 }}>
                    <Badge variant={bid.status}>{bid.status}</Badge>
                    <span style={{ fontFamily:'var(--font-display)', fontWeight:600, cursor:'pointer' }} onClick={() => { if(task){setSelectedTask(task.task_id);setPage('task-detail')} }}>{task?.title||'Task removed'}</span>
                  </div>
                  <p style={{ fontSize:'0.84rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:8 }}>{bid.pitch.slice(0,120)}…</p>
                  <Mono>{new Date(bid.created_at).toLocaleDateString()}</Mono>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:16 }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', color:'var(--accent)', fontWeight:500 }}>R{bid.amount}</div>
                  {task&&<Mono>Budget: ${task.budget}</Mono>}
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {task&&<Btn variant="secondary" size="sm" onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }}>View Task</Btn>}
                {bid.status==='pending'&&<Btn variant="danger" size="sm" onClick={() => withdraw(bid.bid_id)}>Withdraw</Btn>}
              </div>
            </DCard>
          )
        })}
        {filtered.length===0&&<EmptyState icon="inbox" message="No bids in this category" action={<Btn size="sm" onClick={() => setPage('tasks-browse')}>Browse Tasks</Btn>} />}
      </div>
    </div>
  )
}

// Buyer's catalogue-order history (pay-on-collection). Read-only, except a buyer
// may cancel an order that's still pending.
const MYORDER_BADGE = { pending:'pending', accepted:'accepted', ready:'in_progress', completed:'completed', cancelled:'rejected' }
function MyOrders({ openBusiness }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [orders, setOrders] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = () => fetch(`${API_BASE}/orders/mine`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
    .then(d => setOrders(d.orders || []))
    .catch(() => setOrders([]))
  useEffect(() => { load() }, []) // eslint-disable-line

  async function cancel(order) {
    setBusy(order.order_id)
    try {
      const res = await fetch(`${API_BASE}/orders/${order.order_id}/cancel`, { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not cancel order')
      toast('Order cancelled', 'info')
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const statusLine = {
    pending:  'Waiting for the business to confirm',
    accepted: 'Confirmed — being prepared',
    ready:    'Ready for collection — pay on collection',
    completed:'Collected',
    cancelled:'Cancelled',
  }

  return (
    <div style={{ maxWidth:760, margin:'0 auto', padding:'8px 0 40px' }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.5rem', marginBottom:4 }}>My Orders</h1>
      <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:20 }}>Catalogue items you've ordered. Payment is settled with the business on collection.</p>
      {orders === null ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>
        : orders.length === 0 ? <EmptyState icon="inbox" message="You haven't ordered anything yet" />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {orders.map(o => (
              <DCard key={o.order_id} hover={false} style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'.95rem' }}>{o.quantity}× {o.product_name}</div>
                    <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:2 }}>
                      {o.business_name
                        ? <span onClick={() => openBusiness?.(o.business_id)} style={{ cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>{o.business_name}</span>
                        : 'Business'} · {new Date(o.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize:'.8rem', color:'var(--text-secondary)', marginTop:5 }}>{statusLine[o.status]}</div>
                    {o.note && <div style={{ fontSize:'.82rem', color:'var(--text-secondary)', marginTop:6, lineHeight:1.5 }}>“{o.note}”</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.05rem' }}>{o.total_cents != null ? zar(o.total_cents) : 'On collection'}</div>
                    <div style={{ marginTop:4 }}><Badge variant={MYORDER_BADGE[o.status] || 'default'}>{o.status}</Badge></div>
                  </div>
                </div>
                {o.status === 'pending' && (
                  <div style={{ marginTop:12 }}>
                    <Btn size="sm" variant="danger" loading={busy===o.order_id} onClick={() => cancel(o)}>Cancel order</Btn>
                  </div>
                )}
              </DCard>
            ))}
          </div>
        )}
    </div>
  )
}

function Suggestions({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const toast = useToast()
  const [dismissed, setDismissed] = useState(new Set())
  // Data isolation: suggestions were fictional mock tasks shown to real users.
  // Until a real matching endpoint exists this page honestly shows its empty state.
  const suggestions = []
  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <PageTitle sub="Ranked by Jaccard similarity score against your skill profile">For You</PageTitle>
        <Mono size="0.72rem" color="var(--text-secondary)">{suggestions.length} matches</Mono>
      </div>
      {suggestions.length===0&&<EmptyState icon="target" message="No more suggestions — check back soon" action={<Btn onClick={() => setDismissed(new Set())}>Reset</Btn>} />}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {suggestions.map(s => (
          <DCard key={s.task_id}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                  <Badge variant={s.status}>{s.status.replace('_',' ')}</Badge>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1.05rem' }}>{s.title}</span>
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>{s.skill_tags.map(t=><Tag key={t}>{t}</Tag>)}</div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:14 }}>
                  <Mono>Budget: <span style={{ color:'var(--accent)' }}>R{s.budget}</span></Mono>
                  <Mono>Due: {new Date(s.deadline).toLocaleDateString()}</Mono>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <Btn size="sm" onClick={() => { setSelectedTask(s.task_id); setPage('task-detail') }}>View Task</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => { setDismissed(d=>new Set([...d,s.task_id])); toast('Suggestion dismissed','info') }}>Dismiss</Btn>
                </div>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:`conic-gradient(var(--accent) ${s.match_score*360}deg, var(--bg-elevated) 0deg)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--bg-surface)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.82rem', fontWeight:500, color:'var(--accent)' }}>{Math.round(s.match_score*100)}%</span>
                  </div>
                </div>
                <Mono style={{ display:'block', marginTop:5 }}>match</Mono>
              </div>
            </div>
          </DCard>
        ))}
      </div>
    </div>
  )
}

const CONTACTS = [
  { id:'u3', name:'Alex Chen',    avatar:'AC', role:'Earner',  task:'REST API Task #1' },
  { id:'u5', name:'Maria Santos', avatar:'MS', role:'Earner',  task:'REST API Task #1' },
  { id:'u2', name:'James Lee',    avatar:'JL', role:'Creator', task:'Mobile App Task #2' },
]

function Messages({ target, clearTarget }) {
  const { user } = useAuth()
  const { state } = useStore()
  const toast = useToast()
  const myId = user.userId

  const [threads, setThreads]   = useState([])      // conversation list from backend
  const [activeId, setActiveId] = useState(target?.userId || null)    // user_id of the open conversation
  const [pendingName, setPendingName] = useState(target?.name || null) // name for a not-yet-started chat
  const [messages, setMessages] = useState([])      // messages in the open thread
  const [msg, setMsg]           = useState('')
  const [sending, setSending]   = useState(false)
  const [offline, setOffline]   = useState(false)   // backend unreachable → mock mode
  const [loading, setLoading]   = useState(true)
  const bottomRef = useRef(null)
  const token = () => localStorage.getItem('rl_token')

  // ── Load conversation list ──────────────────────────────────────────────────
  async function loadThreads() {
    try {
      const res = await fetch(API_BASE + '/messages/threads', { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('threads failed')
      const data = await res.json()
      let list = data.threads || []
      // If we arrived with a target (e.g. from a task) not yet in the list, add it
      if (target?.userId && !list.some(t => t.other_id === target.userId)) {
        list = [{ other_id: target.userId, display_name: target.name || 'New conversation', last_message: null, avatar_url: null, _pending: true }, ...list]
      }
      setThreads(list)
      setOffline(false)
      // Open the target if given, else the first conversation
      if (target?.userId) setActiveId(target.userId)
      else if (!activeId && list.length) setActiveId(list[0].other_id)
      return list
    } catch {
      // Backend offline → fall back to mock contacts so the screen still works
      setOffline(true)
      let list = CONTACTS.map(c => ({ other_id:c.id, display_name:c.name, last_message:c.task, avatar_url:null }))
      if (target?.userId && !list.some(t => t.other_id === target.userId)) {
        list = [{ other_id: target.userId, display_name: target.name || 'New conversation', last_message:null, avatar_url:null, _pending:true }, ...list]
      }
      setThreads(list)
      if (target?.userId) setActiveId(target.userId)
      else if (!activeId) setActiveId(list[0]?.other_id)
      return []
    } finally {
      setLoading(false)
    }
  }

  // ── Load messages for the open conversation ─────────────────────────────────
  async function loadThread(otherId, { silent = false } = {}) {
    if (!otherId) return
    try {
      const res = await fetch(`${API_BASE}/messages/${otherId}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('thread failed')
      const data = await res.json()
      setMessages(data.messages || [])
      setOffline(false)
    } catch {
      // Offline mock: pull from the in-memory store
      if (!silent) {
        setMessages(state.messages.filter(m =>
          (m.sender_id===myId && m.receiver_id===otherId) ||
          (m.sender_id===otherId && m.receiver_id===myId)))
      }
    }
  }

  // Initial load
  useEffect(() => {
    loadThreads().then(() => { if (target) clearTarget?.() })
  }, []) // eslint-disable-line

  // Load thread when active conversation changes
  useEffect(() => { if (activeId) { setMessages([]); loadThread(activeId) } }, [activeId]) // eslint-disable-line

  // ── Polling: refresh the open thread every 3s, the list every 12s ───────────
  useEffect(() => {
    if (offline) return // don't poll a backend that isn't there
    const fast = setInterval(() => { if (activeId) loadThread(activeId, { silent:true }) }, 3000)
    const slow = setInterval(() => { loadThreads() }, 12000)
    return () => { clearInterval(fast); clearInterval(slow) }
  }, [activeId, offline]) // eslint-disable-line

  // Auto-scroll to newest
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const activeThread = threads.find(t => t.other_id === activeId) || (activeId && pendingName ? { other_id: activeId, display_name: pendingName } : null)

  // ── Send (optimistic) ───────────────────────────────────────────────────────
  async function send() {
    const text = msg.trim()
    if (!text || !activeId) return
    setMsg('')

    // Optimistic: show the message instantly with a temp id
    const optimistic = {
      message_id: 'tmp-' + Date.now(),
      sender_id: myId, receiver_id: activeId,
      content: text, created_at: new Date().toISOString(),
      _pending: true,
    }
    setMessages(prev => [...prev, optimistic])
    setSending(true)

    try {
      const res = await fetch(API_BASE + '/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ receiver_id: activeId, content: text }),
      })
      if (!res.ok) throw new Error('send failed')
      // Re-sync from server so the temp message is replaced by the real one
      await loadThread(activeId, { silent:true })
      loadThreads()
    } catch {
      // Mark the optimistic bubble as failed
      setMessages(prev => prev.map(m => m.message_id===optimistic.message_id ? { ...m, _failed:true, _pending:false } : m))
      if (!offline) toast('Message failed to send', 'error')
    } finally {
      setSending(false)
    }
  }

  const initials = (name) => (name || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()

  return (
    <div className="page-enter" style={{ maxWidth:900 }}>
      <PageTitle sub="Direct messages">Messages</PageTitle>
      <FirstUseNote id="messages">Your task chats live here. Keep conversations on-platform — messages stay visible to admins if a dispute is ever raised.</FirstUseNote>
      {offline && <div style={{ background:'rgba(180,83,9,.08)', border:'1px solid rgba(180,83,9,.25)', borderRadius:8, padding:'8px 13px', marginBottom:14, fontSize:'.8rem', color:'var(--warning)' }}>Showing demo messages — start the backend to send real ones.</div>}
      <DCard hover={false} className={`msg-shell ${activeId ? 'has-active' : ''}`} style={{ display:'flex', height:580, padding:0, overflow:'hidden' }}>

        {/* Conversation list */}
        <div className="msg-list" style={{ width:248, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}><Mono size="0.65rem">Conversations</Mono></div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {loading && <div style={{ padding:20, textAlign:'center' }}><Spinner size={18} /></div>}
            {!loading && threads.length===0 && <div style={{ padding:'20px 14px' }}><Mono>No conversations yet</Mono></div>}
            {threads.map(t => {
              const isActive = activeId === t.other_id
              return (
                <div key={t.other_id} onClick={() => setActiveId(t.other_id)}
                  style={{ padding:'12px 14px', cursor:'pointer', background:isActive?'var(--accent-glow)':'transparent', borderLeft:isActive?'2px solid var(--accent)':'2px solid transparent', transition:'all 150ms ease' }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='var(--bg-hover)' }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent' }}>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    {t.avatar_url
                      ? <img src={t.avatar_url} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                      : <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.78rem', color:'var(--accent)', flexShrink:0 }}>{initials(t.display_name)}</div>}
                    <div style={{ flex:1, overflow:'hidden' }}>
                      <div style={{ fontWeight:600, fontSize:'0.85rem', marginBottom:2 }}>{t.display_name || 'User'}</div>
                      {t.last_message && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.last_message.slice(0,30)}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Active conversation */}
        <div className="msg-thread" style={{ flex:1, display:'flex', flexDirection:'column' }}>
          {!activeId ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <EmptyState icon="target" message="Select a conversation" />
            </div>
          ) : (
            <>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, background:'var(--bg-elevated)' }}>
                {/* Mobile-only: back to conversation list */}
                <button className="show-m" onClick={() => setActiveId(null)} aria-label="Back to conversations"
                  style={{ background:'none', border:'none', color:'var(--text-secondary)', fontSize:'1.2rem', cursor:'pointer', padding:0, marginRight:2, lineHeight:1 }}>←</button>
                <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.78rem', color:'var(--accent)', flexShrink:0 }}>{initials(activeThread?.display_name)}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{activeThread?.display_name || 'User'}</div>
                  <Mono size="0.62rem">Direct message</Mono>
                </div>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>
                {messages.length===0 && <EmptyState icon="target" message="Start the conversation" />}
                {messages.map(m => {
                  const mine = m.sender_id === myId
                  return (
                    <div key={m.message_id} style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start' }}>
                      <div style={{ maxWidth:'72%', background:mine?'var(--accent-glow)':'var(--bg-elevated)', border:`1px solid ${m._failed?'var(--danger)':(mine?'var(--accent-dim)':'var(--border)')}`, borderRadius:'var(--radius-md)', ...(mine?{borderBottomRightRadius:4}:{borderBottomLeftRadius:4}), padding:'10px 14px', opacity:m._pending?0.6:1 }}>
                        <p style={{ fontSize:'0.88rem', lineHeight:1.55 }}>{m.content}</p>
                        <Mono size="0.6rem" style={{ display:'block', textAlign:mine?'right':'left', marginTop:5 }}>
                          {new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                          {mine && (m._failed ? '  ✕ failed' : m._pending ? '  …' : (m.is_read ? '  ✓✓' : '  ✓'))}
                        </Mono>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
                <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={`Message ${activeThread?.display_name || ''}… (Enter to send)`}
                  style={{ flex:1, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', fontSize:'0.9rem', outline:'none' }} />
                <Btn onClick={send} disabled={!msg.trim() || sending}>Send</Btn>
              </div>
            </>
          )}
        </div>
      </DCard>
    </div>
  )
}

function Notifications({ setPage, setSelectedTask, openProfile }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [notifs, setNotifs] = useState(state.notifications)
  const [offline, setOffline] = useState(false)
  const token = () => localStorage.getItem('rl_token')
  // type → Icon name. Covers every type the backend emits; unknown → bell.
  const NOTIF_ICON = {
    'bid.submitted':'zap', 'bid.accepted':'check-circle',
    'task.submitted':'inbox', 'task.completed':'check-circle', 'task.changes_requested':'refresh',
    'task.cancelled':'x', 'task.price_proposed':'tag',
    'message.received':'message', 'review.received':'star', 'business.review':'star',
    'deal.new':'tag', 'deal.redeemed':'check-circle', 'dispute.opened':'scale', 'dispute.resolved':'scale',
    'follow.new':'heart', 'booking.new':'calendar', 'booking.cancelled':'calendar',
    'retainer.started':'refresh', 'retainer.cancelled':'x', 'onboarding_fee':'wallet',
  }
  const notifIcon = (t) => NOTIF_ICON[t] || 'bell'
  // Which notifications lead somewhere on click (drives the "Click to view" hint).
  const routes = (t = '') => /^(task\.|bid\.|message\.|deal\.|booking\.|retainer\.|dispute\.|follow\.)/.test(t) || t === 'review.received' || t === 'business.review'

  // Load notifications from backend, fall back to store if offline
  async function load() {
    try {
      const res = await fetch(API_BASE + '/notifications', { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setNotifs(data.notifications || [])
      setOffline(false)
    } catch {
      setNotifs(state.notifications)
      setOffline(true)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line
  // Poll every 15s for new notifications
  useEffect(() => {
    if (offline) return
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [offline]) // eslint-disable-line

  async function markAll() {
    setNotifs(prev => prev.map(n => ({ ...n, is_read:true })))  // optimistic
    toast('All notifications marked as read','info')
    if (offline) { dispatch({type:'MARK_ALL_READ'}); return }
    try {
      await fetch(API_BASE + '/notifications/read', { method:'PATCH', headers:{ Authorization:`Bearer ${token()}` } })
    } catch { /* already updated optimistically */ }
  }

  function handleClick(n) {
    setNotifs(prev => prev.map(x => x.notification_id===n.notification_id ? { ...x, is_read:true } : x))
    const t = n.type || '', ref = n.reference_id
    if (/^(task\.|bid\.)/.test(t) && ref)            { setSelectedTask(ref); setPage('task-detail'); return }
    if (t === 'message.received')                    { setPage('messages'); return }
    if (t === 'follow.new' && ref && openProfile)    { openProfile(ref); return }
    if (t.startsWith('order.'))                      { setPage('my-orders'); return }
    if (t.startsWith('deal.'))                       { setPage('deals'); return }
    if (t.startsWith('booking.') || t.startsWith('retainer.')) { setPage('schedule'); return }
    if (t.startsWith('dispute.'))                    { setPage('tasks-mine'); return }
    if (t === 'review.received' || t === 'business.review') { setPage('profile'); return }
    // Fallback: a task we happen to already have loaded.
    if (ref && state.tasks.find(x=>x.task_id===ref)) { setSelectedTask(ref); setPage('task-detail') }
  }
  return (
    <div className="page-enter" style={{ maxWidth:680 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <PageTitle sub={`${notifs.filter(n=>!n.is_read).length} unread`}>Notifications</PageTitle>
        {notifs.some(n=>!n.is_read)&&<Btn variant="ghost" size="sm" onClick={markAll}>Mark all read</Btn>}
      </div>
      {notifs.length===0&&<EmptyState icon="clock" message="No notifications yet" />}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {notifs.map(n => (
          <div key={n.notification_id} onClick={() => handleClick(n)}
            style={{ background:n.is_read?'var(--bg-surface)':'var(--bg-elevated)', border:`1px solid ${n.is_read?'var(--border)':'var(--border-strong)'}`, borderRadius:'var(--radius-md)', padding:'14px 16px', display:'flex', gap:14, cursor:'pointer', transition:'all 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-strong)'}
            onMouseLeave={e => e.currentTarget.style.borderColor=n.is_read?'var(--border)':'var(--border-strong)'}>
            <div style={{ flexShrink:0, marginTop:2, width:34, height:34, borderRadius:'50%', background:n.is_read?'var(--bg-elevated)':'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={notifIcon(n.type)} size={17} color={n.is_read?'var(--text-muted)':'var(--accent)'} /></div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                <span style={{ fontWeight:n.is_read?400:600, fontSize:'0.9rem' }}>{n.title}</span>
                <Mono style={{ flexShrink:0, marginLeft:10 }}>{new Date(n.created_at).toLocaleDateString()}</Mono>
              </div>
              <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{n.body}</p>
              {routes(n.type)&&<Mono color="var(--accent)" size="0.65rem" style={{ display:'block', marginTop:6 }}>Click to view →</Mono>}
            </div>
            {!n.is_read&&<div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', flexShrink:0, marginTop:6 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOCAL BUSINESS LISTINGS — public-facing browse + admin management
// ═══════════════════════════════════════════════════════════════════════════════

const BIZ_CATEGORIES = [
  'Food & drink', 'Print & stationery', 'Books', 'Groceries', 'Health & beauty',
  'Clothing', 'Tech & repairs', 'Services', 'Entertainment', 'Other',
]

// Campus zones — MUST stay identical to the server whitelist in auth.js / profile.js,
// or valid signups get rejected. Single source of truth for the dropdown.
// Fallback list — used only if GET /locations is unreachable (TD-11). The live
// source of truth is the data-driven `locations` table, so adding a campus is a
// DB insert, not a frontend deploy.
const CAMPUS_ZONE_LIST = [
  'West Campus', 'East Campus', 'Drostdy', 'Allan Webb', 'Founders',
  'Goldfields', 'Hobson', 'Kimberley', 'Botha', 'Dingane',
  'Adamson', 'Cory', 'Jan Smuts', 'Oriel', 'Prince Alfred',
  'Off-campus / Town', 'Other',
]

// Fetch the campus/zone picker options from the backend, flattened to names.
// Falls back to CAMPUS_ZONE_LIST so signup still works fully offline.
function useLocations() {
  const [zones, setZones] = useState(CAMPUS_ZONE_LIST)
  useEffect(() => {
    let alive = true
    fetch(API_BASE + '/locations')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('locations fetch failed'))))
      .then(data => {
        const names = (data.campuses || []).flatMap(c => (c.zones || []).map(z => z.name))
        if (alive && names.length) setZones(names)
      })
      .catch(() => { /* keep the fallback list */ })
    return () => { alive = false }
  }, [])
  return zones
}

// ─── A5: PROXIMITY (browser-side only) ─────────────────────────────────────────
// Design: the user's device coordinates NEVER leave the browser. We fetch the
// PUBLIC zone centroids from /locations (non-PII — same data campus pickers
// already expose), then compare them against the device's coarse position
// entirely client-side. Nothing about "where is this specific user" is ever
// sent to or stored on our server — the strongest reading of the brief's
// "ask consent, store coarse not precise, allow opt-out" requirement is to
// store nothing at all.

// { "West Campus": {lat,lng}, ... } — built once per Browse session from the
// same /locations payload useLocations() already fetches.
function useZoneCoords() {
  const [coords, setCoords] = useState({})
  useEffect(() => {
    let alive = true
    fetch(API_BASE + '/locations')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const map = {}
        for (const c of data.campuses || []) {
          for (const z of c.zones || []) {
            if (z.latitude != null && z.longitude != null) map[z.name] = { lat: +z.latitude, lng: +z.longitude }
          }
        }
        if (alive) setCoords(map)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return coords
}

// Haversine great-circle distance in km.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Explicit-consent geolocation: only ever called from a direct button click
// (never on mount/automatically). Rounds to ~100m so we work with the same
// "coarse" precision philosophy even before the coordinate is thrown away —
// it lives only in React state for this browsing session, never persisted.
function requestCoarseLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location isn’t available in this browser.')); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 }),
      () => reject(new Error('Location access denied — showing all results instead.')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  })
}

// Small reusable "📍 Near me" toggle: requests location on first click, flips
// off on a second click. Shared by Browse Tasks and Local so the affordance
// (and its honest microcopy) looks identical everywhere it appears.
function NearMeToggle({ active, onLocated, onCleared }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function click() {
    if (active) { onCleared(); return }
    setBusy(true)
    try { onLocated(await requestCoarseLocation()) }
    catch (e) { toast(e.message, 'error') }
    finally { setBusy(false) }
  }
  return (
    <button onClick={click} disabled={busy} title="Uses your device location for this browse session only — never sent to our servers or stored."
      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:100, fontSize:'.82rem', fontWeight:600, whiteSpace:'nowrap', cursor:busy?'progress':'pointer', border:`1px solid ${active?'var(--accent)':'var(--border)'}`, background:active?'var(--accent)':'var(--bg-surface)', color:active?'#fff':'var(--text-secondary)' }}>
      📍 {busy ? 'Locating…' : active ? 'Near me' : 'Sort by distance'}
    </button>
  )
}

// Small image gallery used on business cards/detail
// ─── SOCIAL GRAPH ──────────────────────────────────────────────────────────────
// Follow/unfollow a user or business. Shows follower count + the viewer's state.
// Renders nothing for logged-out viewers (following is a signed-in action).
function FollowButton({ targetType, targetId, size, showFavourite }) {
  const [state, setState] = useState(null)   // { following, favourite, followers }
  const [busy, setBusy] = useState(false)
  const token = () => localStorage.getItem('rl_token')
  useEffect(() => {
    if (!token() || !targetId) { setState(null); return }
    let alive = true
    fetch(`${API_BASE}/follows/state/${targetType}/${targetId}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null).then(d => { if (alive && d) setState(d) }).catch(() => {})
    return () => { alive = false }
  }, [targetType, targetId])
  if (!token() || !state) return null
  async function toggle() {
    setBusy(true)
    const was = state.following
    try {
      const res = was
        ? await fetch(`${API_BASE}/follows/${targetType}/${targetId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
        : await fetch(`${API_BASE}/follows`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ targetType, targetId }) })
      if (res.ok) setState(s => ({ ...s, following: !was, favourite: was ? false : s.favourite, followers: Math.max(0, (s.followers || 0) + (was ? -1 : 1)) }))
    } catch { /* ignore */ } finally { setBusy(false) }
  }
  async function toggleFav() {
    const next = !state.favourite
    const wasFollowing = state.following
    setState(s => ({ ...s, favourite: next, following: true, followers: wasFollowing ? s.followers : (s.followers || 0) + 1 }))
    try {
      await fetch(`${API_BASE}/follows/${targetType}/${targetId}/favourite`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ favourite: next }),
      })
    } catch { setState(s => ({ ...s, favourite: !next })) }
  }
  const followBtn = (
    <Btn variant={state.following ? 'secondary' : 'primary'} size={size} loading={busy} onClick={toggle}>
      {state.following ? '✓ Following' : '+ Follow'}{state.followers > 0 ? ` · ${state.followers}` : ''}
    </Btn>
  )
  if (!showFavourite) return followBtn
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      {followBtn}
      <button onClick={toggleFav} aria-label={state.favourite ? 'Remove from favourites' : 'Save to favourites'} title={state.favourite ? 'Favourited' : 'Save to favourites'}
        style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, border:`1px solid ${state.favourite?'var(--accent)':'var(--border)'}`, background:state.favourite?'var(--accent-glow)':'transparent', color:state.favourite?'var(--accent)':'var(--text-secondary)', cursor:'pointer', fontSize:'1rem', lineHeight:1 }}>
        {state.favourite ? '★' : '☆'}
      </button>
    </span>
  )
}

// "Following" page — the users and businesses the current user follows.
function FollowingPage({ openProfile, setPage }) {
  const token = () => localStorage.getItem('rl_token')
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    fetch(API_BASE + '/follows/me', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('follows')))
      .then(d => { if (alive) setData(d) })
      .catch(() => { if (alive) setData({ users: [], businesses: [] }) })
    return () => { alive = false }
  }, [])
  if (!data) return <div style={{ padding: 50, textAlign: 'center' }}><Spinner /></div>
  const empty = data.users.length === 0 && data.businesses.length === 0
  return (
    <div className="page-enter">
      <PageTitle sub="People and businesses you follow">Following</PageTitle>
      <div style={{ marginBottom: 22 }}><MyRetainers /></div>
      {empty ? <EmptyState icon="users" message="You're not following anyone yet — follow people and businesses to see them here" />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {data.users.length > 0 && <div>
            <Mono style={{ display: 'block', marginBottom: 10 }}>People ({data.users.length})</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.users.map(u => (
                <DCard key={u.user_id} hover onClick={() => openProfile(u.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                  {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(u.display_name || '?').charAt(0).toUpperCase()}</div>}
                  <span style={{ fontWeight: 600 }}>{u.display_name || 'ReLivR user'}{u.favourite && <span title="Favourite" aria-label="Favourite" style={{ color:'var(--accent)', marginLeft:6 }}>★</span>}</span>
                </DCard>
              ))}
            </div>
          </div>}
          {data.businesses.length > 0 && <div>
            <Mono style={{ display: 'block', marginBottom: 10 }}>Businesses ({data.businesses.length})</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.businesses.map(b => (
                <DCard key={b.business_id} hover onClick={() => setPage('local-browse')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                  {b.logo_url ? <img src={b.logo_url} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover' }} />
                    : <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◇</div>}
                  <div><div style={{ fontWeight: 600 }}>{b.name || 'Business'}{b.favourite && <span title="Favourite" aria-label="Favourite" style={{ color:'var(--accent)', marginLeft:6 }}>★</span>}</div><Mono style={{ color: 'var(--text-muted)' }}>{b.category}</Mono></div>
                </DCard>
              ))}
            </div>
          </div>}
        </div>}
    </div>
  )
}

function BizGallery({ images = [], height = 160, aspect = null, radius = 'var(--radius-sm)' }) {
  const [idx, setIdx] = useState(0)
  // `aspect` (e.g. '1 / 1') makes the frame responsive + full-width — used by the
  // Instagram-style feed; otherwise fall back to a fixed pixel `height` (cards/detail).
  const frame = aspect ? { aspectRatio: aspect, width:'100%' } : { height }
  if (!images || images.length === 0) {
    return <div style={{ ...frame, background:'var(--bg-elevated)', borderRadius:radius, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:'1.6rem' }}>◇</div>
  }
  return (
    <div style={{ position:'relative', ...frame, borderRadius:radius, overflow:'hidden', background:'var(--bg-elevated)' }}>
      <img src={images[idx]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i-1+images.length)%images.length) }}
            style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', border:'none', background:'rgba(0,0,0,.45)', color:'#fff', borderRadius:'50%', width:28, height:28, cursor:'pointer' }}>‹</button>
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i+1)%images.length) }}
            style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', border:'none', background:'rgba(0,0,0,.45)', color:'#fff', borderRadius:'50%', width:28, height:28, cursor:'pointer' }}>›</button>
          <div style={{ position:'absolute', bottom:6, left:0, right:0, display:'flex', justifyContent:'center', gap:4 }}>
            {images.map((_,i) => <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:i===idx?'#fff':'rgba(255,255,255,.5)' }} />)}
          </div>
        </>
      )}
    </div>
  )
}

// All of a business's photos as one ordered, de-duplicated list (cover first).
function bizPhotos(b) {
  return [b.cover_image_url, ...(b.image_urls || [])]
    .filter(Boolean)
    .filter((u, i, a) => a.indexOf(u) === i)
}

// A business tile in the Local directory grid (Instagram-explore style): a large
// cover image with a "multiple photos" badge, then a mini avatar + name + category.
function BizGridTile({ b, onOpen, distanceKm: dist }) {
  const photos = bizPhotos(b)
  const cover = photos[0] || null
  const initial = (b.name || '?').trim().charAt(0).toUpperCase()
  return (
    <DCard hover onClick={onOpen} style={{ padding:0, overflow:'hidden', cursor:'pointer' }}>
      <div style={{ position:'relative', aspectRatio:'4 / 3', background:'var(--bg-elevated)' }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:'2.4rem', fontFamily:'var(--font-display)' }}>{initial}</div>}
        {photos.length > 1 && <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.58)', color:'#fff', borderRadius:8, padding:'2px 8px', fontSize:'.7rem', fontWeight:600, fontFamily:'var(--font-mono)' }}>▦ {photos.length}</div>}
        {b.boosted && <div style={{ position:'absolute', top:8, left:8, background:'var(--accent)', color:'#fff', borderRadius:8, padding:'2px 8px', fontSize:'.62rem', fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase' }}>Promoted</div>}
        {dist!=null && <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,.58)', color:'#fff', borderRadius:8, padding:'2px 8px', fontSize:'.65rem', fontWeight:600, fontFamily:'var(--font-mono)' }}>📍 {dist<1?Math.round(dist*1000)+'m':dist.toFixed(1)+'km'}</div>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px' }}>
        {b.logo_url
          ? <img src={b.logo_url} alt="" style={{ width:26, height:26, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
          : <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:'var(--accent-glow)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.78rem', fontFamily:'var(--font-display)' }}>{initial}</div>}
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.92rem', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.name}</div>
          <div style={{ fontSize:'.7rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.category}</div>
        </div>
      </div>
    </DCard>
  )
}

// Full-screen Instagram-style photo viewer: arrow / keyboard / swipe through a
// business's photos. Closes on ✕, backdrop click, or Escape.
function BizLightbox({ images, index, onClose, onNav }) {
  const touchX = useRef(null)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNav(1)
      else if (e.key === 'ArrowLeft') onNav(-1)
    }
    window.addEventListener('keydown', onKey)
    // Lock background scroll while the viewer is open (Instagram-style takeover).
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [onClose, onNav])
  const n = images.length
  // Portalled to <body> so it escapes the page's transformed stacking context
  // and covers the whole viewport (above the sticky header + bottom nav).
  return createPortal(
    <div onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) onNav(dx < 0 ? 1 : -1); touchX.current = null }}
      style={{ position:'fixed', inset:0, zIndex:1500, background:'rgba(0,0,0,.92)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <button onClick={(e) => { e.stopPropagation(); onClose() }} aria-label="Close"
        style={{ position:'absolute', top:16, right:16, width:40, height:40, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.14)', color:'#fff', fontSize:'1.1rem', cursor:'pointer', zIndex:2 }}>✕</button>
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth:'92vw', maxHeight:'86vh', objectFit:'contain', borderRadius:10, boxShadow:'0 24px 70px rgba(0,0,0,.6)' }} />
      {n > 1 && <>
        <button onClick={(e) => { e.stopPropagation(); onNav(-1) }} aria-label="Previous"
          style={{ position:'absolute', left:'max(10px,3vw)', top:'50%', transform:'translateY(-50%)', width:46, height:46, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.14)', color:'#fff', fontSize:'1.6rem', cursor:'pointer' }}>‹</button>
        <button onClick={(e) => { e.stopPropagation(); onNav(1) }} aria-label="Next"
          style={{ position:'absolute', right:'max(10px,3vw)', top:'50%', transform:'translateY(-50%)', width:46, height:46, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.14)', color:'#fff', fontSize:'1.6rem', cursor:'pointer' }}>›</button>
        <div style={{ position:'absolute', top:20, left:0, right:0, textAlign:'center', color:'rgba(255,255,255,.7)', fontFamily:'var(--font-mono)', fontSize:'.8rem' }}>{index + 1} / {n}</div>
        <div style={{ position:'absolute', bottom:20, left:0, right:0, display:'flex', justifyContent:'center', gap:6 }}>
          {images.map((_, i) => <span key={i} style={{ width:7, height:7, borderRadius:'50%', background:i === index ? '#fff' : 'rgba(255,255,255,.4)' }} />)}
        </div>
      </>}
    </div>,
    document.body
  )
}

// E1: a business's rating + reviews, with a leave-a-review form (anyone can review).
// Public catalog on a business profile (Batch 5) — available items only.
// Renders nothing if the business has no catalog, so it never leaves an empty header.
function BusinessCatalogPublic({ businessId }) {
  const { user } = useAuth()
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [products, setProducts] = useState(null)
  const [orderItem, setOrderItem] = useState(null)   // product being ordered, or null
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState('')
  const [placing, setPlacing] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/businesses/${businessId}/products`)
      .then(r => r.ok ? r.json() : { products: [] })
      .then(d => { if (!cancelled) setProducts(d.products || []) })
      .catch(() => { if (!cancelled) setProducts([]) })
    return () => { cancelled = true }
  }, [businessId])

  function startOrder(p) {
    if (!user) { toast('Log in to place an order', 'info'); return }
    setOrderItem(p); setQty('1'); setNote(''); setPhone('')
  }
  const orderQty = Math.max(1, Math.min(999, parseInt(qty, 10) || 1))
  const orderTotal = orderItem && orderItem.price_cents != null ? orderItem.price_cents * orderQty : null

  async function placeOrder() {
    setPlacing(true)
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ product_id: orderItem.product_id, quantity: orderQty, note: note.trim() || null, contact_phone: phone.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not place order')
      toast('Order placed — the business will confirm. Pay on collection.', 'success')
      setOrderItem(null)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setPlacing(false)
    }
  }

  if (!products || products.length === 0) return null
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 12 }}>Catalog</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {products.map(p => (
          <div key={p.product_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            {p.image_url
              ? <img src={p.image_url} alt="" loading="lazy" style={{ width: 46, height: 46, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 46, height: 46, borderRadius: 9, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>▦</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              {p.description && <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.85rem', marginTop: 2 }}>{p.price_cents != null ? `R${(p.price_cents / 100).toFixed(2)}` : <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>on request</span>}</div>
            </div>
            <button type="button" onClick={() => startOrder(p)}
              style={{ flexShrink: 0, alignSelf: 'stretch', padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '.78rem', background: 'var(--text-primary)', color: 'var(--bg-base)' }}>
              Order
            </button>
          </div>
        ))}
      </div>

      <Modal open={!!orderItem} onClose={() => setOrderItem(null)} title={orderItem ? `Order · ${orderItem.name}` : 'Order'} maxWidth={440}>
        {orderItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', fontSize: '.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Pay on collection.</strong> This places an order with the business — no card payment here. They'll confirm and you settle up (cash/EFT) when you collect.
            </div>
            <Input label="Quantity" type="number" min="1" max="999" value={qty} onChange={e => setQty(e.target.value)} />
            <Textarea label="Note (optional)" placeholder="Size, collection time, anything they should know…" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 80 }} />
            <Input label="Contact number (optional)" type="tel" placeholder="So they can reach you" value={phone} onChange={e => setPhone(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 2px' }}>
              <span style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>Total</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' }}>{orderTotal != null ? `R${(orderTotal / 100).toFixed(2)}` : 'Price on collection'}</span>
            </div>
            <Btn fullWidth loading={placing} onClick={placeOrder}>Place order</Btn>
          </div>
        )}
      </Modal>
    </div>
  )
}

function BusinessReviews({ businessId }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [data, setData] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => { const tok = localStorage.getItem('rl_token'); return fetch(`${API_BASE}/businesses/${businessId}/reviews`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined).then(r => r.ok ? r.json() : { reviews: [] }).then(setData).catch(() => setData({ reviews: [] })) }
  useEffect(() => { load() }, [businessId]) // eslint-disable-line
  async function submit() {
    if (!token()) { toast('Sign in to leave a review', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/businesses/${businessId}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ rating, comment: comment.trim() || null }) })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not submit your review')
      toast('Review submitted', 'success'); setComment(''); load()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Mono size="0.68rem" color="var(--accent)">Reviews</Mono>
        {data?.rating_count > 0 && <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>★ {data.avg_rating} · {data.rating_count} review{data.rating_count === 1 ? '' : 's'}</span>}
      </div>
      {token() && (
        <DCard hover={false} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, padding: 0, color: n <= rating ? 'var(--amber)' : 'var(--border-strong)' }}>★</button>)}
          </div>
          <Textarea label="Your review (optional)" value={comment} onChange={e => setComment(e.target.value)} placeholder="How was it?" style={{ minHeight: 70 }} />
          <Btn size="sm" loading={saving} onClick={submit} style={{ marginTop: 10 }}>Post review</Btn>
        </DCard>
      )}
      {data === null ? null
        : data.reviews.length === 0 ? <Mono style={{ color: 'var(--text-muted)' }}>No reviews yet — be the first.</Mono>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.reviews.map(r => (
              <DCard key={r.review_id} hover={false}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: 'var(--amber)' }}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--border-strong)' }}>{'★'.repeat(5 - r.rating)}</span></span>
                  <Mono style={{ color: 'var(--text-muted)' }}>{r.reviewer_name || 'ReLivR user'}</Mono>
                </div>
                {r.comment && <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{r.comment}</p>}
              </DCard>
            ))}
          </div>}
    </div>
  )
}

function LocalBrowse({ setPage }) {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [cat, setCat]               = useState('all')
  const [selected, setSelected]     = useState(null)
  const [lightbox, setLightbox]     = useState(null)   // photo index in the open profile, or null
  const [myLoc, setMyLoc]           = useState(null)   // A5: {lat,lng} for this browse session only, or null
  const zoneCoords = useZoneCoords()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const q = cat === 'all' ? '' : `?category=${encodeURIComponent(cat)}`
    // /businesses is a public read, but pre-launch the server gate blocks
    // anonymous requests. Send the token when signed in so app-accessible users
    // (incl. QA/test accounts) see the directory; at launch the gate opens and
    // this works for everyone with or without a token.
    const tok = localStorage.getItem('rl_token')
    fetch(`${API_BASE}/businesses${q}`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setBusinesses(d.businesses || []); setLoading(false) } })
      .catch(() => { if (!cancelled) { setBusinesses([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [cat])

  // Deep-link (E2 QR / shareable link): /local?b=<business_id> opens that profile.
  // Falls back to the module-captured id in sessionStorage so a scan that bounced
  // through login still resolves; the id is consumed once.
  useEffect(() => {
    let id = new URLSearchParams(window.location.search).get('b')
    if (!id) { try { id = sessionStorage.getItem('rl_pending_biz') } catch { /* noop */ } }
    if (!id) return
    try { sessionStorage.removeItem('rl_pending_biz') } catch { /* noop */ }
    const tok = localStorage.getItem('rl_token')
    fetch(`${API_BASE}/businesses/${id}`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.business) { setSelected(d.business); trackBizEvent(id, 'view') } }).catch(() => {})
  }, [])

  // Detail view — an Instagram-style business "profile": header (avatar, name,
  // stats, follow), bio + contact actions, then a 3-column photo grid that opens
  // a full-screen swipeable lightbox.
  if (selected) {
    const b = selected
    const photos = bizPhotos(b)
    const initial = (b.name || '?').trim().charAt(0).toUpperCase()
    const avatarSize = 'clamp(76px,20vw,150px)'
    return (
      <div className="page-enter" style={{ maxWidth:935, margin:'0 auto' }}>
        <BackButton onClick={() => { setSelected(null); setLightbox(null) }} label="Back to Local" />

        {/* Profile header */}
        <div style={{ display:'flex', flexDirection:'column', gap:18, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:'clamp(18px,5vw,44px)', alignItems:'center' }}>
            {b.logo_url
              ? <img src={b.logo_url} alt="" style={{ width:avatarSize, height:avatarSize, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'1px solid var(--border)' }} />
              : <div style={{ width:avatarSize, height:avatarSize, borderRadius:'50%', flexShrink:0, background:'var(--accent-glow)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontFamily:'var(--font-display)', fontSize:'clamp(1.8rem,6vw,3rem)' }}>{initial}</div>}
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:14 }}>
                <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.3rem,4vw,1.7rem)', margin:0 }}>{b.name}</h1>
                <FollowButton targetType="business" targetId={b.business_id} size="sm" showFavourite />
              </div>
              <div style={{ display:'flex', gap:'clamp(16px,4vw,30px)', flexWrap:'wrap', alignItems:'center', fontSize:'.9rem', color:'var(--text-secondary)' }}>
                <span><strong style={{ color:'var(--text-primary)' }}>{photos.length}</strong> photo{photos.length===1?'':'s'}</span>
                {b.rating_count > 0 && <span><strong style={{ color:'var(--text-primary)' }}>★ {b.avg_rating}</strong> ({b.rating_count})</span>}
                {b.follower_count > 0 && <span><strong style={{ color:'var(--text-primary)' }}>{b.follower_count}</strong> follower{b.follower_count===1?'':'s'}</span>}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <strong style={{ fontFamily:'var(--font-display)', fontSize:'.95rem' }}>{b.name}</strong>
              <Tag>{b.category}</Tag>
            </div>
            {b.description && <p style={{ color:'var(--text-secondary)', lineHeight:1.65, margin:'0 0 10px' }}>{b.description}</p>}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {b.address && <Mono style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="pin" size={13} /> {b.address}</Mono>}
              {b.hours   && <Mono style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="clock" size={13} /> {b.hours}</Mono>}
            </div>
          </div>

          {/* Contact actions */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {b.phone    && <a href={`tel:${b.phone}`} onClick={() => trackBizEvent(b.business_id, 'phone_click')} style={{ textDecoration:'none' }}><Btn variant="secondary" size="sm"><Icon name="phone" size={14} /> Call</Btn></a>}
            {b.whatsapp && <a href={`https://wa.me/${b.whatsapp.replace(/[^0-9]/g,'')}`} onClick={() => trackBizEvent(b.business_id, 'whatsapp_click')} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}><Btn variant="secondary" size="sm"><Icon name="message" size={14} /> WhatsApp</Btn></a>}
            {b.link_url && <a href={b.link_url} onClick={() => trackBizEvent(b.business_id, 'link_click')} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration:'none' }}><Btn variant="ghost" size="sm"><Icon name="link" size={14} /> Website</Btn></a>}
          </div>

          {/* Trust triad (Serv pattern) — every claim is a real ReLivR guarantee */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:16 }}>
            {[
              { icon:'shield', color:'var(--verified)', title:'Verified owner', desc:'ID-checked at signup' },
              { icon:'star',   color:'var(--accent)',   title:'Community-rated', desc:'Real ratings & reviews' },
              { icon:'lock',   color:'var(--text-secondary)', title:'POPIA-protected', desc:'Your data stays private' },
            ].map(x => (
              <div key={x.title} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 12px', textAlign:'center' }}>
                <div style={{ width:32, height:32, margin:'0 auto 8px', borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={x.icon} size={17} color={x.color} /></div>
                <div style={{ fontWeight:700, fontSize:'.78rem', marginBottom:2 }}>{x.title}</div>
                <div style={{ fontSize:'.68rem', color:'var(--text-muted)', lineHeight:1.35 }}>{x.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <BookingPanel hostType="business" hostId={b.business_id} hostName={b.name} />

        {/* Photo grid */}
        {photos.length === 0
          ? <EmptyState icon="inbox" message="No photos yet." />
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'clamp(2px,1vw,6px)', marginTop:4 }}>
              {photos.map((src, i) => (
                <div key={i} onClick={() => setLightbox(i)} style={{ aspectRatio:'1 / 1', overflow:'hidden', cursor:'pointer', background:'var(--bg-elevated)' }}>
                  <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                </div>
              ))}
            </div>}

        <BusinessCatalogPublic businessId={b.business_id} />

        <BusinessReviews businessId={b.business_id} />

        {lightbox != null && <BizLightbox images={photos} index={lightbox} onClose={() => setLightbox(null)} onNav={(d) => setLightbox(i => (i + d + photos.length) % photos.length)} />}
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div style={{ position:'relative', borderRadius:22, overflow:'hidden', marginBottom:22, boxShadow:'var(--shadow-md)' }}>
        <img src="/img/local-cafe.webp" alt="A local café in the neighbourhood" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg, rgba(19,17,24,.82) 0%, rgba(19,17,24,.5) 55%, rgba(19,17,24,.2) 100%)' }} />
        <div style={{ position:'relative', zIndex:1, padding:'clamp(26px,5vw,44px)' }}>
          <div className="slabel" style={{ color:'var(--highlight)', marginBottom:12 }}>Local Directory</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.6rem,3vw,2.2rem)', marginBottom:6, color:'#fff', letterSpacing:'-.01em' }}>Local businesses</h1>
          <p style={{ color:'rgba(255,255,255,.85)', fontSize:'.95rem', maxWidth:440 }}>Discover the businesses around you — supported by ReLivR.</p>
        </div>
      </div>

      <FirstUseNote id="local">Tap any business to open its profile — scroll their photos Instagram-style and grab student-only deals.</FirstUseNote>

      {/* Category filter + proximity toggle */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <div className="feed-scroll" style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
          {['all', ...BIZ_CATEGORIES].map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding:'7px 14px', borderRadius:100, fontSize:'.82rem', fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', border:`1px solid ${cat===c?'var(--accent)':'var(--border)'}`, background:cat===c?'var(--accent)':'var(--bg-surface)', color:cat===c?'#fff':'var(--text-secondary)' }}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
        <NearMeToggle active={!!myLoc} onLocated={setMyLoc} onCleared={() => setMyLoc(null)} />
      </div>

      {loading ? <div style={{ padding:50, textAlign:'center' }}><Spinner /></div>
       : businesses.length === 0 ? (
        <EmptyState icon="inbox" message={cat==='all' ? 'No local businesses listed yet — check back soon!' : `No businesses in ${cat} yet`} />
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'clamp(8px,1.5vw,16px)' }}>
          {businesses
            .map(b => {
              const z = b.campus_zone && zoneCoords[b.campus_zone]
              const dist = (myLoc && z) ? distanceKm(myLoc.lat, myLoc.lng, z.lat, z.lng) : undefined
              return { ...b, _dist: dist }
            })
            .sort((a, b) => {
              if (!myLoc) return 0 // preserve the server order (boosted-first) when not sorting by distance
              if (a._dist == null && b._dist == null) return 0
              if (a._dist == null) return 1
              if (b._dist == null) return -1
              return a._dist - b._dist
            })
            .map(b => (
              <BizGridTile key={b.business_id} b={b} distanceKm={b._dist} onOpen={() => { setSelected(b); setLightbox(null); trackBizEvent(b.business_id, 'view') }} />
            ))}
        </div>
      )}
    </div>
  )
}

function AdminBusinesses() {
  const toast = useToast()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState(null)   // business object or 'new' or null
  const token = () => localStorage.getItem('rl_token')

  function load() {
    setLoading(true)
    fetch(API_BASE + '/businesses/admin/all', { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => { setBusinesses(d.businesses || []); setLoading(false) })
      .catch(() => { setBusinesses([]); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  // E5: switch a business's capabilities on/off.
  async function toggleFeature(b, feat) {
    const cur = Array.isArray(b.disabled_features) ? b.disabled_features : []
    const next = cur.includes(feat) ? cur.filter(x => x !== feat) : [...cur, feat]
    try {
      const res = await fetch(`${API_BASE}/businesses/${b.business_id}/features`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ disabledFeatures: next }) })
      if (!res.ok) throw new Error('Update failed')
      setBusinesses(bs => bs.map(x => x.business_id === b.business_id ? { ...x, disabled_features: next } : x))
      toast(`${b.name}: ${feat} ${next.includes(feat) ? 'disabled' : 'enabled'}`, 'success')
    } catch { toast('Could not update the feature', 'error') }
  }

  if (editing) return <BusinessForm business={editing==='new'?null:editing} onDone={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />

  const statusColor = { active:'var(--success)', pending:'var(--warning)', expired:'var(--text-muted)' }

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.5rem', marginBottom:4 }}>Business Listings</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'.88rem' }}>Manage local partner listings. Set status to <strong>active</strong> to show them in Local.</p>
        </div>
        <Btn onClick={() => setEditing('new')}>＋ Add Business</Btn>
      </div>

      {loading ? <div style={{ padding:50, textAlign:'center' }}><Spinner /></div>
       : businesses.length === 0 ? (
        <EmptyState icon="inbox" message="No businesses yet — add your first local partner." action={<Btn onClick={() => setEditing('new')}>＋ Add Business</Btn>} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {businesses.map(b => (
            <DCard key={b.business_id} hover={false} style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:48, height:48, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--bg-elevated)' }}>
                  {(b.image_urls?.[0] || b.logo_url) ? <img src={b.logo_url || b.image_urls[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)' }}>◇</div>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700 }}>{b.name}{b.boosted && <span style={{ marginLeft:8, fontSize:'.62rem', fontWeight:700, color:'var(--accent)', textTransform:'uppercase' }}>★ promoted</span>}</div>
                  <Mono>{b.category}{b.signed_by_rep?` · ${b.signed_by_rep}`:''}</Mono>
                </div>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:statusColor[b.status]||'var(--text-muted)' }}>{b.status}</span>
                <Btn variant="secondary" size="sm" onClick={() => setEditing(b)}>Edit</Btn>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <Mono style={{ color:'var(--text-muted)' }}>Disable:</Mono>
                {['deals','bookings','reviews','boost'].map(feat => {
                  const off = (b.disabled_features||[]).includes(feat)
                  return <button key={feat} onClick={() => toggleFeature(b, feat)}
                    style={{ padding:'3px 10px', borderRadius:100, fontSize:'.72rem', fontWeight:600, cursor:'pointer', border:`1px solid ${off?'var(--danger)':'var(--border)'}`, background:off?'var(--danger)':'transparent', color:off?'#fff':'var(--text-secondary)' }}>{feat}{off?' ✕':''}</button>
                })}
              </div>
            </DCard>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CLOUDINARY IMAGE UPLOAD ───────────────────────────────────────────────────
// Business owners (and admins) upload photos straight from their device. The file
// goes BROWSER → CLOUDINARY directly using a short-lived signature minted by our
// backend (POST /uploads/signature) — it never passes through our server. The
// returned URL is then saved through the normal /businesses save path.
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024 // 10 MB — generous for phone photos
const UPLOAD_OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Insert f_auto,q_auto into a Cloudinary delivery URL so every render site serves
// an optimised (auto format + quality) image with no extra wiring.
function optimizeCldUrl(url) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  if (/\/upload\/(f_auto|q_auto)/.test(url)) return url // already optimised
  return url.replace('/upload/', '/upload/f_auto,q_auto/')
}

async function fetchUploadSignature(businessId, scope) {
  const token = localStorage.getItem('rl_token')
  const body = {}
  if (businessId) body.businessId = businessId
  if (scope) body.scope = scope
  const res = await fetch(`${API_BASE}/uploads/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.message || 'Uploads are unavailable right now.')
  return d
}

// XHR (not fetch) so we get an upload progress callback for big phone photos.
function postToCloudinary(file, sig, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('api_key', sig.apiKey)
    form.append('timestamp', sig.timestamp)
    form.append('folder', sig.folder)
    // Must echo every signed param back verbatim, or Cloudinary rejects the signature.
    if (sig.allowedFormats) form.append('allowed_formats', sig.allowedFormats)
    if (sig.uploadPreset) form.append('upload_preset', sig.uploadPreset)
    form.append('signature', sig.signature)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let r = {}
      try { r = JSON.parse(xhr.responseText) } catch { /* fall through to error */ }
      if (xhr.status >= 200 && xhr.status < 300 && r.secure_url) resolve(optimizeCldUrl(r.secure_url))
      else reject(new Error(r?.error?.message || 'Upload failed.'))
    }
    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.send(form)
  })
}

// Drag/drop + tap-to-pick uploader. Calls onUploaded(url) once per file. On
// mobile, accept="image/*" lets the user pick from camera OR photo library.
function ImageUpload({ businessId, scope, multiple = false, onUploaded, label }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [drag, setDrag] = useState(false)

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || busy) return
    setBusy(true)
    let any = false
    try {
      for (const file of files) {
        if (!UPLOAD_OK_TYPES.includes(file.type)) { toast(`${file.name}: use JPG, PNG, WebP or GIF`, 'error'); continue }
        if (file.size > UPLOAD_MAX_BYTES) { toast(`${file.name}: must be under 10 MB`, 'error'); continue }
        setPct(0)
        // Fresh signature per file — avoids any timestamp-expiry edge cases.
        const sig = await fetchUploadSignature(businessId, scope)
        const url = await postToCloudinary(file, sig, setPct)
        onUploaded(url)
        any = true
      }
      if (any) toast(multiple ? 'Photos uploaded' : 'Photo uploaded', 'success')
    } catch (e) {
      toast(e.message || 'Upload failed', 'error')
    } finally {
      setBusy(false); setPct(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => { if (!busy) inputRef.current?.click() }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); inputRef.current?.click() } }}
      style={{
        border: `1px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', padding: '14px 16px', textAlign: 'center',
        cursor: busy ? 'progress' : 'pointer', background: drag ? 'var(--bg-elevated)' : 'transparent',
        transition: 'all .15s', marginBottom: 8,
      }}
    >
      <Mono size="0.72rem" color={busy ? 'var(--accent)' : 'var(--text-muted)'}>
        {busy ? `Uploading… ${pct}%` : (label || (multiple ? '⬆ Tap to upload or drop photos' : '⬆ Tap to upload or drop a photo'))}
      </Mono>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
    </div>
  )
}

function BusinessForm({ business, onDone, onCancel }) {
  const toast = useToast()
  const isNew = !business
  const [f, setF] = useState({
    name: business?.name || '', category: business?.category || BIZ_CATEGORIES[0],
    description: business?.description || '', address: business?.address || '',
    campusZone: business?.campus_zone || '',
    hours: business?.hours || '', phone: business?.phone || '', whatsapp: business?.whatsapp || '',
    email: business?.email || '', linkUrl: business?.link_url || '', logoUrl: business?.logo_url || '',
    status: business?.status || 'pending', feePaid: business?.fee_paid || '',
    signedByRep: business?.signed_by_rep || '', notes: business?.notes || '',
  })
  const [images, setImages] = useState(business?.image_urls || [])
  const [imgInput, setImgInput] = useState('')
  const [saving, setSaving] = useState(false)
  const token = () => localStorage.getItem('rl_token')
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }))
  const zones = useLocations()

  function addImage() {
    const v = imgInput.trim()
    if (!v) return
    if (images.length >= 8) { toast('Up to 8 images', 'error'); return }
    setImages(arr => [...arr, v]); setImgInput('')
  }

  async function save() {
    if (!f.name.trim() || !f.category.trim()) { toast('Name and category are required', 'error'); return }
    setSaving(true)
    try {
      const payload = { ...f, feePaid: f.feePaid===''?null:parseFloat(f.feePaid), imageUrls: images }
      const url = isNew ? '/businesses' : `/businesses/${business.business_id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.message || data.errors?.[0]?.msg || 'Save failed')
      toast(isNew ? 'Business added' : 'Business updated', 'success')
      onDone()
    } catch (err) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this business listing permanently?')) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/businesses/${business.business_id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token()}` } })
      if (!res.ok) throw new Error('Delete failed')
      toast('Business deleted', 'success'); onDone()
    } catch (err) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="page-enter" style={{ maxWidth:680 }}>
      <BackButton onClick={onCancel} label="Back to listings" />
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.5rem', marginBottom:18 }}>{isNew ? 'Add a business' : 'Edit business'}</h1>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <DCard hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Public details</Mono>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Business name" value={f.name} onChange={set('name')} />
            <SelectField label="Category" value={f.category} onChange={set('category')}>
              {BIZ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <Textarea label="Description" value={f.description} onChange={set('description')} hint="1–2 sentences customers will see." />
            <Input label="Address" value={f.address} onChange={set('address')} placeholder="e.g. 12 High Street, Makhanda" />
            <SelectField label="Zone / area (for Local's distance sort)" value={f.campusZone} onChange={set('campusZone')}>
              <option value="">Not specified</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </SelectField>
            <Input label="Hours" value={f.hours} onChange={set('hours')} placeholder="Mon–Fri 8–17, Sat 9–13" />
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:140 }}><Input label="Phone" value={f.phone} onChange={set('phone')} /></div>
              <div style={{ flex:1, minWidth:140 }}><Input label="WhatsApp" value={f.whatsapp} onChange={set('whatsapp')} /></div>
            </div>
            <Input label="Email" value={f.email} onChange={set('email')} type="email" />
            <Input label="Website / social link" value={f.linkUrl} onChange={set('linkUrl')} placeholder="instagram.com/their-handle" hint="Any valid link — checked on save." />
            <div>
              <Input label="Logo (optional)" value={f.logoUrl} onChange={set('logoUrl')} placeholder="Upload below or paste a URL" />
              <div style={{ marginTop:8 }}>
                <ImageUpload businessId={business?.business_id} label="⬆ Upload logo" onUploaded={url => setF(s => ({ ...s, logoUrl: url }))} />
              </div>
            </div>
          </div>
        </DCard>

        <DCard hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:6 }}>Photos (storefront, goods, menus)</Mono>
          <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:12, lineHeight:1.5 }}>Upload photos from your device, or paste image links (up to 8). Menus and price lists go here as pictures.</p>
          <ImageUpload businessId={business?.business_id} multiple
            onUploaded={url => setImages(arr => arr.length >= 8 ? (toast('Up to 8 images', 'error'), arr) : [...arr, url])} />
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input value={imgInput} onChange={e=>setImgInput(e.target.value)} placeholder="…or paste https://…/photo.jpg" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addImage()}}}
              style={{ flex:1, padding:'9px 13px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', fontSize:'.9rem' }} />
            <Btn variant="secondary" size="sm" onClick={addImage}>Add</Btn>
          </div>
          {images.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {images.map((url,i) => (
                <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:8, overflow:'hidden', background:'var(--bg-elevated)' }}>
                  <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={() => setImages(arr => arr.filter((_,j)=>j!==i))}
                    style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:'.7rem', cursor:'pointer', lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </DCard>

        <DCard hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Internal (not shown to customers)</Mono>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <SelectField label="Status" value={f.status} onChange={set('status')}>
              <option value="pending">Pending (hidden)</option>
              <option value="active">Active (visible in Local)</option>
              <option value="expired">Expired (hidden)</option>
            </SelectField>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:140 }}><Input label="Fee paid (R)" value={f.feePaid} onChange={set('feePaid')} type="number" /></div>
              <div style={{ flex:1, minWidth:140 }}><Input label="Signed by (rep)" value={f.signedByRep} onChange={set('signedByRep')} /></div>
            </div>
            <Textarea label="Internal notes" value={f.notes} onChange={set('notes')} />
          </div>
        </DCard>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <Btn loading={saving} onClick={save}>{isNew ? 'Add business' : 'Save changes'}</Btn>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          {!isNew && <Btn variant="danger" onClick={remove} style={{ marginLeft:'auto' }}>Delete</Btn>}
        </div>
      </div>
    </div>
  )
}

// Trust/verification badge definitions — rendered on public profiles
const BADGE_DEFS = {
  ru_student:    { icon:'🎓', label:'Verified student', color:'var(--accent)', desc:'Verified SA university email' },
  email_verified:{ icon:'✓',  label:'Verified',        color:'var(--success)', desc:'Email verified via Google' },
  google_linked: { icon:'🔗', label:'Google-linked',   color:'var(--info)', desc:'Signed in with Google' },
  top_rated:     { icon:'⭐', label:'Top rated',        color:'var(--warning)', desc:'4.5+ stars across 5+ reviews' },
  established:   { icon:'🏅', label:'Established',      color:'var(--warning)', desc:'10+ tasks completed' },
}

function Badge2({ id }) {
  const def = BADGE_DEFS[id]
  if (!def) return null
  return (
    <span title={def.desc} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:100, background:'var(--bg-elevated)', border:`1px solid ${def.color}33`, fontSize:'.74rem', fontWeight:600, color:def.color, whiteSpace:'nowrap' }}>
      <span>{def.icon}</span>{def.label}
    </span>
  )
}

// Universal search results — people, businesses, and tasks for one query.
function SearchResults({ query, setPage, setSelectedTask, openProfile }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!query) { setData({ users: [], businesses: [], tasks: [] }); setLoading(false); return }
    let cancelled = false
    setLoading(true); setError(null)
    // Send the token: /search is gated pre-launch, so an anonymous request 503s
    // even for app-accessible users. At launch it works with or without one.
    const tok = localStorage.getItem('rl_token')
    fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
      .then(r => { if (!r.ok) throw new Error('Search failed'); return r.json() })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [query])

  const { users = [], businesses = [], tasks = [] } = data || {}
  const total = users.length + businesses.length + tasks.length

  const initialsOf = name => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const avatar = (url, name) => url
    ? <img src={url} alt="" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
    : <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.85rem', color:'var(--accent)', flexShrink:0 }}>{initialsOf(name)}</div>

  return (
    <>
      <PageTitle sub={query ? `Results for “${query}”` : 'Type in the search bar above'}>Search</PageTitle>

      {loading && <div style={{ padding:48, textAlign:'center' }}><Spinner /></div>}
      {!loading && error && <EmptyState icon="clock" message={error} />}
      {!loading && !error && total === 0 && (
        <EmptyState icon="inbox" message={query ? `No people, businesses, or tasks match “${query}”.` : 'Search for people, businesses, or tasks.'} />
      )}

      {!loading && !error && total > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
          {users.length > 0 && (
            <section>
              <Mono style={{ display:'block', marginBottom:12 }}>People · {users.length}</Mono>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {users.map(u => (
                  <DCard key={u.user_id} onClick={() => openProfile(u.user_id)}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', cursor:'pointer' }}>
                    {avatar(u.avatar_url, u.display_name)}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'.92rem' }}>{u.display_name || 'ReLivR member'}</div>
                      <div style={{ fontSize:'.78rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {u.headline || u.campus_zone || 'Member'}
                      </div>
                    </div>
                    {u.rating_count > 0 && <Mono>★ {Number(u.avg_rating).toFixed(1)}</Mono>}
                  </DCard>
                ))}
              </div>
            </section>
          )}

          {businesses.length > 0 && (
            <section>
              <Mono style={{ display:'block', marginBottom:12 }}>Businesses · {businesses.length}</Mono>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {businesses.map(b => (
                  <DCard key={b.business_id} onClick={() => setPage('local-browse')}
                    style={{ padding:'12px 16px', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
                      <span style={{ fontWeight:600, fontSize:'.92rem' }}>{b.name}</span>
                      {b.category && <Tag>{b.category}</Tag>}
                    </div>
                    {b.description && <div style={{ fontSize:'.8rem', color:'var(--text-secondary)', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.description}</div>}
                  </DCard>
                ))}
              </div>
            </section>
          )}

          {tasks.length > 0 && (
            <section>
              <Mono style={{ display:'block', marginBottom:12 }}>Tasks · {tasks.length}</Mono>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {tasks.map(t => (
                  <DCard key={t.task_id} onClick={() => { setSelectedTask(t.task_id); setPage('task-detail') }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 16px', cursor:'pointer' }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'.92rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                      {t.creator_name && <div style={{ fontSize:'.76rem', color:'var(--text-muted)' }}>by {t.creator_name}</div>}
                    </div>
                    <Mono style={{ flexShrink:0 }}>R{t.budget}</Mono>
                  </DCard>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function PublicProfile({ userId, setPage, openChat, openProfile }) {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tab, setTab]         = useState('completed')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    // Gated pre-launch — send the token so app-accessible users can view profiles.
    const tok = localStorage.getItem('rl_token')
    fetch(`${API_BASE}/profile/public/${userId}`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
      .then(r => { if (!r.ok) throw new Error('Could not load profile'); return r.json() })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); setTab((d.completed?.length ? 'completed' : 'reviews')) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [userId])

  if (loading) return <div style={{ padding:60, textAlign:'center' }}><Spinner /></div>
  if (error || !data) return <EmptyState icon="clock" message={error || 'Profile not found'} action={<Btn onClick={() => setPage('tasks-browse')}>← Back to Browse</Btn>} />

  const { profile, counts, stats = {}, badges = [], posted, completed, reviews } = data
  const name = profile.display_name || 'ReLivR member'
  const avatar = profile.avatar_url || profile.google_avatar_url
  const isMe = user && user.userId === userId
  const joined = profile.joined_at ? new Date(profile.joined_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : null
  const skills = Array.isArray(profile.skills) ? profile.skills : []
  const pinnedIds = Array.isArray(profile.pinned_task_ids) ? profile.pinned_task_ids : []
  const pinned = completed.filter(t => pinnedIds.includes(t.task_id))
  const featuredReview = reviews.find(r => r.review_id === profile.featured_review_id)

  function share() {
    const url = `${window.location.origin}/u/${userId}`
    if (navigator.share) { navigator.share({ title:`${name} on ReLivR`, url }).catch(()=>{}) }
    else { navigator.clipboard?.writeText(url); toast('Profile link copied!', 'success') }
  }

  const tabs = [
    { id:'completed', label:`Completed (${counts?.tasks_completed ?? 0})` },
    { id:'posted',    label:`Posted (${counts?.tasks_posted ?? 0})` },
    { id:'reviews',   label:`Reviews (${profile.rating_count ?? 0})` },
  ]
  const list = tab==='completed' ? completed : tab==='posted' ? posted : reviews

  return (
    <div className="page-enter" style={{ maxWidth:840 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <BackButton onClick={() => { if (window.history.length>1) window.history.back(); else setPage('tasks-browse') }} style={{ marginBottom:0 }} />
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" size="sm" onClick={share}><Icon name="link" size={14} /> Share</Btn>
          {isMe && <Btn variant="secondary" size="sm" onClick={() => setPage('profile')}>Edit profile</Btn>}
        </div>
      </div>

      {/* ── Hero ── */}
      <DCard hover={false} style={{ marginBottom:18, overflow:'hidden', padding:0 }}>
        <div style={{ height:88, background:'linear-gradient(120deg, var(--accent-dim), var(--bg-elevated))' }} />
        <div style={{ padding:'0 24px 22px', marginTop:-44 }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width:96, height:96, borderRadius:'50%', objectFit:'cover', border:'4px solid var(--bg-surface)', boxShadow:'0 2px 10px rgba(19,17,24,.12)' }} />
            : <div style={{ width:96, height:96, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'2.3rem', color:'#fff', border:'4px solid var(--bg-surface)', boxShadow:'0 2px 10px rgba(19,17,24,.12)' }}>{name.charAt(0).toUpperCase()}</div>}
          <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:12, flexWrap:'wrap' }}>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.7rem', lineHeight:1.1 }}>{name}</h1>
            {profile.beta_founder && (
              <span title="Joined during the ReLivR beta" style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(126,34,206,.1)', border:'1px solid rgba(126,34,206,.3)', color:'var(--amber)', borderRadius:100, padding:'3px 11px', fontFamily:'var(--font-mono)', fontSize:'.6rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em' }}>★ Founding Member</span>
            )}
          </div>
          {profile.headline && <p style={{ color:'var(--text-secondary)', fontSize:'1rem', marginTop:4, marginBottom:0 }}>{profile.headline}</p>}

          {/* badges */}
          {badges.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:12 }}>
              {badges.map(bid => <Badge2 key={bid} id={bid} />)}
            </div>
          )}

          {/* rating + meta */}
          <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap', marginTop:12 }}>
            {profile.rating_count > 0 ? (
              <span style={{ display:'flex', gap:6, alignItems:'center' }}>
                <Stars value={Math.round(profile.avg_rating)} />
                <Mono>{Number(profile.avg_rating).toFixed(1)} · {profile.rating_count} review{profile.rating_count!==1?'s':''}</Mono>
              </span>
            ) : <Mono>No reviews yet</Mono>}
            {profile.campus_zone && <Mono>📍 {profile.campus_zone}</Mono>}
            {joined && <Mono>Joined {joined}</Mono>}
          </div>

          {profile.portfolio_url && (
            <div style={{ marginTop:10 }}>
              <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer nofollow"
                style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--accent)', fontWeight:600, fontSize:'.88rem', textDecoration:'none' }}>
                🔗 {(() => { try { return new URL(profile.portfolio_url).hostname.replace('www.',''); } catch { return 'View portfolio'; } })()} ↗
              </a>
            </div>
          )}

          {!isMe && (
            <div style={{ marginTop:16, display:'flex', gap:10, flexWrap:'wrap' }}>
              <Btn onClick={() => openChat(userId, name)}>💬 Message {name.split(' ')[0]}</Btn>
              <FollowButton targetType="user" targetId={userId} showFavourite />
            </div>
          )}
          {!isMe && <BookingPanel hostType="user" hostId={userId} hostName={name.split(' ')[0]} />}
          {!isMe && <RetainerSetup providerId={userId} providerName={name.split(' ')[0]} />}
        </div>
      </DCard>

      {/* ── Trust stats row ── */}
      <div style={{ display:'flex', gap:14, marginBottom:18, flexWrap:'wrap' }}>
        <StatCard label="Tasks Completed" value={counts?.tasks_completed ?? 0} accent />
        {stats.completion_rate != null && <StatCard label="Completion Rate" value={`${stats.completion_rate}%`} />}
        {stats.response_rate != null && <StatCard label="Response Rate" value={`${stats.response_rate}%`} />}
        <StatCard label="Avg Rating" value={profile.rating_count>0 ? Number(profile.avg_rating).toFixed(1) : '—'} />
      </div>

      {/* ── Services offered (advertising) ── */}
      {profile.services_offered && (
        <DCard hover={false} style={{ marginBottom:18, borderLeft:'3px solid var(--accent)' }}>
          <Mono size="0.62rem" style={{ display:'block', marginBottom:8, color:'var(--accent)' }}>SERVICES OFFERED</Mono>
          <p style={{ color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{profile.services_offered}</p>
        </DCard>
      )}

      {/* ── Bio + skills ── */}
      {(profile.bio || skills.length>0) && (
        <DCard hover={false} style={{ marginBottom:18 }}>
          {profile.bio && <p style={{ color:'var(--text-secondary)', lineHeight:1.7, marginBottom: skills.length?14:0 }}>{profile.bio}</p>}
          {skills.length>0 && <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>{skills.map(s => <Tag key={s}>{s}</Tag>)}</div>}
        </DCard>
      )}

      {/* ── Featured review (advertising) ── */}
      {featuredReview && (
        <DCard hover={false} style={{ marginBottom:18, background:'var(--accent-glow)', border:'1px solid var(--accent-dim)' }}>
          <Mono size="0.62rem" style={{ display:'block', marginBottom:8, color:'var(--accent)' }}>⭐ FEATURED REVIEW</Mono>
          <p style={{ fontSize:'1.02rem', fontStyle:'italic', lineHeight:1.6, marginBottom:8 }}>"{featuredReview.comment}"</p>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Mono>— {featuredReview.reviewer_name}, {featuredReview.task_title}</Mono>
            <Stars value={featuredReview.rating} />
          </div>
        </DCard>
      )}

      {/* ── Pinned / featured work (advertising) ── */}
      {pinned.length>0 && (
        <div style={{ marginBottom:22 }}>
          <Mono size="0.62rem" style={{ display:'block', marginBottom:10, color:'var(--accent)' }}>📌 FEATURED WORK</Mono>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {pinned.map(t => (
              <DCard key={t.task_id} hover={false} style={{ borderTop:'3px solid var(--accent)' }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:700, marginBottom:6 }}>{t.title}</div>
                {Array.isArray(t.skill_tags) && t.skill_tags.length>0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>{t.skill_tags.slice(0,3).map(s => <Tag key={s}>{s}</Tag>)}</div>
                )}
                <Mono>Completed · R{t.budget}</Mono>
              </DCard>
            ))}
          </div>
        </div>
      )}

      {/* ── History tabs ── */}
      <div className="feed-scroll" style={{ display:'flex', gap:2, marginBottom:18, background:'var(--bg-elevated)', borderRadius:12, padding:3, overflowX:'auto', maxWidth:'fit-content' }}>
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', border:'none', whiteSpace:'nowrap', background:tab===tb.id?'var(--bg-surface)':'transparent', color:tab===tb.id?'var(--accent)':'var(--text-muted)', boxShadow:tab===tb.id?'0 1px 3px rgba(19,17,24,.14)':'none' }}>{tb.label}</button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {tab==='reviews' && list.map((r,i) => (
          <DCard key={i} hover={false}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontWeight:600, fontSize:'0.9rem' }}>{r.reviewer_name || 'Member'}</span>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p style={{ fontSize:'0.86rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:6 }}>{r.comment}</p>}
            <Mono>{r.task_title} · {new Date(r.created_at).toLocaleDateString()}</Mono>
          </DCard>
        ))}

        {tab!=='reviews' && list.map(t => (
          <DCard key={t.task_id} hover={false} style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 18px' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                {tab==='posted' && <Badge variant={taskState(t).variant}>{taskState(t).label}</Badge>}
                {tab==='completed' && <Badge variant="completed">completed</Badge>}
                <span style={{ fontFamily:'var(--font-display)', fontWeight:600 }}>{t.title}</span>
              </div>
              {Array.isArray(t.skill_tags) && t.skill_tags.length>0 && (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{t.skill_tags.slice(0,4).map(s => <Tag key={s}>{s}</Tag>)}</div>
              )}
            </div>
            <div style={{ fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:600, flexShrink:0 }}>R{t.budget}</div>
          </DCard>
        ))}

        {list.length===0 && (
          <EmptyState icon="inbox" message={tab==='completed' ? 'No completed tasks yet' : tab==='posted' ? 'No tasks posted yet' : 'No reviews yet'} />
        )}
      </div>
    </div>
  )
}

// Batch 4: providers set their availability here — a master "available for work"
// toggle plus optional weekly working hours (SAST). Both feed the Available-Now
// rail: the toggle is the opt-in, working hours make you "open now" off-heartbeat.
const WEEKDAYS = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']]
function AvailabilityCard() {
  const toast = useToast()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [available, setAvailable] = useState(false)
  const [days, setDays]         = useState(() => new Set())
  const [start, setStart]       = useState('09:00')
  const [end, setEnd]           = useState('17:00')
  const token = () => localStorage.getItem('rl_token')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(API_BASE + '/availability/me', { headers: { Authorization: `Bearer ${token()}` } })
        if (!res.ok) throw new Error('not ok')
        const d = await res.json()
        if (cancelled) return
        setAvailable(!!d.availableForWork)
        if (d.workingHours) {
          setDays(new Set(d.workingHours.days || []))
          if (d.workingHours.start) setStart(d.workingHours.start)
          if (d.workingHours.end) setEnd(d.workingHours.end)
        }
      } catch { /* keep defaults */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  function toggleDay(d) {
    setDays(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n })
  }

  async function save() {
    // Working hours are optional — a provider can be "available" on presence alone.
    let workingHours = null
    if (days.size > 0) {
      if (!(start < end)) { toast('Start time must be before end time', 'error'); return }
      workingHours = { days: [...days].sort((a,b)=>a-b), start, end }
    }
    setSaving(true)
    try {
      const res = await fetch(API_BASE + '/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ availableForWork: available, workingHours }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.errors?.[0]?.msg || data.message || 'Could not save')
      toast('Availability saved', 'success')
    } catch (err) {
      toast(err.message === 'Failed to fetch' ? 'Backend offline — not saved' : err.message, 'error')
    } finally { setSaving(false) }
  }

  return (
    <DCard hover={false}>
      <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:6 }}>Availability</Mono>
      <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:16, lineHeight:1.5 }}>
        Turn this on to appear in the <strong style={{ color:'var(--text-secondary)' }}>Available now</strong> rail when you're online or within your working hours. Off means you're never shown as available.
      </p>
      {loading ? <div style={{ padding:20, textAlign:'center' }}><Spinner /></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} style={{ width:18, height:18, accentColor:'var(--accent)', cursor:'pointer' }} />
            <span style={{ fontWeight:600, fontSize:'.9rem' }}>I'm available for work</span>
          </label>
          <div style={{ opacity: available ? 1 : 0.5, pointerEvents: available ? 'auto' : 'none', transition:'opacity 150ms ease' }}>
            <Mono size="0.68rem" style={{ display:'block', marginBottom:8 }}>Working hours (optional · SAST)</Mono>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {WEEKDAYS.map(([n, label]) => {
                const on = days.has(n)
                return (
                  <button key={n} type="button" onClick={() => toggleDay(n)}
                    style={{ padding:'6px 12px', borderRadius:100, fontSize:'.78rem', fontWeight:600, cursor:'pointer', border:`1px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'var(--bg-surface)', color:on?'#fff':'var(--text-secondary)' }}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                From
                <input type="time" value={start} onChange={e => setStart(e.target.value)}
                  style={{ padding:'8px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:'.9rem' }} />
              </label>
              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                To
                <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                  style={{ padding:'8px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:'.9rem' }} />
              </label>
            </div>
            <p style={{ fontSize:'.72rem', color:'var(--text-muted)', marginTop:10, lineHeight:1.5 }}>
              Pick no days to stay available on your online status alone.
            </p>
          </div>
          <Btn loading={saving} onClick={save} style={{ alignSelf:'flex-start' }}>Save availability</Btn>
        </div>
      )}
    </DCard>
  )
}

// Batch 6: students map + verify a university email to unlock student-only perks.
// Anyone can use ReLivR without this; it's purely the student-benefits gate.
function StudentVerifyCard() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState({ email: null, verified: false }) // from /auth/me
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => fetch(API_BASE + '/auth/me', { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
    .then(({ user }) => setState({ email: user?.student_email || null, verified: !!user?.student_verified }))
    .catch(() => {})
    .finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  async function sendLink() {
    const email = input.trim()
    if (!email) { toast('Enter your university email', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(API_BASE + '/auth/student-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ studentEmail: email }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.errors?.[0]?.msg || d.message || 'Could not send the link')
      toast(d.message || 'Verification link sent — check your inbox', 'success')
      setInput(''); load()
    } catch (e) { toast(e.message === 'Failed to fetch' ? 'Backend offline' : e.message, 'error') }
    finally { setBusy(false) }
  }

  async function unlink() {
    if (!window.confirm('Remove your student email? You’ll lose student-only perks until you verify again.')) return
    setBusy(true)
    try {
      const res = await fetch(API_BASE + '/auth/student-email', { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('Could not unlink')
      toast('Student email removed', 'success'); setState({ email: null, verified: false })
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <DCard hover={false}>
      <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 6 }}>Student verification</Mono>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Anyone can use ReLivR. If you’re at a South African university, verify your campus email to unlock <strong style={{ color: 'var(--text-secondary)' }}>student-only deals</strong>.
      </p>
      {loading ? <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>
        : state.verified ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '.9rem', color: 'var(--success)' }}>
              <span>✓</span> Verified student — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{state.email}</span>
            </span>
            <button onClick={unlink} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '.78rem', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Unlink</button>
          </div>
        ) : state.email ? (
          <div>
            <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Pending — we emailed a link to <strong>{state.email}</strong>. Click it to finish.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn size="sm" variant="secondary" loading={busy} onClick={() => { setInput(state.email); sendLink() }}>Resend link</Btn>
              <button onClick={unlink} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '.78rem', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Use a different email</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="University email" value={input} onChange={e => setInput(e.target.value)} placeholder="you@ru.ac.za" type="email" hint="We’ll email a link to confirm it’s yours." />
            <Btn loading={busy} onClick={sendLink} style={{ alignSelf: 'flex-start' }}>Send verification link</Btn>
          </div>
        )}
    </DCard>
  )
}

function Profile({ openProfile }) {
  const { user, logout, updateUser } = useAuth()
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInputRef = useRef(null)
  const profileToken = () => localStorage.getItem('rl_token')

  // Personal profile photo: browser → Cloudinary (signed, scope 'avatar') → save
  // the URL via PATCH /profile → reflect on the user everywhere via updateUser.
  async function handleAvatarFile(fileList) {
    const file = Array.from(fileList || [])[0]
    if (!file || avatarBusy) return
    if (!UPLOAD_OK_TYPES.includes(file.type)) { toast('Use a JPG, PNG, WebP or GIF image', 'error'); return }
    if (file.size > UPLOAD_MAX_BYTES) { toast('Image must be under 10 MB', 'error'); return }
    setAvatarBusy(true)
    try {
      const sig = await fetchUploadSignature(null, 'avatar')
      const url = await postToCloudinary(file, sig)
      const res = await fetch(API_BASE + '/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profileToken()}` },
        body: JSON.stringify({ avatarUrl: url }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Could not save your photo')
      updateUser({ avatarUrl: url })
      toast('Profile photo updated', 'success')
    } catch (e) {
      toast(e.message || 'Upload failed', 'error')
    } finally {
      setAvatarBusy(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }
  async function removeAvatar() {
    if (avatarBusy) return
    setAvatarBusy(true)
    try {
      const res = await fetch(API_BASE + '/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${profileToken()}` },
        body: JSON.stringify({ avatarUrl: '' }),
      })
      if (!res.ok) throw new Error()
      updateUser({ avatarUrl: null })
      toast('Profile photo removed', 'success')
    } catch { toast('Could not remove photo', 'error') } finally { setAvatarBusy(false) }
  }
  const { state } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('profile')
  const [displayName, setName]  = useState(user.displayName || user.email?.split('@')[0] || '')
  const [bio, setBio]           = useState('')
  const [skills, setSkills]     = useState('')
  const [portfolio, setPort]    = useState('')
  const [headline, setHeadline] = useState('')
  const [services, setServices] = useState('')
  const [email, setEmail]       = useState(user.email || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [savingPw, setSavingPw]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const [emailFrequency, setEmailFrequency] = useState('instant')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deletePw, setDeletePw]   = useState('')
  const [deleting, setDeleting]   = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  // Push: loading | unsupported | default | denied | on | busy. The service
  // worker is registered in production only, so dev/unsupported browsers show N/A.
  const [pushStatus, setPushStatus] = useState('loading')
  const myReviews = state.reviews.filter(r=>r.reviewee_id==='u1'||r.reviewer_id==='u1')
  const avgRating = myReviews.length?(myReviews.reduce((s,r)=>s+r.rating,0)/myReviews.length).toFixed(1):null

  const token = () => localStorage.getItem('rl_token')

  // ── Load saved profile from backend on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(API_BASE + '/profile', { headers: { Authorization: `Bearer ${token()}` } })
        if (!res.ok) throw new Error('not ok')
        const { profile } = await res.json()
        if (cancelled || !profile) return
        setName(profile.display_name || user.displayName || '')
        setBio(profile.bio || '')
        setSkills(Array.isArray(profile.skills) ? profile.skills.join(', ') : (profile.skills || ''))
        setPort(profile.portfolio_url || '')
        setHeadline(profile.headline || '')
        setServices(profile.services_offered || '')
        setEmail(profile.email || user.email || '')
        setEmailFrequency(profile.email_frequency || 'instant')
      } catch {
        // Backend unreachable — keep whatever we have from context (demo mode)
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detect current push-notification state on mount ─────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !import.meta.env.PROD) {
      setPushStatus('unsupported'); return
    }
    let cancelled = false
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (cancelled) return
        setPushStatus(sub ? 'on' : (Notification.permission === 'denied' ? 'denied' : 'default'))
      } catch { if (!cancelled) setPushStatus('default') }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Save profile to backend ─────────────────────────────────────────────────
  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch(API_BASE + '/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          displayName,
          bio,
          skills,                       // server splits the comma string into an array
          portfolioUrl: portfolio,
          headline,
          servicesOffered: services,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // express-validator returns { errors: [{ msg, path }] } on 422
        const fieldMsg = data.errors?.[0]?.msg
        throw new Error(fieldMsg || data.message || 'Save failed')
      }
      toast('Profile saved', 'success')
    } catch (err) {
      toast(err.message === 'Failed to fetch' ? 'Backend offline — changes not saved' : err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Change password ─────────────────────────────────────────────────────────
  async function changePassword() {
    if (!currentPw) { toast('Enter your current password', 'error'); return }
    if (newPw.length < 8) { toast('New password must be at least 8 characters', 'error'); return }
    setSavingPw(true)
    try {
      const res = await fetch(API_BASE + '/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not change password')
      setCurrentPw(''); setNewPw('')
      toast('Password changed — please sign in again', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingPw(false)
    }
  }

  // ── Download my data (POPIA) ────────────────────────────────────────────────
  async function exportData() {
    setExporting(true)
    try {
      const res = await fetch(API_BASE + '/profile/export', { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('Could not export your data')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'relivr-data.json'; a.click()
      URL.revokeObjectURL(url)
      toast('Your data is downloading', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  // ── Email cadence (optimistic) ──────────────────────────────────────────────
  async function saveEmailFrequency(freq) {
    const prev = emailFrequency
    setEmailFrequency(freq)
    try {
      const res = await fetch(API_BASE + '/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ emailFrequency: freq }),
      })
      if (!res.ok) throw new Error()
      toast('Email preference saved', 'success')
    } catch {
      setEmailFrequency(prev)
      toast('Could not update email preference', 'error')
    }
  }

  // ── Sign out of all devices ─────────────────────────────────────────────────
  async function signOutAllDevices() {
    try {
      await fetch(API_BASE + '/auth/logout-all', { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
    } catch { /* revoked regardless; fall through to local logout */ }
    toast('Signed out of all devices', 'success')
    logout()
  }

  // ── Push notifications (H1) ─────────────────────────────────────────────────
  // Standard VAPID base64url → Uint8Array for applicationServerKey.
  function urlB64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
    const out = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
    return out
  }
  async function enablePush() {
    setPushStatus('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushStatus(perm === 'denied' ? 'denied' : 'default'); toast('Notifications not enabled', 'info'); return }
      const { publicKey, enabled } = await (await fetch(API_BASE + '/push/public-key')).json()
      if (!enabled || !publicKey) { setPushStatus('default'); toast('Push notifications aren’t set up yet', 'error'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) })
      const res = await fetch(API_BASE + '/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(sub.toJSON ? sub.toJSON() : sub),
      })
      if (!res.ok) throw new Error()
      setPushStatus('on'); toast('Push notifications enabled', 'success')
    } catch {
      setPushStatus('default'); toast('Could not enable notifications', 'error')
    }
  }
  async function disablePush() {
    setPushStatus('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch(API_BASE + '/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      setPushStatus('default'); toast('Push notifications turned off', 'success')
    } catch {
      setPushStatus('on'); toast('Could not turn off notifications', 'error')
    }
  }

  // ── Delete account (POPIA erasure) ──────────────────────────────────────────
  async function deleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch(API_BASE + '/profile/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ password: deletePw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not delete account')
      toast('Your account has been deleted', 'success')
      logout()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth:680 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <PageTitle sub="Manage your account settings">Profile</PageTitle>
        {avgRating&&<div style={{ textAlign:'center' }}><div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', color:'var(--accent)' }}>{avgRating}</div><Stars rating={parseFloat(avgRating)} /><Mono>{myReviews.length} reviews</Mono></div>}
      </div>
      {/* Trust header — gradient banner, overlapping avatar, key stats */}
      <DCard hover={false} style={{ padding:0, marginBottom:24, overflow:'hidden' }}>
        <div style={{ height:72, background:'linear-gradient(120deg, var(--accent), var(--amber2))' }} />
        <div style={{ display:'flex', alignItems:'flex-end', gap:16, flexWrap:'wrap', padding:'14px 22px 20px' }}>
          {/* Avatar = tap to upload a personal photo (browser → Cloudinary → PATCH /profile) */}
          <div style={{ position:'relative', flexShrink:0, marginTop:-50 }}>
            <button type="button" onClick={() => { if (!avatarBusy) avatarInputRef.current?.click() }} title="Change profile photo" aria-label="Change profile photo"
              style={{ padding:0, border:'none', background:'none', cursor:avatarBusy?'progress':'pointer', borderRadius:'50%', display:'block' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width:72, height:72, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--bg-surface)', boxShadow:'var(--shadow-sm)', display:'block' }} />
                : <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.6rem', color:'var(--accent)', border:'3px solid var(--bg-surface)', boxShadow:'var(--shadow-sm)' }}>{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</div>}
              <span aria-hidden="true" style={{ position:'absolute', right:-2, bottom:-2, width:26, height:26, borderRadius:'50%', background:'var(--accent)', color:'#fff', border:'2px solid var(--bg-surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', boxShadow:'var(--shadow-sm)' }}>{avatarBusy ? <Spinner size={11} /> : '⛭'}</span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={(e) => handleAvatarFile(e.target.files)} style={{ display:'none' }} />
          </div>
          <div style={{ minWidth:140, paddingBottom:4 }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', lineHeight:1.2, letterSpacing:'-0.01em' }}>{user.displayName || user.email?.split('@')[0]}</div>
            <Mono>{user.email}</Mono>
            <div style={{ marginTop:4, display:'flex', gap:12 }}>
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy} style={{ background:'none', border:'none', padding:0, color:'var(--accent)', fontSize:'0.72rem', fontFamily:'var(--font-mono)', cursor:'pointer' }}>{user.avatarUrl ? 'Change photo' : 'Add photo'}</button>
              {user.avatarUrl && <button type="button" onClick={removeAvatar} disabled={avatarBusy} style={{ background:'none', border:'none', padding:0, color:'var(--text-muted)', fontSize:'0.72rem', fontFamily:'var(--font-mono)', cursor:'pointer' }}>Remove</button>}
            </div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:0, paddingBottom:2 }}>
            <div style={{ textAlign:'center', padding:'0 22px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.35rem', color:'var(--warning)', lineHeight:1 }}>{avgRating || '—'}</div>
              <Mono style={{ marginTop:5 }}>rating</Mono>
            </div>
            <div style={{ textAlign:'center', padding:'0 22px', borderLeft:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.35rem', lineHeight:1 }}>{state.tasks.filter(t=>t.status==='completed').length}</div>
              <Mono style={{ marginTop:5 }}>completed</Mono>
            </div>
            <div style={{ textAlign:'center', padding:'0 22px', borderLeft:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.35rem', color:'var(--success)', lineHeight:1 }}>{user.provider==='google' ? '✓' : '—'}</div>
              <Mono style={{ marginTop:5 }}>verified</Mono>
            </div>
          </div>
        </div>
      </DCard>

      <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'1px solid var(--border)' }}>
        {['profile','security','reviews'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'10px 20px', background:'none', border:'none', borderBottom:tab===t?'2px solid var(--accent)':'2px solid transparent', color:tab===t?'var(--accent)':'var(--text-secondary)', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.85rem', textTransform:'uppercase', letterSpacing:'0.05em', cursor:'pointer', transition:'all 150ms ease', marginBottom:-1 }}>
            {t}
          </button>
        ))}
      </div>
      {tab==='profile'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Account Info</Mono>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Input label="Display Name" value={displayName} onChange={e=>setName(e.target.value)} />
              <Input label="Email" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
              <div><Badge variant={user.role}>{user.role}</Badge></div>
            </div>
          </DCard>
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:6 }}>Showcase &amp; advertising</Mono>
            <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:16, lineHeight:1.5 }}>This is what customers see on your public profile. A strong headline and services section help you win more work.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Input label="Headline" value={headline} onChange={e=>setHeadline(e.target.value)} hint="One line, e.g. “First-year Stats tutor & freelance designer”" />
              <Textarea label="Services offered" value={services} onChange={e=>setServices(e.target.value)} style={{ minHeight:90 }} hint="What can people hire you for? Rates, availability, specialities." />
            </div>
          </DCard>
          <AvailabilityCard />
          <StudentVerifyCard />
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Professional Profile</Mono>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Textarea label="Bio" value={bio} onChange={e=>setBio(e.target.value)} style={{ minHeight:80 }} />
              <Input label="Skills (comma separated)" value={skills} onChange={e=>setSkills(e.target.value)} hint="Shown as tags on your profile" />
              <Input label="Portfolio or website" value={portfolio} onChange={e=>setPort(e.target.value)} placeholder="behance.net/you, github.com/you, linktr.ee/you…" hint="Any link to your work — we'll check it's a valid address." />
            </div>
          </DCard>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <Btn loading={saving} onClick={saveProfile}>Save Changes</Btn>
            <Btn variant="secondary" onClick={() => openProfile(user.userId)}>View public profile →</Btn>
          </div>
        </div>
      )}
      {tab==='security'&&user.provider==='google'&&(
        <DCard hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:12 }}>Password</Mono>
          <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
            You signed in with Google, so there's no password to manage here. Your account security is handled by your Google account.
          </p>
        </DCard>
      )}
      {tab==='security'&&user.provider!=='google'&&(
        <DCard hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Change Password</Mono>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Current Password" type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} />
            <Input label="New Password" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} hint="Minimum 8 characters" />
            <Btn loading={savingPw} onClick={changePassword} style={{ alignSelf:'flex-start' }}>Update Password</Btn>
          </div>
        </DCard>
      )}
      {tab==='security'&&(
        <DCard hover={false} style={{ marginTop:16 }}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Your Data & Account</Mono>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)', maxWidth:380 }}>
              Activity emails (new bids, messages, reviews, disputes). Security emails always send.
            </div>
            <select value={emailFrequency} onChange={e => saveEmailFrequency(e.target.value)} style={{ width:'auto', minWidth:150 }}>
              <option value="instant">Email me instantly</option>
              <option value="daily">Daily digest</option>
              <option value="off">Don't email me</option>
            </select>
          </div>

          <Divider style={{ margin:'18px 0' }} />

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)', maxWidth:380 }}>
              Push notifications — get alerts on this device even when ReLivR isn’t open.
              {pushStatus==='denied' && <span style={{ display:'block', color:'var(--danger)', marginTop:4 }}>Blocked in your browser. Allow notifications for this site, then try again.</span>}
              {pushStatus==='unsupported' && <span style={{ display:'block', color:'var(--text-muted)', marginTop:4 }}>Install the app or use a supported browser to enable these.</span>}
            </div>
            {pushStatus==='on'
              ? <Btn variant="secondary" size="sm" onClick={disablePush}>Turn off</Btn>
              : (pushStatus==='unsupported' || pushStatus==='denied')
                ? <Mono style={{ opacity:0.7 }}>{pushStatus==='denied' ? 'Blocked' : 'N/A'}</Mono>
                : <Btn variant="secondary" size="sm" loading={pushStatus==='busy' || pushStatus==='loading'} onClick={enablePush}>Enable</Btn>}
          </div>

          <Divider style={{ margin:'18px 0' }} />

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>Download a copy of your ReLivR data.</div>
            <Btn variant="secondary" size="sm" loading={exporting} onClick={exportData}>Download my data</Btn>
          </div>

          <Divider style={{ margin:'18px 0' }} />

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>Signed in elsewhere? Sign out everywhere.</div>
            <Btn variant="secondary" size="sm" onClick={signOutAllDevices}>Sign out of all devices</Btn>
          </div>

          <Divider style={{ margin:'18px 0' }} />

          <Mono size="0.68rem" color="var(--danger)" style={{ display:'block', marginBottom:8 }}>Danger Zone</Mono>
          <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:12 }}>
            Deleting your account removes your personal information and signs you out everywhere. This can't be undone.
          </p>
          {!confirmingDelete ? (
            <Btn variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>Delete account</Btn>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:320 }}>
              {user.provider!=='google' && (
                <Input label="Confirm your password" type="password" value={deletePw} onChange={e=>setDeletePw(e.target.value)} />
              )}
              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="danger" size="sm" loading={deleting} onClick={deleteAccount}>Yes, delete my account</Btn>
                <Btn variant="ghost" size="sm" onClick={() => { setConfirmingDelete(false); setDeletePw('') }}>Cancel</Btn>
              </div>
            </div>
          )}
        </DCard>
      )}
      {tab==='reviews'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {myReviews.length===0&&<EmptyState icon="star" message="No reviews yet — complete a task to receive your first review" />}
          {myReviews.map(r => (
            <DCard key={r.review_id} hover={false}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <Stars rating={r.rating} /><Mono>{new Date(r.created_at).toLocaleDateString()}</Mono>
              </div>
              {r.comment&&<p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{r.comment}</p>}
              <Mono style={{ display:'block', marginTop:8 }}>Task #{r.task_id}</Mono>
            </DCard>
          ))}
        </div>
      )}
    </div>
  )
}

// Admin monitoring overview — real platform stats + recent activity (§7.8).
// Tiny dependency-free SVG bar chart for an admin time-series.
function MiniChart({ data, dataKey, label, color='var(--accent)' }) {
  const w = 520, h = 90, pad = 4
  const vals = data.map(d => d[dataKey] || 0)
  const max = Math.max(1, ...vals)
  const n = data.length || 1
  const bw = (w - pad * 2) / n
  const total = vals.reduce((s, v) => s + v, 0)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <Mono>{label}</Mono><Mono color="var(--text-secondary)">{total} total</Mono>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${label}: ${total} over the period`} style={{ display:'block' }}>
        {data.map((d, i) => {
          const bh = Math.round((d[dataKey] || 0) / max * (h - pad * 2))
          return <rect key={i} x={pad + i * bw + 0.5} y={h - pad - bh} width={Math.max(1, bw - 1.5)} height={bh} rx="1" fill={color} opacity={0.85}>
            <title>{`${d.day}: ${d[dataKey] || 0}`}</title>
          </rect>
        })}
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS DASHBOARD — self-contained surface for role='business' users
// ═══════════════════════════════════════════════════════════════════════════════

const bizTaStyle = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'.9rem', fontFamily:'var(--font-body)', resize:'vertical', boxSizing:'border-box' }
const bizGhostBtn = { padding:'7px 12px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'.82rem', fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer' }
const bizTab = (active) => ({ padding:'10px 16px', border:'none', borderBottom:`2px solid ${active?'var(--accent)':'transparent'}`, borderTopLeftRadius:8, borderTopRightRadius:8, background:active?'var(--accent-glow)':'transparent', color:active?'var(--accent)':'var(--text-secondary)', fontSize:'.9rem', fontWeight:700, fontFamily:'var(--font-body)', cursor:'pointer', transition:'background 140ms var(--ease), color 140ms var(--ease)' })

function BusinessDashboard({ onLogout, onViewLanding, theme, onToggleTheme }) {
  const { user } = useAuth()
  const token = () => localStorage.getItem('rl_token')
  const [tab, setTab]         = useState('page')   // 'page' | 'analytics'
  const [biz, setBiz]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState(null)     // null | 'notlinked' | 'error'
  const [tick, setTick]       = useState(0)        // bump to retry the load

  useEffect(() => {
    let cancelled = false
    setLoading(true); setStatus(null)
    let attempt = 0
    const run = () => {
      fetch(API_BASE + '/businesses/mine', { headers:{ Authorization:`Bearer ${token()}` } })
        .then(async r => {
          if (cancelled) return
          // 404 = genuinely no business linked (don't retry that).
          if (r.status === 404) { setStatus('notlinked'); setLoading(false); return }
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error('transient')
          setBiz(d.business); setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          // Transient failure (e.g. a cold backend) — auto-retry twice before
          // surfacing the error card, so a slow first request self-heals.
          if (attempt < 2) { attempt += 1; setTimeout(run, 700); return }
          setStatus('error'); setLoading(false)
        })
    }
    run()
    return () => { cancelled = true }
  }, [tick])

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', color:'var(--text-primary)', display:'flex', flexDirection:'column' }}>
      <header style={{ position:'sticky', top:0, zIndex:90, background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', gap:14, minHeight:60, padding:'0 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <LogoMark size={28} />
            <span style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700 }}>ReLivR <span style={{ color:'var(--text-muted)', fontWeight:500 }}>· Business</span></span>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--text-muted)' }}>{biz?.name || user?.email}</span>
            {biz?.follower_count > 0 && <span style={{ fontFamily:'var(--font-mono)', fontSize:'.68rem', fontWeight:600, color:'var(--accent)', background:'var(--accent-glow)', borderRadius:999, padding:'3px 10px', whiteSpace:'nowrap' }}>♡ {biz.follower_count} follower{biz.follower_count===1?'':'s'}</span>}
            {onToggleTheme && <button onClick={onToggleTheme} style={bizGhostBtn} aria-label="Toggle dark mode"><Icon name={theme==='dark'?'sun':'moon'} size={15} /></button>}
            {onViewLanding && <button onClick={onViewLanding} style={bizGhostBtn}>Public site</button>}
            <button onClick={onLogout} style={{ ...bizGhostBtn, color:'var(--danger)' }}>Sign out</button>
          </div>
        </div>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', gap:4, padding:'0 20px' }}>
          <button onClick={() => setTab('page')}      style={bizTab(tab==='page')}>My Page</button>
          <button onClick={() => setTab('catalog')}   style={bizTab(tab==='catalog')}>Catalog</button>
          <button onClick={() => setTab('orders')}    style={bizTab(tab==='orders')}>Orders</button>
          <button onClick={() => setTab('deals')}     style={bizTab(tab==='deals')}>Deals</button>
          <button onClick={() => setTab('bookings')}  style={bizTab(tab==='bookings')}>Bookings</button>
          <button onClick={() => setTab('clients')}   style={bizTab(tab==='clients')}>Clients</button>
          <button onClick={() => setTab('analytics')} style={bizTab(tab==='analytics')}>Analytics</button>
        </div>
      </header>

      <main style={{ flex:1, width:'100%', maxWidth:1100, margin:'0 auto', padding:'28px 20px 60px' }}>
        {loading ? <div style={{ padding:60, textAlign:'center' }}><Spinner /></div>
         : status === 'error' ? (
          <DCard hover={false} style={{ padding:'40px 24px', textAlign:'center', maxWidth:520, margin:'40px auto' }}>
            <div style={{ fontSize:'2rem', marginBottom:10 }}>⚠️</div>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.2rem', marginBottom:8 }}>Couldn’t load your dashboard</h2>
            <p style={{ color:'var(--text-secondary)', fontSize:'.9rem', lineHeight:1.6, marginBottom:16 }}>Something went wrong reaching the server. Please try again.</p>
            <Btn onClick={() => setTick(t => t + 1)}>Retry</Btn>
          </DCard>
        )
         : status === 'notlinked' ? (
          <DCard hover={false} style={{ padding:'40px 24px', textAlign:'center', maxWidth:520, margin:'40px auto' }}>
            <div style={{ fontSize:'2rem', marginBottom:10 }}>◇</div>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.2rem', marginBottom:8 }}>No business linked yet</h2>
            <p style={{ color:'var(--text-secondary)', fontSize:'.9rem', lineHeight:1.6 }}>
              Your account isn’t linked to a business listing yet. The ReLivR team links your
              listing once your founding-partner onboarding (R750) is set up. Reach out and
              we’ll connect it to <Mono>{user?.email}</Mono>.
            </p>
          </DCard>
        )
         : tab === 'page' ? <BusinessPageEditor biz={biz} onSaved={setBiz} />
         : tab === 'catalog' ? <BusinessCatalog biz={biz} />
         : tab === 'orders' ? <BusinessOrders />
         : tab === 'deals' ? <BusinessDeals biz={biz} />
         : tab === 'bookings' ? <AvailabilityManager hostType="business" />
         : tab === 'clients' ? <BusinessClients />
         : <BusinessAnalytics />}
      </main>
    </div>
  )
}

function BusinessPreviewCard({ b }) {
  const theme = b.theme_color || 'var(--accent)'
  return (
    <DCard hover={false} style={{ padding:0, overflow:'hidden', border:`1px solid var(--border)` }}>
      <div style={{ height:10, background:theme }} />
      {/* Mirror the public detail page: show the cover AND the gallery (cover does
          not replace/hide the gallery — that previously read as "deleting" images). */}
      {b.cover_image_url && <img src={b.cover_image_url} alt="" style={{ width:'100%', height:120, objectFit:'cover', display:'block' }} />}
      {b.image_urls?.length > 0 && <BizGallery images={b.image_urls} height={b.cover_image_url ? 96 : 120} />}
      {!b.cover_image_url && !(b.image_urls?.length) && <div style={{ height:60 }} />}
      <div style={{ padding:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
          {b.logo_url && <img src={b.logo_url} alt="" style={{ width:40, height:40, borderRadius:9, objectFit:'cover' }} />}
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.15rem', margin:0 }}>{b.name || 'Your business name'}</h3>
        </div>
        {b.tagline && <p style={{ color:theme, fontWeight:600, fontSize:'.9rem', margin:'0 0 6px' }}>{b.tagline}</p>}
        {b.category && <span style={{ display:'inline-block', fontSize:'.72rem', fontWeight:700, color:theme, background:'var(--bg-elevated)', border:`1px solid ${theme}`, borderRadius:100, padding:'2px 10px' }}>{b.category}</span>}
        {b.description && <p style={{ color:'var(--text-secondary)', fontSize:'.86rem', lineHeight:1.6, marginTop:10 }}>{b.description}</p>}
        {b.hours && <Mono style={{ display:'block', marginTop:10 }}>🕒 {b.hours}</Mono>}
      </div>
    </DCard>
  )
}

// ─── CAMPUS DEALS ──────────────────────────────────────────────────────────────
// Business-posted limited-time specials. Expiry is authoritative on the server
// (the API only returns deals where expires_at > NOW()); the countdown here is
// display-only.
const zar = (cents) => cents == null ? '' : 'R' + (cents / 100).toFixed(2).replace(/\.00$/, '')
function dealTimeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `Ends in ${d}d ${h}h`
  if (h > 0) return `Ends in ${h}h ${m}m`
  return `Ends in ${m}m`
}
// A datetime-local input speaks browser-local time; convert to/from ISO for the API.
const isoToLocalInput = (iso) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
const daysFromNowLocal = (days) => new Date(Date.now() + days * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

// One deal as customers see it (public grid + live preview in the editor).
function DealCard({ d, onRedeem, claimed }) {
  const expired = d.expires_at && new Date(d.expires_at).getTime() <= Date.now()
  return (
    <DCard hover style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 150, background: 'var(--bg-elevated)' }}>
        {d.image_url
          ? <img src={d.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '1.6rem' }}>🏷</div>}
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 9px', borderRadius: 100, fontSize: '.68rem', fontWeight: 700, background: expired ? 'rgba(0,0,0,.6)' : 'var(--accent)', color: '#fff' }}>
          {expired ? 'Expired' : dealTimeLeft(d.expires_at)}
        </span>
        {d.recurrence && d.recurrence !== 'none' && (
          <span style={{ position: 'absolute', top: 8, right: 8, padding: '3px 9px', borderRadius: 100, fontSize: '.64rem', fontWeight: 700, background: 'rgba(0,0,0,.55)', color: '#fff' }}>↻ {d.recurrence}</span>
        )}
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>{d.title || 'Your deal title'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {d.logo_url && <img src={d.logo_url} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />}
          <Mono style={{ color: 'var(--text-muted)' }}>{d.business_name || 'Your business'}</Mono>
        </div>
        {d.description && <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{d.description}</p>}
        {d.price_cents != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent)' }}>{zar(d.price_cents)}</span>
            {d.original_price_cents != null && d.original_price_cents > d.price_cents &&
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{zar(d.original_price_cents)}</span>}
          </div>
        )}
        {d.student_only && (
          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 100, fontSize: '.66rem', fontWeight: 700, background: 'var(--accent-glow)', color: 'var(--accent)' }}>🎓 Students only</span>
        )}
        {onRedeem && !expired && (
          <button type="button" onClick={() => onRedeem(d)}
            style={{ marginTop: d.price_cents != null && !d.student_only ? 8 : 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem', background: claimed ? 'var(--bg-elevated)' : 'var(--accent)', color: claimed ? 'var(--text-primary)' : '#fff' }}>
            {claimed ? 'Show my QR' : 'Get my QR'}
          </button>
        )}
      </div>
    </DCard>
  )
}

// Create/edit a single deal (business owner). Image via the shared Cloudinary
// uploader (deals scope); expiry via a future-only datetime picker + presets.
function DealForm({ biz, deal, onDone, onCancel }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const isNew = !deal
  const [f, setF] = useState({
    title: deal?.title || '', description: deal?.description || '', imageUrl: deal?.image_url || '',
    priceRand: deal?.price_cents != null ? String(deal.price_cents / 100) : '',
    originalRand: deal?.original_price_cents != null ? String(deal.original_price_cents / 100) : '',
    status: deal?.status === 'draft' ? 'draft' : 'active',
    recurrence: deal?.recurrence || 'none',
    studentOnly: deal?.student_only || false,
    expiresLocal: isoToLocalInput(deal?.expires_at),
  })
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!f.title.trim()) { toast('Title is required', 'error'); return }
    if (!f.expiresLocal) { toast('Pick an expiry date & time', 'error'); return }
    const expiresAt = new Date(f.expiresLocal).toISOString()
    if (new Date(expiresAt).getTime() <= Date.now()) { toast('Expiry must be in the future', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        title: f.title, description: f.description || null, imageUrl: f.imageUrl || null,
        priceCents: f.priceRand === '' ? null : Math.round(parseFloat(f.priceRand) * 100),
        originalPriceCents: f.originalRand === '' ? null : Math.round(parseFloat(f.originalRand) * 100),
        status: f.status, expiresAt, recurrence: f.recurrence, studentOnly: f.studentOnly,
      }
      const res = await fetch(API_BASE + (isNew ? '/deals' : `/deals/${deal.deal_id}`), {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || d.errors?.[0]?.msg || 'Save failed')
      toast(isNew ? 'Deal posted' : 'Deal updated', 'success'); onDone()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  const preview = {
    title: f.title, image_url: f.imageUrl, description: f.description,
    price_cents: f.priceRand === '' ? null : Math.round(parseFloat(f.priceRand) * 100),
    original_price_cents: f.originalRand === '' ? null : Math.round(parseFloat(f.originalRand) * 100),
    expires_at: f.expiresLocal ? new Date(f.expiresLocal).toISOString() : null,
    business_name: biz.name, logo_url: biz.logo_url, student_only: f.studentOnly,
  }

  return (
    <div className="page-enter">
      <BackButton onClick={onCancel} label="Back to deals" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
        <DCard hover={false} style={{ padding: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', marginBottom: 16 }}>{isNew ? 'New deal' : 'Edit deal'}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Title" value={f.title} onChange={set('title')} placeholder="e.g. 2-for-1 burgers, Tuesdays only" />
            <Textarea label="Description" value={f.description} onChange={set('description')} hint="What's the special?" />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}><Input label="Price (R)" type="number" value={f.priceRand} onChange={set('priceRand')} placeholder="45" /></div>
              <div style={{ flex: 1, minWidth: 120 }}><Input label="Was (R, optional)" type="number" value={f.originalRand} onChange={set('originalRand')} placeholder="90" /></div>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Deal image</span>
              {f.imageUrl && (
                <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: 8, overflow: 'hidden', marginBottom: 8, background: 'var(--bg-elevated)' }}>
                  <img src={f.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => setF(p => ({ ...p, imageUrl: '' }))} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer' }}>×</button>
                </div>
              )}
              <ImageUpload businessId={biz.business_id} scope="deals" label="⬆ Upload deal image" onUploaded={url => setF(p => ({ ...p, imageUrl: url }))} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Expires</span>
              <input type="datetime-local" value={f.expiresLocal} min={daysFromNowLocal(0)} onChange={set('expiresLocal')} style={{ ...bizTaStyle, width: '100%' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[['24 hours', 1], ['3 days', 3], ['1 week', 7]].map(([lbl, dys]) =>
                  <button key={dys} type="button" onClick={() => setF(p => ({ ...p, expiresLocal: daysFromNowLocal(dys) }))} style={{ padding: '5px 11px', borderRadius: 100, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '.74rem', cursor: 'pointer' }}>+{lbl}</button>)}
              </div>
            </div>
            <SelectField label="Repeat" value={f.recurrence} onChange={set('recurrence')} hint={f.recurrence !== 'none' ? 'Auto-renews each cycle when it expires.' : undefined}>
              <option value="none">One-off (no repeat)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </SelectField>
            <SelectField label="Status" value={f.status} onChange={set('status')}>
              <option value="active">Active (visible now)</option>
              <option value="draft">Draft (hidden)</option>
            </SelectField>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: '.85rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={f.studentOnly} onChange={e => setF(p => ({ ...p, studentOnly: e.target.checked }))} style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
              <span>🎓 <strong>Students only</strong> — only customers with a verified student email can claim this deal.</span>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn loading={saving} onClick={save}>{isNew ? 'Post deal' : 'Save changes'}</Btn>
              <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
            </div>
          </div>
        </DCard>
        <div>
          <Mono style={{ display: 'block', marginBottom: 10 }}>Live preview — how customers see it</Mono>
          <div style={{ maxWidth: 280 }}><DealCard d={preview} /></div>
        </div>
      </div>
    </div>
  )
}

// Business dashboard "Catalog" tab (Batch 5) — the owner lists products/services.
// Price is entered in Rand, stored in cents; blank = "price on request".
// Owner's catalogue-order inbox (pay-on-collection). Orders arrive as 'pending';
// the owner accepts → marks ready → completes, or cancels at any point.
const ORDER_BADGE = { pending:'pending', accepted:'accepted', ready:'in_progress', completed:'completed', cancelled:'rejected' }
function BusinessOrders() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [orders, setOrders] = useState(null)
  const [filter, setFilter] = useState('')   // '' = all
  const [busy, setBusy] = useState(null)      // order_id being updated

  const load = () => fetch(`${API_BASE}/orders/received${filter ? `?status=${filter}` : ''}`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
    .then(d => setOrders(d.orders || []))
    .catch(() => setOrders([]))
  useEffect(() => { load() }, [filter]) // eslint-disable-line

  async function setStatus(order, status) {
    setBusy(order.order_id)
    try {
      const res = await fetch(`${API_BASE}/orders/${order.order_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not update order')
      toast(`Order ${status === 'ready' ? 'marked ready' : status}`, 'success')
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const FILTERS = [['', 'All'], ['pending', 'Pending'], ['accepted', 'Accepted'], ['ready', 'Ready'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]
  // Next-step actions available per status (forward path + cancel).
  const ACTIONS = {
    pending:  [['accepted', 'Accept', 'primary'], ['cancelled', 'Decline', 'danger']],
    accepted: [['ready', 'Mark ready', 'primary'], ['cancelled', 'Cancel', 'danger']],
    ready:    [['completed', 'Mark collected', 'primary'], ['cancelled', 'Cancel', 'danger']],
  }

  return (
    <div>
      <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', marginBottom:4 }}>Orders</h2>
      <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:16 }}>Catalogue orders from customers. Payment is arranged on collection — confirm each order and update its status as you go.</p>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        {FILTERS.map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding:'6px 13px', borderRadius:999, cursor:'pointer', fontSize:'.78rem', fontWeight:600,
              border:`1px solid ${filter===v?'var(--text-primary)':'var(--border)'}`,
              background:filter===v?'var(--text-primary)':'var(--bg-surface)', color:filter===v?'var(--bg-base)':'var(--text-secondary)' }}>
            {label}
          </button>
        ))}
      </div>
      {orders === null ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>
        : orders.length === 0 ? <EmptyState icon="inbox" message={filter ? `No ${filter} orders` : 'No orders yet'} />
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {orders.map(o => (
              <DCard key={o.order_id} hover={false} style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'.95rem' }}>{o.quantity}× {o.product_name}</div>
                    <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:2 }}>
                      {o.buyer_name || 'A customer'} · {new Date(o.created_at).toLocaleDateString()}
                      {o.contact_phone && <> · <a href={`tel:${o.contact_phone}`} style={{ color:'var(--accent)' }}>{o.contact_phone}</a></>}
                    </div>
                    {o.note && <div style={{ fontSize:'.82rem', color:'var(--text-secondary)', marginTop:6, lineHeight:1.5 }}>“{o.note}”</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.05rem' }}>{o.total_cents != null ? zar(o.total_cents) : 'On collection'}</div>
                    <div style={{ marginTop:4 }}><Badge variant={ORDER_BADGE[o.status] || 'default'}>{o.status}</Badge></div>
                  </div>
                </div>
                {ACTIONS[o.status] && (
                  <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                    {ACTIONS[o.status].map(([status, label, variant]) => (
                      <Btn key={status} size="sm" variant={variant} loading={busy===o.order_id} onClick={() => setStatus(o, status)}>{label}</Btn>
                    ))}
                  </div>
                )}
              </DCard>
            ))}
          </div>
        )}
    </div>
  )
}

function BusinessCatalog({ biz }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [products, setProducts] = useState(null)
  const [editing, setEditing]   = useState(null) // null | 'new' | product object
  const blank = { name: '', priceRand: '', description: '', imageUrl: '', isAvailable: true }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const load = () => fetch(API_BASE + '/businesses/mine/products', { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
    .then(d => setProducts(d.products || []))
    .catch(() => setProducts([]))
  useEffect(() => { load() }, [])

  function startNew() { setForm(blank); setEditing('new') }
  function startEdit(p) {
    setForm({ name: p.name, priceRand: p.price_cents != null ? (p.price_cents / 100).toString() : '', description: p.description || '', imageUrl: p.image_url || '', isAvailable: p.is_available })
    setEditing(p)
  }

  async function save() {
    if (!form.name.trim()) { toast('Give the item a name', 'error'); return }
    let priceCents = null
    if (form.priceRand.trim() !== '') {
      const r = Number(form.priceRand)
      if (!Number.isFinite(r) || r < 0) { toast('Enter a valid price, or leave it blank for “on request”', 'error'); return }
      priceCents = Math.round(r * 100)
    }
    const body = { name: form.name.trim(), priceCents, description: form.description.trim() || null, imageUrl: form.imageUrl.trim() || null, isAvailable: form.isAvailable }
    setSaving(true)
    try {
      const isNew = editing === 'new'
      const url = isNew ? API_BASE + '/businesses/mine/products' : `${API_BASE}/businesses/mine/products/${editing.product_id}`
      const res = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.errors?.[0]?.msg || d.message || 'Could not save')
      toast(isNew ? 'Item added' : 'Item updated', 'success')
      setEditing(null); load()
    } catch (e) { toast(e.message === 'Failed to fetch' ? 'Backend offline — not saved' : e.message, 'error') }
    finally { setSaving(false) }
  }

  async function remove(p) {
    if (!window.confirm(`Remove “${p.name}” from your catalog?`)) return
    const res = await fetch(`${API_BASE}/businesses/mine/products/${p.product_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { toast('Item removed', 'success'); load() } else toast('Delete failed', 'error')
  }

  async function toggleAvail(p) {
    const res = await fetch(`${API_BASE}/businesses/mine/products/${p.product_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ isAvailable: !p.is_available }) })
    if (res.ok) load(); else toast('Update failed', 'error')
  }

  if (editing) return (
    <div className="page-enter" style={{ maxWidth: 560 }}>
      <BackButton onClick={() => setEditing(null)} label="Back to catalog" />
      <DCard hover={false}>
        <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 16 }}>{editing === 'new' ? 'New catalog item' : 'Edit item'}</Mono>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Flat white, Haircut, Assignment printing" />
          <Input label="Price (R)" value={form.priceRand} onChange={e => setForm(f => ({ ...f, priceRand: e.target.value }))} placeholder="35.00" hint="Leave blank for “price on request”." inputMode="decimal" />
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 70 }} hint="Optional — size, options, what's included." />
          <Input label="Image URL" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" hint="Optional photo of the product." />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isAvailable} onChange={e => setForm(f => ({ ...f, isAvailable: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <span style={{ fontWeight: 600, fontSize: '.9rem' }}>Available (shown on your public page)</span>
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn loading={saving} onClick={save}>{editing === 'new' ? 'Add item' : 'Save changes'}</Btn>
            <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </div>
      </DCard>
    </div>
  )

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', marginTop: 4 }}>List what you sell — products or services. Available items show on your public ReLivR page.</p>
        </div>
        <Btn onClick={startNew}>＋ New item</Btn>
      </div>
      {products === null ? <div style={{ padding: 50, textAlign: 'center' }}><Spinner /></div>
        : products.length === 0 ? <EmptyState icon="package" message="Nothing in your catalog yet — add your first item" action={<Btn size="sm" onClick={startNew}>＋ New item</Btn>} />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {products.map(p => (
              <DCard key={p.product_id} hover={false} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, opacity: p.is_available ? 1 : 0.6 }}>
                {p.image_url
                  ? <img src={p.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>▦</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{p.name}{!p.is_available && <span style={{ marginLeft: 8, fontSize: '.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>hidden</span>}</div>
                  {p.description && <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', whiteSpace: 'nowrap' }}>{p.price_cents != null ? `R${(p.price_cents / 100).toFixed(2)}` : <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>on request</span>}</div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => toggleAvail(p)} title={p.is_available ? 'Hide from public page' : 'Show on public page'} style={bizGhostBtn}>{p.is_available ? 'Hide' : 'Show'}</button>
                  <button onClick={() => startEdit(p)} style={bizGhostBtn}>Edit</button>
                  <button onClick={() => remove(p)} style={{ ...bizGhostBtn, color: 'var(--danger)' }}>✕</button>
                </div>
              </DCard>
            ))}
          </div>}
    </div>
  )
}

// Business dashboard "Deals" tab — list + create/edit/delete the owner's deals.
function BusinessDeals({ biz }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [deals, setDeals] = useState(null)
  const [view, setView] = useState('list')   // 'list' | 'form'
  const [editing, setEditing] = useState(null)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  async function redeemCode() {
    const c = code.trim()
    if (!c) return
    setRedeeming(true)
    try {
      const res = await fetch(API_BASE + '/deals/redeem-token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ token: c }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not redeem this code')
      toast(`✓ Redeemed for ${d.customer} — ${d.dealTitle}`, 'success')
      setCode('')
    } catch (e) { toast(e.message, 'error') } finally { setRedeeming(false) }
  }

  const load = () => fetch(API_BASE + '/deals/mine', { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
    .then(d => setDeals(d.deals || []))
    .catch(() => setDeals([]))
  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!window.confirm('Delete this deal permanently?')) return
    const res = await fetch(API_BASE + `/deals/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { toast('Deal deleted', 'success'); load() } else toast('Delete failed', 'error')
  }

  if (view === 'form') return <DealForm biz={biz} deal={editing} onCancel={() => { setView('list'); setEditing(null) }} onDone={() => { setView('list'); setEditing(null); load() }} />

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Local Deals</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', marginTop: 4 }}>Post a limited-time special. It appears on the public Deals page and auto-hides the moment it expires.</p>
        </div>
        <Btn onClick={() => { setEditing(null); setView('form') }}>＋ New deal</Btn>
      </div>
      <DCard hover={false} style={{ marginBottom: 16, padding: 14 }}>
        <Mono style={{ display: 'block', marginBottom: 8 }}>Redeem a customer's QR code</Mono>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Scan or type their code"
            onKeyDown={e => { if (e.key === 'Enter') redeemCode() }}
            style={{ flex: 1, minWidth: 160, padding: '9px 13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }} />
          <Btn loading={redeeming} onClick={redeemCode}>Redeem</Btn>
        </div>
      </DCard>
      {deals === null ? <div style={{ padding: 50, textAlign: 'center' }}><Spinner /></div>
        : deals.length === 0 ? <EmptyState icon="tag" message="No deals yet — post your first special" action={<Btn size="sm" onClick={() => setView('form')}>＋ New deal</Btn>} />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deals.map(d => {
              const expired = d.status === 'expired' || new Date(d.expires_at).getTime() <= Date.now()
              const chip = d.status === 'draft' ? ['Draft', 'var(--text-muted)'] : d.status === 'archived' ? ['Archived', 'var(--text-muted)'] : expired ? ['Expired', 'var(--danger)'] : ['Active · ' + dealTimeLeft(d.expires_at), 'var(--accent)']
              return (
                <DCard key={d.deal_id} hover={false} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)', flexShrink: 0 }}>
                    {d.image_url ? <img src={d.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>🏷</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{d.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: '.7rem', fontWeight: 700, color: chip[1] }}>{chip[0]}</span>
                      {d.recurrence && d.recurrence !== 'none' && <Mono style={{ color: 'var(--accent)' }}>↻ {d.recurrence}</Mono>}
                      {d.price_cents != null && <Mono style={{ color: 'var(--text-muted)' }}>{zar(d.price_cents)}</Mono>}
                    </div>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={() => { setEditing(d); setView('form') }}>Edit</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => remove(d.deal_id)}>Delete</Btn>
                </DCard>
              )
            })}
          </div>}
    </div>
  )
}

// Public, campus-wide Deals page — active (unexpired) deals only.
// The claimed-deal QR: a one-time token rendered as a QR (+ the code as text) that
// the student shows; the business scans/types it to apply the discount (A2).
function DealQRModal({ deal, token, onClose }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(token, { width: 240, margin: 1 }).then(u => { if (alive) setDataUrl(u) }).catch(() => {})
    return () => { alive = false }
  }, [token])
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1300, background:'rgba(20,16,30,.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:360, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-xl)', padding:'26px 24px', textAlign:'center' }}>
        <Mono size="0.68rem" color="var(--accent)" style={{ display:'block', marginBottom:6 }}>Show this at the business</Mono>
        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.15rem', margin:'0 0 16px' }}>{deal.title}</h2>
        <div style={{ background:'#fff', borderRadius:12, padding:12, display:'inline-block' }}>
          {dataUrl
            ? <img src={dataUrl} alt="Your claim QR code" style={{ width:200, height:200, display:'block' }} />
            : <div style={{ width:200, height:200, display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner /></div>}
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.3rem', fontWeight:700, letterSpacing:'0.15em', marginTop:16, color:'var(--text-primary)' }}>{token}</div>
        <p style={{ fontSize:'.8rem', color:'var(--text-muted)', lineHeight:1.5, margin:'10px 0 18px' }}>Staff scan this code (or type it) to apply your discount. One-time use.</p>
        <Btn variant="secondary" size="sm" onClick={onClose}>Done</Btn>
      </div>
    </div>,
    document.body
  )
}

// Format a slot window as "Tue 1 Jul, 14:00–15:00".
function fmtSlot(start, end) {
  const s = new Date(start), e = new Date(end)
  const day = s.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
  const t = d => d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${t(s)}–${t(e)}`
}

// D1/D2: book one of a host's (user or business) open time slots.
function BookingPanel({ hostType, hostId, hostName }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [slots, setSlots] = useState(null)
  const [busy, setBusy] = useState(null)
  const load = () => fetch(`${API_BASE}/scheduling/slots/${hostType}/${hostId}`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : { slots: [] }).then(d => setSlots(d.slots || [])).catch(() => setSlots([]))
  useEffect(() => { if (hostId) load() }, [hostType, hostId]) // eslint-disable-line
  async function book(slot) {
    setBusy(slot.slot_id)
    try {
      const res = await fetch(`${API_BASE}/scheduling/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ slotId: slot.slot_id }) })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not book')
      toast('Booked! You’ll get a reminder before it starts.', 'success'); load()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(null) }
  }
  if (!slots || slots.length === 0) return null // hide when there's nothing to book
  return (
    <DCard hover={false} style={{ marginTop: 16 }}>
      <Mono size="0.68rem" color="var(--accent)" style={{ display: 'block', marginBottom: 12 }}>Book a time{hostName ? ` with ${hostName}` : ''}</Mono>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {slots.slice(0, 8).map(s => (
          <div key={s.slot_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.86rem' }}>{fmtSlot(s.starts_at, s.ends_at)}</div>
              {s.note && <Mono style={{ color: 'var(--text-muted)' }}>{s.note}</Mono>}
            </div>
            <Btn size="sm" loading={busy === s.slot_id} onClick={() => book(s)}>Book</Btn>
          </div>
        ))}
      </div>
    </DCard>
  )
}

// D1/D2: a host manages their own availability (add / view bookings / remove).
// hostType 'user' on the member Schedule page; 'business' on the business dashboard.
function AvailabilityManager({ hostType }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [slots, setSlots] = useState(null)
  const [form, setForm] = useState({ date: '', start: '', end: '', note: '' })
  const [saving, setSaving] = useState(false)
  const load = () => fetch(`${API_BASE}/scheduling/slots/mine`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : { slots: [] }).then(d => setSlots((d.slots || []).filter(s => s.host_type === hostType))).catch(() => setSlots([]))
  useEffect(() => { load() }, []) // eslint-disable-line
  const todayStr = new Date().toISOString().slice(0, 10)
  async function addSlot() {
    if (!form.date || !form.start || !form.end) { toast('Pick a date and start/end times', 'error'); return }
    if (form.end <= form.start) { toast('End time must be after the start time', 'error'); return }
    if (new Date(`${form.date}T${form.start}`) <= new Date()) { toast("That slot is in the past — pick a future date and time", 'error'); return }
    const startsAt = new Date(`${form.date}T${form.start}`).toISOString()
    const endsAt = new Date(`${form.date}T${form.end}`).toISOString()
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/scheduling/slots`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ hostType, startsAt, endsAt, note: form.note || null }) })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not add slot')
      toast('Availability added', 'success'); setForm({ date: form.date, start: '', end: '', note: '' }); load()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }
  async function removeSlot(id) {
    if (!window.confirm('Remove this slot? Anyone booked will be notified.')) return
    const res = await fetch(`${API_BASE}/scheduling/slots/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { toast('Slot removed', 'success'); load() } else toast('Could not remove the slot', 'error')
  }
  return (
    <>
      <DCard hover={false} style={{ marginBottom: 16 }}>
        <Mono size="0.68rem" color="var(--accent)" style={{ display: 'block', marginBottom: 12 }}>Add availability</Mono>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, alignItems: 'end' }}>
          <Input label="Date" type="date" min={todayStr} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <Input label="From" type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
          <Input label="To" type="time" min={form.start || undefined} value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
        </div>
        <Input label="Note (optional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={hostType === 'business' ? 'e.g. Walk-in haircut' : 'e.g. Tutoring session'} style={{ marginTop: 12 }} />
        <Btn size="sm" loading={saving} onClick={addSlot} style={{ marginTop: 12 }}>Add slot</Btn>
      </DCard>
      {slots === null ? <div style={{ padding: 30, textAlign: 'center' }}><Spinner /></div>
        : slots.length === 0 ? <EmptyState icon="clock" message="No availability yet — add a slot above." />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map(s => (
              <DCard key={s.slot_id} hover={false} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{fmtSlot(s.starts_at, s.ends_at)}</div>
                  <Mono style={{ color: 'var(--text-muted)' }}>{(s.bookings?.length || 0)} of {s.capacity} booked{s.bookings?.length ? ` · ${s.bookings.map(b => b.guest_name || 'Someone').join(', ')}` : ''}</Mono>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => removeSlot(s.slot_id)}>Remove</Btn>
              </DCard>
            ))}
          </div>}
    </>
  )
}

// D1: the member Schedule page — own availability + bookings made as a guest.
function SchedulePage() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [bookings, setBookings] = useState(null)
  const loadB = () => fetch(`${API_BASE}/scheduling/bookings/mine`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : { bookings: [] }).then(d => setBookings(d.bookings || [])).catch(() => setBookings([]))
  useEffect(() => { loadB() }, []) // eslint-disable-line
  async function cancelBooking(id) {
    const res = await fetch(`${API_BASE}/scheduling/bookings/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { toast('Booking cancelled', 'success'); loadB() } else toast('Could not cancel', 'error')
  }
  return (
    <div className="page-enter" style={{ maxWidth: 760 }}>
      <PageTitle sub="Publish when you’re free, and manage your bookings">Schedule</PageTitle>
      <FirstUseNote id="schedule">Add times you’re free and others can book you — you’ll both get a reminder before it starts.</FirstUseNote>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: '4px 0 12px' }}>My availability</h3>
      <AvailabilityManager hostType="user" />
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', margin: '24px 0 12px' }}>My bookings</h3>
      {bookings === null ? null
        : bookings.length === 0 ? <EmptyState icon="clock" message="You haven’t booked anything yet." />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bookings.map(b => (
              <DCard key={b.booking_id} hover={false} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div><div style={{ fontWeight: 600 }}>{fmtSlot(b.starts_at, b.ends_at)}</div><Mono style={{ color: 'var(--text-muted)' }}>with {b.host_name || 'host'}</Mono></div>
                <Btn variant="ghost" size="sm" onClick={() => cancelBooking(b.booking_id)}>Cancel</Btn>
              </DCard>
            ))}
          </div>}
    </div>
  )
}

// F1b: set up a recurring retainer with a provider (shown on their profile).
function RetainerSetup({ providerId, providerName }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', amount: '', cadence: 'weekly' })
  const [saving, setSaving] = useState(false)
  async function submit() {
    if (!f.title.trim() || !f.amount || parseFloat(f.amount) <= 0) { toast('Add what you need and a rate', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/retainers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ providerId, title: f.title.trim(), amount: parseFloat(f.amount), cadence: f.cadence }) })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not set up the retainer')
      toast(`Retainer set up with ${providerName}`, 'success'); setOpen(false); setF({ title: '', amount: '', cadence: 'weekly' })
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }
  if (!open) return <div style={{ marginTop: 12 }}><Btn variant="secondary" size="sm" onClick={() => setOpen(true)}>↻ Set up a retainer</Btn></div>
  return (
    <DCard hover={false} style={{ marginTop: 12 }}>
      <Mono size="0.68rem" color="var(--accent)" style={{ display: 'block', marginBottom: 10 }}>Recurring retainer with {providerName}</Mono>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input label="What's the recurring work?" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Weekly maths tutoring" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}><Input label="Rate (R)" type="number" min="1" value={f.amount} onChange={e => setF(p => ({ ...p, amount: e.target.value }))} placeholder="150" /></div>
          <div style={{ flex: 1, minWidth: 120 }}><SelectField label="Every" value={f.cadence} onChange={e => setF(p => ({ ...p, cadence: e.target.value }))}><option value="weekly">Week</option><option value="monthly">Month</option></SelectField></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm" loading={saving} onClick={submit}>Start retainer</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Btn>
        </div>
        <Mono style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>A task is created now and every {f.cadence === 'weekly' ? 'week' : 'month'} until you cancel. Arrange payment directly for now.</Mono>
      </div>
    </DCard>
  )
}

// F1b: the client's retainers, with cancel — shown on the Following page.
function MyRetainers() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [rets, setRets] = useState(null)
  const load = () => fetch(`${API_BASE}/retainers/mine`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : { retainers: [] }).then(d => setRets(d.retainers || [])).catch(() => setRets([]))
  useEffect(() => { load() }, []) // eslint-disable-line
  async function cancel(id) {
    if (!window.confirm('Cancel this retainer? No further tasks will be created.')) return
    const res = await fetch(`${API_BASE}/retainers/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { toast('Retainer cancelled', 'success'); load() } else toast('Could not cancel', 'error')
  }
  if (!rets || rets.length === 0) return null
  return (
    <div>
      <Mono style={{ display: 'block', marginBottom: 10 }}>Retainers ({rets.length})</Mono>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rets.map(r => (
          <DCard key={r.retainer_id} hover={false} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.title} {!r.active && <Tag>ended</Tag>}</div>
              <Mono style={{ color: 'var(--text-muted)' }}>R{r.amount} · {r.cadence} · with {r.provider_name || 'provider'}</Mono>
            </div>
            {r.active && <Btn variant="ghost" size="sm" onClick={() => cancel(r.retainer_id)}>Cancel</Btn>}
          </DCard>
        ))}
      </div>
    </div>
  )
}

function DealsPage() {
  const toast = useToast()
  const [deals, setDeals] = useState(null)
  const [claimed, setClaimed] = useState({})
  const [qr, setQr] = useState(null)   // { deal, token } — the claimed-QR modal
  useEffect(() => {
    let alive = true
    // The endpoint is public (auth ignored), but sending a token if we have one
    // lets gate-bypassing roles preview the page before the 7-July public launch.
    const tok = localStorage.getItem('rl_token')
    fetch(API_BASE + '/deals', tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('deals')))
      .then(d => { if (alive) setDeals(d.deals || []) })
      .catch(() => { if (alive) setDeals([]) })
    return () => { alive = false }
  }, [])

  async function claim(d) {
    const t = localStorage.getItem('rl_token')
    if (!t) { toast('Sign in to claim deals', 'error'); return }
    try {
      const res = await fetch(`${API_BASE}/deals/${d.deal_id}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.claim) { setClaimed(c => ({ ...c, [d.deal_id]: true })); setQr({ deal: d, token: data.claim.token }) }
      else if (res.status === 403) toast(data.message || 'This deal is for verified students.', 'error')
      else if (res.status === 401) toast('Sign in to claim deals', 'error')
      else if (res.status === 400) toast("You can't claim your own deal.", 'error')
      else toast(data.message || 'Could not claim the deal', 'error')
    } catch { toast('Could not claim the deal', 'error') }
  }

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', margin: 0 }}>Local Deals</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Limited-time specials from local businesses. Grab them before they expire.</p>
      </div>
      {deals === null ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
        : deals.length === 0 ? <EmptyState icon="tag" message="No live deals right now — check back soon" />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {deals.map(d => <DealCard key={d.deal_id} d={d} onRedeem={claim} claimed={!!claimed[d.deal_id]} />)}
          </div>}
      {qr && <DealQRModal deal={qr.deal} token={qr.token} onClose={() => setQr(null)} />}
    </div>
  )
}

// Admin moderation — every deal, with archive/delete actions.
function AdminDeals() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [deals, setDeals] = useState(null)
  const load = () => fetch(API_BASE + '/deals/admin/all', { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
    .then(d => setDeals(d.deals || []))
    .catch(() => setDeals([]))
  useEffect(() => { load() }, [])

  async function archive(id) {
    const res = await fetch(API_BASE + `/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ status: 'archived' }) })
    if (res.ok) { toast('Deal hidden', 'success'); load() } else toast('Action failed', 'error')
  }
  async function remove(id) {
    if (!window.confirm('Delete this deal permanently?')) return
    const res = await fetch(API_BASE + `/deals/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) { toast('Deal deleted', 'success'); load() } else toast('Delete failed', 'error')
  }

  return (
    <div className="page-enter">
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', marginBottom: 16 }}>Deals moderation</h1>
      {deals === null ? <Spinner />
        : deals.length === 0 ? <EmptyState icon="tag" message="No deals posted yet" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deals.map(d => {
              const expired = d.status === 'expired' || new Date(d.expires_at).getTime() <= Date.now()
              return (
                <DCard key={d.deal_id} hover={false} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)', flexShrink: 0 }}>
                    {d.image_url ? <img src={d.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ textAlign: 'center', lineHeight: '48px', color: 'var(--text-muted)' }}>🏷</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.92rem' }}>{d.title}</div>
                    <Mono style={{ color: 'var(--text-muted)' }}>{d.business_name} · {d.status}{expired && d.status === 'active' ? ' (lapsed)' : ''}</Mono>
                  </div>
                  {d.status !== 'archived' && <Btn variant="secondary" size="sm" onClick={() => archive(d.deal_id)}>Hide</Btn>}
                  <Btn variant="ghost" size="sm" onClick={() => remove(d.deal_id)}>Delete</Btn>
                </DCard>
              )
            })}
          </div>}
    </div>
  )
}

// Business dashboard "Clients" tab — Client History from deal redemptions.
function BusinessClients() {
  const token = () => localStorage.getItem('rl_token')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetch(API_BASE + '/deals/mine/clients', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('clients')))
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) { setData(null); setLoading(false) } })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ padding: 50, textAlign: 'center' }}><Spinner /></div>
  if (!data) return <EmptyState icon="clock" message="Couldn't load your client history" />

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Client History</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', marginTop: 4 }}>Everyone who's claimed your Local Deals — your repeat-customer base.</p>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <BizStatTile label="Redemptions" value={data.total_redemptions} />
        <BizStatTile label="Unique clients" value={data.unique_customers} />
        <BizStatTile label="Repeat clients" value={data.repeat_customers} color="var(--success)" />
        <BizStatTile label="Total value" value={zar(data.total_value_cents) || 'R0'} />
        <BizStatTile label="Last 30 days" value={data.last_30d} />
      </div>
      {data.redemptions_series?.length > 0 && (
        <DCard hover={false} style={{ marginBottom: 18 }}>
          <MiniChart data={data.redemptions_series} dataKey="count" label="Redemptions / day (last 30)" />
        </DCard>
      )}
      <Mono style={{ display: 'block', marginBottom: 10 }}>Recent redemptions</Mono>
      {data.recent.length === 0
        ? <EmptyState icon="users" message="No redemptions yet — share your deals to start building your client base" />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.recent.map(r => (
            <DCard key={r.redemption_id} hover={false} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{r.customer_name || 'Guest'}</div>
                <Mono style={{ color: 'var(--text-muted)' }}>{r.deal_title || 'Deal'} · {new Date(r.redeemed_at).toLocaleDateString()}</Mono>
              </div>
              {r.amount_cents != null && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--accent)' }}>{zar(r.amount_cents)}</span>}
            </DCard>
          ))}
        </div>}
    </div>
  )
}

// E2/E3/E4: a business's shareable QR (opens its ReLivR page) + public code, and a
// one-tap "Boost" to promoted placement (free during beta; billing hooks in at G1).
function BizShareBoost({ biz, onBoosted }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [qr, setQr] = useState('')
  const [boostedUntil, setBoostedUntil] = useState(biz.boosted_until || null)
  const [busy, setBusy] = useState(false)
  const link = `${window.location.origin}/local?b=${biz.business_id}`
  useEffect(() => { QRCode.toDataURL(link, { width: 220, margin: 1 }).then(setQr).catch(() => {}) }, [link])
  const active = boostedUntil && new Date(boostedUntil) > new Date()
  async function boost() {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/businesses/mine/boost`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
      const d = await res.json().catch(() => ({})); if (!res.ok) throw new Error(d.message || 'Could not boost')
      setBoostedUntil(d.boosted_until); toast('Your business is now promoted for 7 days', 'success'); onBoosted?.({ ...biz, boosted_until: d.boosted_until, boosted: true })
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <DCard hover={false} style={{ padding: 22, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 10, flexShrink: 0 }}>
        {qr ? <img src={qr} alt="Business QR code" style={{ width: 120, height: 120, display: 'block' }} /> : <div style={{ width: 120, height: 120 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <Mono size="0.68rem" color="var(--accent)" style={{ display: 'block', marginBottom: 6 }}>Share &amp; promote</Mono>
        <div style={{ fontSize: '.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>Print this QR in-store — scanning it opens your ReLivR page. Code: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{biz.public_code || '—'}</strong></div>
        {active
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: 'var(--accent)', fontWeight: 700 }}>★ Promoted until {new Date(boostedUntil).toLocaleDateString()}</span>
          : <Btn size="sm" loading={busy} onClick={boost}>★ Boost my business (7 days)</Btn>}
        {!active && <Mono style={{ display: 'block', marginTop: 6, color: 'var(--text-muted)' }}>Free during beta · surfaces you first in Local</Mono>}
      </div>
    </DCard>
  )
}

function BusinessPageEditor({ biz, onSaved }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const s = biz.socials || {}
  const [f, setF] = useState({
    name: biz.name || '', tagline: biz.tagline || '', category: biz.category || '',
    description: biz.description || '', hours: biz.hours || '', address: biz.address || '',
    campusZone: biz.campus_zone || '',
    phone: biz.phone || '', whatsapp: biz.whatsapp || '', email: biz.email || '',
    themeColor: biz.theme_color || '#6C5CE7',
    coverImageUrl: biz.cover_image_url || '', logoUrl: biz.logo_url || '', linkUrl: biz.link_url || '',
    gallery: Array.isArray(biz.image_urls) ? biz.image_urls : [],
    instagram: s.instagram || '', facebook: s.facebook || '', tiktok: s.tiktok || '', website: s.website || '',
  })
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const [saving, setSaving] = useState(false)
  const [imgInput, setImgInput] = useState('')
  const zones = useLocations() // A5: which zone this business is in, for Local's proximity sort

  // Gallery is a plain array (identical to the admin form's proven pattern).
  // Every mutation goes through a functional updater reading `p`, so concurrent
  // uploads append cleanly and never clobber an earlier image.
  function addGalleryImage(url) {
    const v = (url || '').trim()
    if (!v) return
    setF(p => p.gallery.length >= 8 ? (toast('Up to 8 images', 'error'), p) : ({ ...p, gallery: [...p.gallery, v] }))
  }
  function removeGalleryImage(idx) {
    setF(p => ({ ...p, gallery: p.gallery.filter((_, j) => j !== idx) }))
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: f.name, tagline: f.tagline, category: f.category, description: f.description,
        hours: f.hours, address: f.address, campusZone: f.campusZone || '', phone: f.phone, whatsapp: f.whatsapp, email: f.email,
        themeColor: f.themeColor, coverImageUrl: f.coverImageUrl || null, logoUrl: f.logoUrl || null,
        linkUrl: f.linkUrl || null, imageUrls: f.gallery,
        socials: { instagram: f.instagram, facebook: f.facebook, tiktok: f.tiktok, website: f.website },
      }
      const res = await fetch(API_BASE + '/businesses/mine', {
        method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Save failed.')
      toast('Your page was updated.', 'success')
      onSaved(d.business)
    } catch (e) { toast(e.message || 'Save failed.', 'error') }
    finally { setSaving(false) }
  }

  const preview = {
    ...biz, name:f.name, tagline:f.tagline, category:f.category, description:f.description,
    hours:f.hours, theme_color:f.themeColor, cover_image_url:f.coverImageUrl, logo_url:f.logoUrl,
    image_urls: f.gallery,
  }
  const sectionLabel = (t) => <Mono style={{ display:'block', margin:'18px 0 10px', color:'var(--text-secondary)' }}>{t}</Mono>

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:24, alignItems:'start' }}>
      <div style={{ gridColumn:'1 / -1' }}><BizShareBoost biz={biz} onBoosted={onSaved} /></div>
      <DCard hover={false} style={{ padding:22 }}>
        {sectionLabel('— Basics')}
        <Input label="Business name" value={f.name} onChange={set('name')} />
        <Input label="Tagline" value={f.tagline} onChange={set('tagline')} />
        <Input label="Category" value={f.category} onChange={set('category')} />
        <label style={{ display:'block', marginTop:4 }}>
          <span style={{ display:'block', fontSize:'.75rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Description</span>
          <textarea value={f.description} onChange={set('description')} rows={4} style={bizTaStyle} maxLength={2000} />
        </label>

        {sectionLabel('— Hours & location')}
        <Input label="Opening hours" value={f.hours} onChange={set('hours')} />
        <Input label="Address" value={f.address} onChange={set('address')} />
        <SelectField label="Zone / area (lets customers sort Local by distance)" value={f.campusZone} onChange={set('campusZone')}>
          <option value="">Not specified</option>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </SelectField>

        {sectionLabel('— Contact')}
        <Input label="Phone" value={f.phone} onChange={set('phone')} />
        <Input label="WhatsApp" value={f.whatsapp} onChange={set('whatsapp')} />
        <Input label="Email" value={f.email} onChange={set('email')} />
        <Input label="Website link" value={f.linkUrl} onChange={set('linkUrl')} />

        {sectionLabel('— Appearance')}
        <label style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <span style={{ fontSize:'.75rem', fontWeight:600, color:'var(--text-secondary)' }}>Theme colour</span>
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.themeColor) ? f.themeColor : '#6C5CE7'} onChange={set('themeColor')} style={{ width:42, height:30, border:'1px solid var(--border)', borderRadius:8, background:'none', cursor:'pointer' }} />
          <input value={f.themeColor} onChange={set('themeColor')} style={{ ...bizTaStyle, width:120 }} />
        </label>
        <label style={{ display:'block', marginTop:4 }}>
          <span style={{ display:'block', fontSize:'.75rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Cover image</span>
          {f.coverImageUrl && (
            <div style={{ position:'relative', width:'100%', height:96, borderRadius:8, overflow:'hidden', marginBottom:8, background:'var(--bg-elevated)' }}>
              <img src={f.coverImageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <button type="button" onClick={() => setF(p => ({ ...p, coverImageUrl:'' }))}
                style={{ position:'absolute', top:6, right:6, width:22, height:22, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:'.8rem', cursor:'pointer', lineHeight:1 }}>×</button>
            </div>
          )}
          <ImageUpload businessId={biz.business_id} label="⬆ Upload cover photo" onUploaded={url => setF(p => ({ ...p, coverImageUrl: url }))} />
          <input value={f.coverImageUrl} onChange={set('coverImageUrl')} placeholder="…or paste a URL" style={{ ...bizTaStyle, width:'100%' }} />
        </label>

        <label style={{ display:'block', marginTop:14 }}>
          <span style={{ display:'block', fontSize:'.75rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Logo</span>
          {f.logoUrl && (
            <div style={{ position:'relative', width:64, height:64, borderRadius:10, overflow:'hidden', marginBottom:8, background:'var(--bg-elevated)' }}>
              <img src={f.logoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <button type="button" onClick={() => setF(p => ({ ...p, logoUrl:'' }))}
                style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:'.7rem', cursor:'pointer', lineHeight:1 }}>×</button>
            </div>
          )}
          <ImageUpload businessId={biz.business_id} label="⬆ Upload logo" onUploaded={url => setF(p => ({ ...p, logoUrl: url }))} />
          <input value={f.logoUrl} onChange={set('logoUrl')} placeholder="…or paste a URL" style={{ ...bizTaStyle, width:'100%' }} />
        </label>

        <label style={{ display:'block', marginTop:14 }}>
          <span style={{ display:'block', fontSize:'.75rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:5 }}>Gallery (storefront, goods, menus — up to 8). New uploads are added; they don't replace existing photos.</span>
          {f.gallery.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
              {f.gallery.map((url, i) => (
                <div key={`${i}-${url}`} style={{ position:'relative', width:64, height:64, borderRadius:8, overflow:'hidden', background:'var(--bg-elevated)' }}>
                  <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button type="button" onClick={() => removeGalleryImage(i)}
                    style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:'.7rem', cursor:'pointer', lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <ImageUpload businessId={biz.business_id} multiple label="⬆ Upload photos or drop them here"
            onUploaded={addGalleryImage} />
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <input value={imgInput} onChange={e=>setImgInput(e.target.value)} placeholder="…or paste an image URL"
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addGalleryImage(imgInput); setImgInput('') } }}
              style={{ ...bizTaStyle, flex:1 }} />
            <Btn variant="secondary" size="sm" onClick={() => { addGalleryImage(imgInput); setImgInput('') }}>Add</Btn>
          </div>
        </label>

        {sectionLabel('— Social links')}
        <Input label="Instagram" value={f.instagram} onChange={set('instagram')} />
        <Input label="Facebook" value={f.facebook} onChange={set('facebook')} />
        <Input label="TikTok" value={f.tiktok} onChange={set('tiktok')} />
        <Input label="Website (social)" value={f.website} onChange={set('website')} />

        <div style={{ marginTop:20 }}>
          <Btn loading={saving} onClick={save}>Save changes</Btn>
        </div>
      </DCard>

      <div>
        <Mono style={{ display:'block', marginBottom:10 }}>Live preview — how customers see you</Mono>
        <BusinessPreviewCard b={preview} />
      </div>
    </div>
  )
}

function BizStatTile({ label, value, sub, color='var(--accent)' }) {
  return (
    <div style={{ flex:1, position:'relative', overflow:'hidden', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'18px 20px 18px 22px', boxShadow:'var(--shadow-xs)' }}>
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3, background:color }} />
      <Mono style={{ color:'var(--text-muted)' }}>{label}</Mono>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.9rem', color, marginTop:6, lineHeight:1, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{value}</div>
      {sub && <Mono style={{ color:'var(--text-muted)', display:'block', marginTop:6 }}>{sub}</Mono>}
    </div>
  )
}

function BusinessAnalytics() {
  const token = () => localStorage.getItem('rl_token')
  const [days, setDays]       = useState(30)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/businesses/mine/analytics?days=${days}`, { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('analytics')))
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [days])

  if (loading) return <div style={{ padding:60, textAlign:'center' }}><Spinner /></div>
  if (!data)   return <EmptyState icon="chart" message="No analytics yet — they’ll appear as customers view your page." />

  const t = data.totals || {}
  const clickRows = [
    ['💬 WhatsApp',  t.whatsapp_click || 0],
    ['📞 Phone',     t.phone_click || 0],
    ['🔗 Website',   t.link_click || 0],
    ['✉️ Email',     t.email_click || 0],
    ['📍 Directions',t.directions_click || 0],
  ]
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:18 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', margin:0 }}>Your page analytics</h2>
        <div style={{ display:'flex', gap:6 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding:'6px 12px', borderRadius:100, fontSize:'.78rem', fontWeight:600, cursor:'pointer', border:`1px solid ${days===d?'var(--accent)':'var(--border)'}`, background:days===d?'var(--accent)':'var(--bg-surface)', color:days===d?'#fff':'var(--text-secondary)' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:14, marginBottom:22 }}>
        <BizStatTile label="Page views" value={data.total_views} sub={`last ${data.range_days} days`} />
        <BizStatTile label="Contact clicks" value={data.total_clicks} color="var(--success)" />
        <BizStatTile label="Engagement" value={`${data.engagement_rate}%`} sub="clicks ÷ views" color="var(--info)" />
      </div>

      <DCard hover={false} style={{ padding:20, marginBottom:22 }}>
        <MiniChart data={data.views_series} dataKey="count" label="Daily page views" />
      </DCard>

      <DCard hover={false} style={{ padding:20 }}>
        <Mono style={{ display:'block', marginBottom:12, color:'var(--text-secondary)' }}>Where people tapped — contact breakdown</Mono>
        {clickRows.map(([label, n]) => {
          const max = Math.max(1, ...clickRows.map(r => r[1]))
          return (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <span style={{ width:120, fontSize:'.85rem', color:'var(--text-secondary)' }}>{label}</span>
              <div style={{ flex:1, height:8, background:'var(--bg-elevated)', borderRadius:6, overflow:'hidden' }}>
                <div style={{ width:`${(n / max) * 100}%`, height:'100%', background:'var(--accent)', borderRadius:6 }} />
              </div>
              <span style={{ width:36, textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'.8rem' }}>{n}</span>
            </div>
          )
        })}
      </DCard>
    </div>
  )
}

function AdminDashboard() {
  const token = () => localStorage.getItem('rl_token')
  const [stats, setStats]   = useState(null)
  const [activity, setActivity] = useState([])
  const [series, setSeries] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(API_BASE + '/admin/stats', { headers:{ Authorization:`Bearer ${token()}` } }).then(r => r.ok ? r.json() : Promise.reject(new Error('stats'))),
      fetch(API_BASE + '/admin/activity?limit=20', { headers:{ Authorization:`Bearer ${token()}` } }).then(r => r.ok ? r.json() : { activity:[] }),
      fetch(API_BASE + '/admin/analytics?days=30', { headers:{ Authorization:`Bearer ${token()}` } }).then(r => r.ok ? r.json() : { series:[] }),
    ]).then(([s, a, an]) => { if (alive) { setStats(s); setActivity(a?.activity || []); setSeries(an?.series || []); setLoading(false) } })
      .catch(() => { if (alive) { setError('Could not load admin stats'); setLoading(false) } })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ padding:48, textAlign:'center' }}><Spinner /></div>
  if (error || !stats) return <EmptyState icon="clock" message={error || 'No stats'} />

  const t = stats.tasks?.by_status || {}
  const d = stats.disputes?.by_status || {}
  const Tile = ({ label, value, sub, accent }) => (
    <DCard hover={false} style={{ minWidth:150 }}>
      <Mono style={{ display:'block', marginBottom:8 }}>{label}</Mono>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.9rem', fontWeight:700, lineHeight:1, color:accent?'var(--accent)':'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:6 }}>{sub}</div>}
    </DCard>
  )

  return (
    <div className="page-enter">
      <PageTitle sub="Platform overview — live">Admin Dashboard</PageTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        <Tile label="Users" value={stats.users.total} sub={`+${stats.users.new_7d} this week`} accent />
        <Tile label="Tasks" value={stats.tasks.total} sub={`${t.open||0} open · ${t.completed||0} done`} />
        <Tile label="Completion" value={stats.completion_rate != null ? `${stats.completion_rate}%` : '—'} />
        <Tile label="Bids" value={stats.bids.total} />
        <Tile label="Open disputes" value={d.open || 0} accent={!!d.open} />
        <Tile label="Businesses" value={stats.businesses.total} sub={`${stats.businesses.active} active`} />
      </div>
      {series.length > 0 && (
        <DCard hover={false} style={{ marginBottom:24 }}>
          <Mono style={{ display:'block', marginBottom:16 }}>Last 30 days</Mono>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:20 }}>
            <MiniChart data={series} dataKey="signups" label="Signups" color="var(--accent)" />
            <MiniChart data={series} dataKey="tasks_created" label="Tasks posted" color="var(--info)" />
            <MiniChart data={series} dataKey="tasks_completed" label="Tasks completed" color="var(--success)" />
          </div>
        </DCard>
      )}
      <DCard hover={false}>
        <Mono style={{ display:'block', marginBottom:12 }}>Recent activity</Mono>
        {activity.length === 0 ? <EmptyState icon="clock" message="No activity recorded yet — actions will appear here." /> : (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {activity.map((a, i) => (
              <div key={a.activity_id} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'9px 0', borderBottom:i<activity.length-1?'1px solid var(--border)':'none' }}>
                <div style={{ minWidth:0 }}>
                  <span style={{ fontWeight:600, fontSize:'0.85rem' }}>{a.action}</span>
                  <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}> · {a.actor_name || a.actor_role || 'system'}</span>
                </div>
                <Mono style={{ flexShrink:0 }}>{new Date(a.created_at).toLocaleString()}</Mono>
              </div>
            ))}
          </div>
        )}
      </DCard>
    </div>
  )
}

function AdminDisputes({ setPage, setSelectedDispute }) {
  const token = () => localStorage.getItem('rl_token')
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')

  useEffect(() => {
    let alive = true
    fetch(API_BASE + '/disputes', { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r => (r.ok ? r.json() : { disputes:[] }))
      .then(d => { if (alive) { setDisputes(d.disputes || []); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filtered = disputes.filter(d => filter==='all' || d.status===filter)
  const badgeFor = s => s==='open' ? 'disputed' : s==='under_review' ? 'pending' : 'completed'

  return (
    <div className="page-enter">
      <PageTitle sub="Review and resolve platform disputes">Dispute Queue</PageTitle>
      <div className="feed-scroll" style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-elevated)', borderRadius:12, padding:3, overflowX:'auto', maxWidth:'fit-content' }}>
        {['all','open','under_review','resolved_creator','resolved_earner','closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(19,17,24,.14)':'none' }}>
            {s.replace('_',' ')} ({s==='all'?disputes.length:disputes.filter(d=>d.status===s).length})
          </button>
        ))}
      </div>
      {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> :
       filtered.length===0 ? <EmptyState icon="scale" message="No disputes in this category" /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(d => (
            <DCard key={d.dispute_id} onClick={() => { setSelectedDispute(d.dispute_id); setPage('admin-dispute-detail') }}>
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                <Badge variant={badgeFor(d.status)}>{d.status.replace('_',' ')}</Badge>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1.05rem' }}>{d.task_title}</span>
              </div>
              <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:10, lineHeight:1.5 }}>{d.reason.slice(0,160)}{d.reason.length>160?'…':''}</p>
              <Mono>Opened {new Date(d.opened_at).toLocaleDateString()}{d.resolved_at ? ` · resolved ${new Date(d.resolved_at).toLocaleDateString()}` : ''}</Mono>
            </DCard>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminDisputeDetail({ disputeId, setPage }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [data, setData]       = useState(null)   // { dispute, events }
  const [loading, setLoading] = useState(true)
  const [note, setNote]       = useState('')
  const [resolveModal, setResolveModal] = useState(null)   // 'refund' | 'release'
  const [resolveLoading, setResolveLoading] = useState(false)

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/disputes/${disputeId}`, { headers:{ Authorization:`Bearer ${token()}` } })
      if (res.ok) setData(await res.json())
    } catch { /* offline */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [disputeId]) // eslint-disable-line

  if (loading) return <div style={{ padding:48, textAlign:'center' }}><Spinner /></div>
  if (!data?.dispute) return <EmptyState message="Dispute not found" action={<Btn onClick={() => setPage('admin-disputes')}>← Back</Btn>} />
  const dispute = data.dispute
  const timeline = (data.events || []).map(e => ({ action:e.action, actor:e.actor_name || '—', note:e.note || '', time:e.created_at }))
  const isResolved = dispute.status.startsWith('resolved') || dispute.status === 'closed'

  async function patchDispute(body, msg) {
    setResolveLoading(true)
    try {
      const res = await fetch(`${API_BASE}/disputes/${disputeId}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Update failed')
      toast(msg, 'success'); setResolveModal(null); setNote(''); load()
    } catch (err) { toast(err.message, 'error') } finally { setResolveLoading(false) }
  }
  function saveNote() {
    if (!note.trim() || note.trim().length < 5) { toast('Note must be at least 5 characters', 'error'); return }
    patchDispute({ admin_notes: note.trim() }, 'Note saved')
  }
  function resolve() {
    patchDispute({ status: resolveModal==='refund' ? 'resolved_creator' : 'resolved_earner', resolution: resolveModal },
      `Dispute resolved in favour of the ${resolveModal==='refund' ? 'creator' : 'earner'}`)
  }

  return (
    <div className="page-enter" style={{ maxWidth:960 }}>
      <button onClick={() => setPage('admin-disputes')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer', marginBottom:20 }}>← Back to Queue</button>
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}><Badge variant={isResolved?'completed':'disputed'}>{dispute.status.replace('_',' ')}</Badge><Mono>Dispute #{String(dispute.dispute_id).slice(0,8)}</Mono></div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:700 }}>{dispute.task_title}</h1>
      </div>
      <div className="stack-mobile" style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <DCard hover={false}><Mono size="0.68rem" color="var(--danger)" style={{ display:'block', marginBottom:10 }}>Dispute Reason</Mono><p style={{ color:'var(--text-secondary)', lineHeight:1.75 }}>{dispute.reason}</p></DCard>
          {Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length>0 && (
            <DCard hover={false}>
              <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:10 }}>Evidence</Mono>
              <ul style={{ paddingLeft:18, margin:0 }}>{dispute.evidence_urls.map((u,i) => <li key={i} style={{ marginBottom:4 }}><a href={u} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', fontSize:'0.85rem' }}>{u}</a></li>)}</ul>
            </DCard>
          )}
          {dispute.admin_notes && (
            <DCard hover={false}><Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:10 }}>Admin Notes</Mono><p style={{ color:'var(--text-secondary)', lineHeight:1.7 }}>{dispute.admin_notes}</p></DCard>
          )}
          {!isResolved&&(
            <>
              <DCard hover={false}>
                <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:12 }}>Internal Notes</Mono>
                <Textarea placeholder="Add investigation notes visible only to admins…" value={note} onChange={e=>setNote(e.target.value)} />
                <Btn variant="secondary" size="sm" style={{ marginTop:10 }} loading={resolveLoading} onClick={saveNote}>Save Note</Btn>
              </DCard>
              <DCard hover={false} style={{ border:'1px solid var(--border-strong)' }}>
                <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:8 }}>Resolution</Mono>
                <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:14, lineHeight:1.5 }}>Record the outcome. Funds settlement runs automatically once escrow/payments are live.</p>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <Btn variant="danger" onClick={() => setResolveModal('refund')}>Resolve for creator</Btn>
                  <Btn variant="success" onClick={() => setResolveModal('release')}>Resolve for earner</Btn>
                </div>
              </DCard>
            </>
          )}
          {isResolved&&(
            <DCard hover={false} style={{ textAlign:'center', padding:28, border:`1px solid ${dispute.resolution==='refund'?'var(--info)':'var(--success)'}` }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>{dispute.resolution==='refund'?'↩':'✓'}</div>
              <Mono color={dispute.resolution==='refund'?'var(--info)':'var(--success)'} size="0.8rem">{dispute.resolution==='refund'?'Resolved: Creator refunded':'Resolved: Earner paid'}</Mono>
              <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginTop:6 }}>Resolved on {new Date(dispute.resolved_at).toLocaleDateString()}</p>
            </DCard>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Audit Timeline</Mono>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {timeline.map((e,i) => (
                <div key={i} style={{ display:'flex', gap:10, paddingBottom:10, borderBottom:i<timeline.length-1?'1px solid var(--border)':'none' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0, marginTop:6 }} />
                  <div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:2 }}>
                      <Mono color="var(--accent)" size="0.62rem">{e.action.replace('_',' ')}</Mono>
                      <Mono size="0.6rem">{e.actor}</Mono>
                    </div>
                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{e.note}</p>
                    <Mono size="0.6rem" style={{ marginTop:2 }}>{new Date(e.time).toLocaleString()}</Mono>
                  </div>
                </div>
              ))}
            </div>
          </DCard>
        </div>
      </div>
      <ConfirmModal open={!!resolveModal} onClose={() => setResolveModal(null)} onConfirm={resolve} loading={resolveLoading}
        title={resolveModal==='refund'?'Resolve for creator':'Resolve for earner'}
        confirmLabel="Confirm resolution"
        confirmVariant={resolveModal==='refund'?'danger':'success'}
        message={`Mark this dispute resolved in favour of the ${resolveModal==='refund'?'creator':'earner'}? It's recorded now; any funds settlement happens automatically once payments go live.`} />
    </div>
  )
}

// God-mode: full task oversight — override status, archive, or delete any task.
const ADMIN_TASK_STATUSES = ['open', 'in_progress', 'submitted', 'completed', 'cancelled', 'expired', 'disputed']
function AdminTasks() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [tasks, setTasks] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const th = { padding:'10px 14px', textAlign:'left', fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:400 }

  const load = () => {
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    fetch(API_BASE + '/admin/tasks' + qs, { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
      .then(d => setTasks(d.tasks || [])).catch(() => setTasks([]))
  }
  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line

  async function override(id, body, label) {
    const res = await fetch(`${API_BASE}/admin/tasks/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify(body) })
    if (res.ok) { toast(label || 'Task updated', 'success'); load() } else toast('Action failed', 'error')
  }
  async function remove(id) {
    if (!window.confirm('Delete this task permanently?')) return
    const res = await fetch(`${API_BASE}/admin/tasks/${id}`, { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify({ reason: 'admin console' }) })
    if (res.ok) { toast('Task deleted', 'success'); load() } else toast('Delete failed', 'error')
  }

  return (
    <div className="page-enter">
      <PageTitle sub="God-mode — override status, archive, or delete any task">Task Management</PageTitle>
      <div style={{ marginBottom:16 }}>
        <SelectField value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ minWidth:160 }}>
          <option value="all">All statuses</option>
          {ADMIN_TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </SelectField>
      </div>
      {tasks === null ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>
        : tasks.length === 0 ? <EmptyState icon="inbox" message="No tasks match" />
          : <DCard hover={false} style={{ padding:0, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                <thead><tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
                  {['Task','Creator','Status','Archived','Actions'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {tasks.map((t, i) => (
                    <tr key={t.task_id} style={{ borderBottom:i<tasks.length-1?'1px solid var(--border)':'none', opacity:t.archived_at?0.55:1 }}>
                      <td style={{ padding:'10px 14px', fontWeight:600, fontSize:'.86rem' }}>{t.title}</td>
                      <td style={{ padding:'10px 14px' }}><Mono>{t.creator_name || '—'}</Mono></td>
                      <td style={{ padding:'10px 14px' }}>
                        <select value={t.status} onChange={e=>override(t.task_id, { status:e.target.value }, 'Status changed')}
                          style={{ fontSize:'.8rem', padding:'4px 6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-surface)' }}>
                          {ADMIN_TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'10px 14px' }}><Mono>{t.archived_at ? 'yes' : '—'}</Mono></td>
                      <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                        <Btn variant="secondary" size="sm" onClick={()=>override(t.task_id, { archived: !t.archived_at }, t.archived_at?'Unarchived':'Archived')}>{t.archived_at?'Unarchive':'Archive'}</Btn>
                        <Btn variant="ghost" size="sm" onClick={()=>remove(t.task_id)} style={{ marginLeft:6 }}>Delete</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DCard>}
    </div>
  )
}

// God-mode: the append-only audit log of every admin action.
function AdminAudit() {
  const token = () => localStorage.getItem('rl_token')
  const [rows, setRows] = useState(null)
  const [entity, setEntity] = useState('all')
  const load = () => {
    const qs = entity === 'all' ? '' : `?entityType=${entity}`
    fetch(API_BASE + '/admin/audit' + qs, { headers:{ Authorization:`Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('load')))
      .then(d => setRows(d.audit || [])).catch(() => setRows([]))
  }
  useEffect(() => { load() }, [entity]) // eslint-disable-line
  return (
    <div className="page-enter">
      <PageTitle sub="Every administrative action, append-only">Audit Log</PageTitle>
      <div style={{ marginBottom:16 }}>
        <SelectField value={entity} onChange={e=>setEntity(e.target.value)} style={{ minWidth:160 }}>
          <option value="all">All entities</option>
          {['user','task','deal','feature_flag','location'].map(s => <option key={s} value={s}>{s}</option>)}
        </SelectField>
      </div>
      {rows === null ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>
        : rows.length === 0 ? <EmptyState icon="package" message="No audit entries yet" />
          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {rows.map(a => (
              <DCard key={a.activity_id} hover={false} style={{ padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:'.86rem' }}>{a.action}</span>
                    <Mono style={{ color:'var(--text-muted)', marginLeft:8 }}>{a.entity_type || '—'}{a.entity_id ? ` · ${String(a.entity_id).slice(0,8)}` : ''}</Mono>
                  </div>
                  <Mono style={{ color:'var(--text-muted)' }}>{a.actor_name || a.actor_role || 'system'} · {new Date(a.created_at).toLocaleString()}</Mono>
                </div>
                {a.metadata?.reason && <div style={{ fontSize:'.8rem', color:'var(--text-secondary)', marginTop:4 }}>Reason: {a.metadata.reason}</div>}
              </DCard>
            ))}
          </div>}
    </div>
  )
}

function AdminUsers() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [banModal, setBanModal] = useState(null)
  const [busy, setBusy]       = useState(false)
  const th = { padding:'10px 16px', textAlign:'left', fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:400 }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/admin/users?limit=100', { headers:{ Authorization:`Bearer ${token()}` } })
      if (res.ok) { const d = await res.json(); setUsers(d.users || []) }
    } catch { /* offline */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const statusOf = u => u.deleted_at ? 'deleted' : u.suspended_at ? 'suspended' : 'active'
  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) { const s = search.toLowerCase(); return (u.email||'').toLowerCase().includes(s) || (u.display_name||'').toLowerCase().includes(s) }
    return true
  })

  async function moderate(u, suspend) {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/admin/users/${u.user_id}`, {
        method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ suspended: suspend }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not update user')
      toast(`${u.display_name || u.email} ${suspend ? 'suspended' : 'reinstated'}`, suspend ? 'warning' : 'success')
      setBanModal(null); load()
    } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  async function removeUser(u) {
    if (!window.confirm(`Permanently delete ${u.display_name || u.email}? This anonymises their data and ends their sessions.`)) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/admin/users/${u.user_id}`, {
        method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ reason: 'admin console' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not delete user')
      toast('Account deleted', 'success'); load()
    } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="page-enter">
      <PageTitle sub={`${users.length} registered users`}>User Management</PageTitle>
      <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'flex-end' }}>
        <Input placeholder="Search by name or email…" aria-label="Search users" value={search} onChange={e=>setSearch(e.target.value)} style={{ width:260 }} />
        <SelectField value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{ minWidth:140 }}>
          <option value="all">All Roles</option><option value="member">Members</option><option value="creator">Creators</option><option value="earner">Earners</option><option value="admin">Admins</option>
        </SelectField>
      </div>
      {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> : (
        <DCard hover={false} style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
                  {['User','Role','Status','Joined','Tasks','Rating','Actions'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const st = statusOf(u)
                  return (
                    <tr key={u.user_id} style={{ borderBottom:i<filtered.length-1?'1px solid var(--border)':'none', opacity:st!=='active'?0.6:1 }}>
                      <td style={{ padding:'12px 16px' }}><div style={{ fontWeight:600, fontSize:'0.88rem' }}>{u.display_name || '—'}</div><div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{u.email}</div></td>
                      <td style={{ padding:'12px 16px' }}><Badge variant={u.role}>{u.role}</Badge></td>
                      <td style={{ padding:'12px 16px' }}><Badge variant={st==='active'?'open':'disputed'}>{st}</Badge></td>
                      <td style={{ padding:'12px 16px' }}><Mono>{new Date(u.created_at).toLocaleDateString()}</Mono></td>
                      <td style={{ padding:'12px 16px' }}><Mono>{u.tasks_posted ?? 0}</Mono></td>
                      <td style={{ padding:'12px 16px' }}><Mono>{u.rating_count > 0 ? `★ ${Number(u.avg_rating).toFixed(1)}` : '—'}</Mono></td>
                      <td style={{ padding:'12px 16px' }}>
                        {st !== 'deleted' && (<>
                          <Btn variant={st==='suspended'?'success':'danger'} size="sm" onClick={() => setBanModal(u)}>{st==='suspended'?'Reinstate':'Suspend'}</Btn>
                          {u.role !== 'admin' && <Btn variant="ghost" size="sm" onClick={() => removeUser(u)} style={{ marginLeft:6 }}>Delete</Btn>}
                        </>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length===0 && <EmptyState icon="sparkles" message="No users match your search" />}
        </DCard>
      )}
      <ConfirmModal open={!!banModal} onClose={() => setBanModal(null)} loading={busy}
        onConfirm={() => moderate(banModal, statusOf(banModal) !== 'suspended')}
        title={banModal && statusOf(banModal)==='suspended' ? 'Reinstate User' : 'Suspend User'}
        confirmLabel={banModal && statusOf(banModal)==='suspended' ? 'Reinstate' : 'Suspend'}
        confirmVariant={banModal && statusOf(banModal)==='suspended' ? 'success' : 'danger'}
        message={banModal ? (statusOf(banModal)==='suspended'
          ? `Reinstate ${banModal.display_name || banModal.email}? They'll regain access immediately.`
          : `Suspend ${banModal.display_name || banModal.email}? Their active sessions end and they can't sign in until reinstated.`) : ''} />
    </div>
  )
}

// Public feature-flag map — lets the UI gate features without a deploy (§7.8).
function useFlags() {
  const [flags, setFlags] = useState({})
  useEffect(() => {
    let alive = true
    const tok = localStorage.getItem('rl_token')
    fetch(API_BASE + '/flags', tok ? { headers:{ Authorization:`Bearer ${tok}` } } : undefined).then(r => r.ok ? r.json() : { flags:{} })
      .then(d => { if (alive) setFlags(d.flags || {}) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return flags
}

// Admin: add campuses / zones without writing SQL (§7.8).
// A5: a zone's lat/lng inline editor — used to refine the placeholder
// coordinates db/init/52_geolocation.sql seeded (a deterministic ring around
// the campus, not surveyed data) into real ones, without a redeploy.
function ZoneCoordRow({ zone, onSaved }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [lat, setLat] = useState(zone.latitude ?? '')
  const [lng, setLng] = useState(zone.longitude ?? '')
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/locations/${zone.location_id}`, {
        method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({ latitude: lat===''?null:parseFloat(lat), longitude: lng===''?null:parseFloat(lng) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || d.errors?.[0]?.msg || 'Could not save coordinates')
      toast(`${zone.name} coordinates saved`, 'success')
      onSaved?.(d.location)
    } catch (err) { toast(err.message, 'error') } finally { setSaving(false) }
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0' }}>
      <Mono style={{ width:130, flexShrink:0 }}>{zone.name}</Mono>
      <input type="number" step="0.0001" placeholder="lat" value={lat} onChange={e=>setLat(e.target.value)} style={{ width:100, padding:'5px 8px', borderRadius:8, border:'1px solid var(--border)', fontSize:'.78rem' }} />
      <input type="number" step="0.0001" placeholder="lng" value={lng} onChange={e=>setLng(e.target.value)} style={{ width:100, padding:'5px 8px', borderRadius:8, border:'1px solid var(--border)', fontSize:'.78rem' }} />
      <Btn size="sm" variant="secondary" loading={saving} onClick={save}>Save</Btn>
    </div>
  )
}

function AdminLocations() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [campuses, setCampuses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm] = useState({ name:'', kind:'campus', parentId:'' })
  const [saving, setSaving] = useState(false)
  const [editingCoords, setEditingCoords] = useState(null) // campus location_id, or null

  async function load() {
    try { const res = await fetch(API_BASE + '/locations'); if (res.ok) { const d = await res.json(); setCampuses(d.campuses || []) } }
    catch { /* offline */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function add() {
    if (!form.name.trim()) { toast('Enter a name', 'error'); return }
    if (form.kind === 'zone' && !form.parentId) { toast('Pick a parent campus for a zone', 'error'); return }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), kind: form.kind }
      if (form.kind === 'zone') body.parentId = form.parentId
      const res = await fetch(API_BASE + '/admin/locations', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not add location')
      toast('Location added', 'success'); setForm(f => ({ ...f, name:'' })); load()
    } catch (err) { toast(err.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="page-enter">
      <PageTitle sub="Campuses & zones — expand without writing SQL">Locations</PageTitle>
      <DCard hover={false} style={{ marginBottom:20 }}>
        <Mono style={{ display:'block', marginBottom:12 }}>Add a location</Mono>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <Input label="Name" value={form.name} onChange={e=>setForm(f=>({ ...f, name:e.target.value }))} style={{ width:200 }} />
          <div>
            <label>Type</label>
            <select value={form.kind} onChange={e=>setForm(f=>({ ...f, kind:e.target.value }))}>
              <option value="campus">Campus</option><option value="zone">Zone</option><option value="region">Region</option>
            </select>
          </div>
          {form.kind==='zone' && (
            <div>
              <label>Parent campus</label>
              <select value={form.parentId} onChange={e=>setForm(f=>({ ...f, parentId:e.target.value }))}>
                <option value="">—</option>{campuses.map(c => <option key={c.location_id} value={c.location_id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <Btn loading={saving} onClick={add}>Add</Btn>
        </div>
      </DCard>
      {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> :
       campuses.length===0 ? <EmptyState icon="inbox" message="No locations yet — add your first campus." /> :
       campuses.map(c => (
        <DCard key={c.location_id} hover={false} style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700 }}>{c.name}</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Mono>{c.zones?.length || 0} zones</Mono>
              {c.zones?.length > 0 && (
                <button onClick={() => setEditingCoords(id => id===c.location_id ? null : c.location_id)}
                  style={{ background:'none', border:'none', color:'var(--accent)', fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>
                  {editingCoords===c.location_id ? 'Done' : '📍 Edit coordinates'}
                </button>
              )}
            </div>
          </div>
          {editingCoords!==c.location_id && c.zones?.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>{c.zones.map(z => <Tag key={z.location_id}>{z.name}</Tag>)}</div>}
          {editingCoords===c.location_id && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
              <p style={{ fontSize:'.72rem', color:'var(--text-muted)', margin:'0 0 8px' }}>Seeded coordinates are an approximate placeholder ring (A5) — refine them here as real ones become available.</p>
              {c.zones.map(z => <ZoneCoordRow key={z.location_id} zone={z} onSaved={load} />)}
            </div>
          )}
        </DCard>
      ))}
    </div>
  )
}

// Admin: toggle feature flags (§7.8).
// Stored ISO (UTC) → the `YYYY-MM-DDTHH:mm` a datetime-local input expects, in
// the admin's local time. Empty string when unset.
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function AdminFlags() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [flags, setFlags]   = useState([])
  const [campuses, setCampuses] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try { const res = await fetch(API_BASE + '/admin/flags', { headers:{ Authorization:`Bearer ${token()}` } }); if (res.ok) { const d = await res.json(); setFlags(d.flags || []) } }
    catch { /* offline */ } finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    // Campuses drive the per-campus targeting picker.
    fetch(API_BASE + '/locations?kind=campus')
      .then(r => r.ok ? r.json() : { locations: [] })
      .then(d => setCampuses(d.locations || []))
      .catch(() => {})
  }, []) // eslint-disable-line

  async function patch(f, changes, label) {
    try {
      const res = await fetch(`${API_BASE}/admin/flags/${f.flag_key}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify(changes) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not update flag')
      setFlags(fs => fs.map(x => x.flag_key===f.flag_key ? { ...x, ...(d.flag || changes) } : x))
      toast(label || `${f.flag_key} updated`, 'success')
    } catch (err) { toast(err.message, 'error') }
  }
  const FLAG_ROLES = ['member', 'business', 'admin']
  const toggleRole = (f, role) => {
    const cur = Array.isArray(f.rollout_roles) ? f.rollout_roles : []
    const next = cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role]
    patch(f, { rollout_roles: next }, `${f.flag_key} roles updated`)
  }
  const toggleCampus = (f, id) => {
    const cur = Array.isArray(f.rollout_campuses) ? f.rollout_campuses : []
    const next = cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]
    patch(f, { rollout_campuses: next }, `${f.flag_key} campuses updated`)
  }
  const setSchedule = (f, field, localVal) => {
    patch(f, { [field]: localVal ? new Date(localVal).toISOString() : null },
      `${f.flag_key} ${field==='enable_at'?'enable':'disable'} time ${localVal ? 'set' : 'cleared'}`)
  }

  return (
    <div className="page-enter">
      <PageTitle sub="Toggle features without a deploy">Feature Flags</PageTitle>
      {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> :
       flags.length===0 ? <EmptyState icon="alert" message="No feature flags defined." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {flags.map(f => (
            <DCard key={f.flag_key} hover={false}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontFamily:'var(--font-mono)', fontSize:'0.88rem' }}>{f.flag_key}</div>
                  {f.description && <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{f.description}</div>}
                </div>
                <Btn variant={f.enabled ? 'success' : 'secondary'} size="sm" onClick={() => patch(f, { enabled: !f.enabled }, `${f.flag_key} turned ${!f.enabled ? 'on' : 'off'}`)}>{f.enabled ? 'On' : 'Off'}</Btn>
              </div>
              {/* Targeting — roles + % rollout + per-campus + scheduled window. Dimmed when the flag is off. */}
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', opacity:f.enabled?1:.5 }}>
                <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                    <Mono style={{ color:'var(--text-muted)' }}>Roles</Mono>
                    {FLAG_ROLES.map(role => {
                      const on = Array.isArray(f.rollout_roles) && f.rollout_roles.includes(role)
                      return (
                        <button key={role} onClick={() => toggleRole(f, role)} disabled={!f.enabled}
                          style={{ padding:'4px 10px', borderRadius:100, fontSize:'.74rem', fontWeight:600, cursor:f.enabled?'pointer':'default', border:`1px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'transparent', color:on?'#fff':'var(--text-secondary)' }}>{role}</button>
                      )
                    })}
                    {(!f.rollout_roles || f.rollout_roles.length===0) && <Mono style={{ color:'var(--text-muted)' }}>everyone</Mono>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <Mono style={{ color:'var(--text-muted)' }}>Rollout</Mono>
                    <input type="number" min={0} max={100} defaultValue={f.rollout_percent ?? 100} disabled={!f.enabled}
                      onBlur={e => { const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); if (v !== (f.rollout_percent ?? 100)) patch(f, { rollout_percent: v }, `${f.flag_key} rollout ${v}%`) }}
                      style={{ width:60, padding:'5px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'.8rem' }} />
                    <Mono style={{ color:'var(--text-muted)' }}>%</Mono>
                  </div>
                </div>
                {/* Per-campus — empty = all campuses. */}
                <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                  <Mono style={{ color:'var(--text-muted)' }}>Campuses</Mono>
                  {campuses.map(c => {
                    const on = Array.isArray(f.rollout_campuses) && f.rollout_campuses.includes(c.location_id)
                    return (
                      <button key={c.location_id} onClick={() => toggleCampus(f, c.location_id)} disabled={!f.enabled}
                        style={{ padding:'4px 10px', borderRadius:100, fontSize:'.74rem', fontWeight:600, cursor:f.enabled?'pointer':'default', border:`1px solid ${on?'var(--accent)':'var(--border)'}`, background:on?'var(--accent)':'transparent', color:on?'#fff':'var(--text-secondary)' }}>{c.name}</button>
                    )
                  })}
                  {campuses.length>0 && (!f.rollout_campuses || f.rollout_campuses.length===0) && <Mono style={{ color:'var(--text-muted)' }}>all campuses</Mono>}
                  {campuses.length===0 && <Mono style={{ color:'var(--text-muted)' }}>—</Mono>}
                </div>
                {/* Scheduled window — off until Enable-at, auto-off at Disable-at. */}
                <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <Mono style={{ color:'var(--text-muted)' }}>Enable at</Mono>
                    <input type="datetime-local" value={toLocalInput(f.enable_at)} disabled={!f.enabled}
                      onChange={e => setSchedule(f, 'enable_at', e.target.value)}
                      style={{ padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'.78rem' }} />
                    {f.enable_at && <button onClick={() => setSchedule(f, 'enable_at', '')} disabled={!f.enabled} title="Clear" style={{ border:'none', background:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem', lineHeight:1 }}>×</button>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <Mono style={{ color:'var(--text-muted)' }}>Disable at</Mono>
                    <input type="datetime-local" value={toLocalInput(f.disable_at)} disabled={!f.enabled}
                      onChange={e => setSchedule(f, 'disable_at', e.target.value)}
                      style={{ padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:'.78rem' }} />
                    {f.disable_at && <button onClick={() => setSchedule(f, 'disable_at', '')} disabled={!f.enabled} title="Clear" style={{ border:'none', background:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem', lineHeight:1 }}>×</button>}
                  </div>
                </div>
              </div>
            </DCard>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — UNIFIED ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

// ─── URL ROUTING ─────────────────────────────────────────────────────────────
// Maps clean browser paths to internal view/dashPage state so every page has
// its own URL, refresh restores the exact page, and back/forward work.
const DASH_ROUTES = {
  '/dashboard':       'dashboard',
  '/browse':          'tasks-browse',
  '/search':          'search',
  '/post':            'tasks-new',
  '/my-tasks':        'tasks-mine',
  '/my-bids':         'my-bids',
  '/my-orders':       'my-orders',
  '/suggestions':     'suggestions',
  '/messages':        'messages',
  '/notifications':   'notifications',
  '/profile':         'profile',
  '/local':           'local-browse',
  '/deals':           'deals',
  '/following':       'following',
  '/schedule':        'schedule',
  '/admin/disputes':  'admin-disputes',
  '/admin/deals':     'admin-deals',
  '/admin/tasks':     'admin-tasks',
  '/admin/audit':     'admin-audit',
  '/admin/locations': 'admin-locations',
  '/admin/flags':     'admin-flags',
  '/admin/users':     'admin-users',
  '/admin/businesses':'admin-businesses',
}
const DASH_PATH = Object.fromEntries(Object.entries(DASH_ROUTES).map(([p, v]) => [v, p]))

const INFO_ROUTES = {
  '/how-it-works':'how-it-works-page', '/features':'features-page', '/pricing':'pricing-page',
  '/trust-safety':'trust-safety', '/terms':'terms', '/privacy':'privacy', '/cookies':'cookies',
  '/popia':'popia', '/help':'help-centre', '/contact':'contact', '/report':'report',
  '/guidelines':'guidelines', '/about':'about-page', '/blog':'blog', '/careers':'careers',
}
const INFO_PATH = Object.fromEntries(Object.entries(INFO_ROUTES).map(([p, v]) => [v, p]))

// Parse the current URL into { view, dashPage, taskId, disputeId }
function parseLocation() {
  const path = window.location.pathname
  if (path === '/' || path === '') return { view:'landing' }
  if (path === '/oauth-callback')  return { view:'oauth-callback' }
  // /task/:id
  const taskMatch = path.match(/^\/task\/([^/]+)$/)
  if (taskMatch) return { view:'dashboard', dashPage:'task-detail', taskId: taskMatch[1] }
  const userMatch = path.match(/^\/u\/([^/]+)$/)
  if (userMatch) return { view:'dashboard', dashPage:'public-profile', userId: userMatch[1] }
  const dispMatch = path.match(/^\/admin\/dispute\/([^/]+)$/)
  if (dispMatch) return { view:'dashboard', dashPage:'admin-dispute-detail', disputeId: dispMatch[1] }
  if (DASH_ROUTES[path]) return { view:'dashboard', dashPage: DASH_ROUTES[path] }
  if (INFO_ROUTES[path]) return { view: INFO_ROUTES[path] }
  return { view:'landing' }
}

// Build a URL from internal state
function buildPath({ view, dashPage, taskId, disputeId }) {
  if (view === 'landing') return '/'
  if (view === 'oauth-callback') return '/oauth-callback'
  if (INFO_PATH[view]) return INFO_PATH[view]
  if (view === 'dashboard') {
    if (dashPage === 'task-detail' && taskId) return `/task/${taskId}`
    if (dashPage === 'public-profile' && window.__rlProfileId) return `/u/${window.__rlProfileId}`
    if (dashPage === 'admin-dispute-detail' && disputeId) return `/admin/dispute/${disputeId}`
    return DASH_PATH[dashPage] || '/dashboard'
  }
  return '/'
}

// ─── PER-ROUTE SEO META ──────────────────────────────────────────────────────
// The app is a client-rendered SPA, so every route ships the same index.html
// shell. This updates <title>, description, canonical and OG/Twitter tags to
// match the current view after render — so Google (which runs the JS) sees a
// distinct, descriptive page per public route instead of one duplicated title.
// Private/dashboard views are disallowed in robots.txt; they still get a clean
// title here but no bespoke description.
const SEO_HOST = 'https://www.relivr.co.za'
const SEO_META = {
  'landing':            { title:'ReLivR — Local Services Marketplace in Makhanda', description:'Post a task, get bids from verified locals, and get things done. ReLivR is the trusted local services marketplace for Makhanda and the Eastern Cape.' },
  'how-it-works-page':  { title:'How ReLivR Works — Post, Bid, Get It Done', description:'Post a task in under a minute, compare bids from verified locals, and pick the right person. Here is how ReLivR works, step by step.' },
  'features-page':      { title:'Features — ReLivR Local Services Marketplace', description:'Verified members, trust scores, in-app messaging, smart skill matching and secure payments. Everything ReLivR gives you to get things done locally.' },
  'pricing-page':       { title:'Pricing — ReLivR', description:'Free to post and browse while in beta. See how pricing works on ReLivR, the local services marketplace for South African communities.' },
  'trust-safety':       { title:'Trust & Safety — ReLivR', description:'ID-verified members, public track records and POPIA-compliant privacy. How ReLivR keeps the local services marketplace safe.' },
  'about-page':         { title:'About ReLivR — Your Local Economy, Connected', description:'ReLivR connects neighbours in Makhanda and the Eastern Cape so anyone can post a task, earn money, or get things done with people they trust.' },
  'help-centre':        { title:'Help Centre — ReLivR', description:'Answers to common questions about posting tasks, bidding, payments, trust and safety on ReLivR.' },
  'contact':            { title:'Contact ReLivR', description:'Get in touch with the ReLivR team — support, business enquiries and feedback.' },
  'blog':               { title:'ReLivR Blog — Local Services, Tips & Stories', description:'Guides, tips and stories from the ReLivR local services marketplace in Makhanda and the Eastern Cape.' },
  'careers':            { title:'Careers at ReLivR', description:'Help build South Africa’s community services marketplace. See open roles at ReLivR.' },
  'guidelines':         { title:'Community Guidelines — ReLivR', description:'The community rules that keep ReLivR safe, fair and useful for everyone.' },
  'terms':              { title:'Terms of Service — ReLivR', description:'The terms governing your use of the ReLivR local services marketplace.' },
  'privacy':            { title:'Privacy Policy (POPIA) — ReLivR', description:'How ReLivR collects, uses and protects your personal information under South Africa’s POPIA.' },
  'cookies':            { title:'Cookie Policy — ReLivR', description:'How and why ReLivR uses cookies, and how to manage your preferences.' },
  'popia':              { title:'POPIA Compliance — ReLivR', description:'ReLivR’s commitment to the Protection of Personal Information Act (POPIA).' },
}
const SEO_DEFAULT = { title:'ReLivR — Local Services Marketplace', description:'The local services marketplace for South African communities — post a task, earn money, or get things done with people you can trust.' }

function seoSetTag(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.setAttribute('content', content)
}
function seoSetCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el) }
  el.setAttribute('href', href)
}
function applyRouteMeta(view) {
  const m = SEO_META[view] || SEO_DEFAULT
  const canonical = SEO_HOST + (window.location.pathname === '/' ? '/' : window.location.pathname)
  document.title = m.title
  seoSetTag('name', 'description', m.description)
  seoSetTag('property', 'og:title', m.title)
  seoSetTag('property', 'og:description', m.description)
  seoSetTag('property', 'og:url', canonical)
  seoSetTag('name', 'twitter:title', m.title)
  seoSetTag('name', 'twitter:description', m.description)
  seoSetCanonical(canonical)
}

// ─── COOKIE CONSENT (POPIA §4) ───────────────────────────────────────────────
// First-visit banner: Accept all / Reject non-essential / Customise by category.
// Choice is stored (versioned) so it isn't re-asked; re-openable from the footer
// and the Cookie Policy via the `relivr:cookie-prefs` window event. Strictly
// necessary is always on; non-essential categories default OFF (no pre-ticking).
const COOKIE_CONSENT_KEY = 'rl_cookie_consent'
const COOKIE_CONSENT_VERSION = 1
function getCookieConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || 'null')
    return c && c.version === COOKIE_CONSENT_VERSION ? c : null
  } catch { return null }
}
function openCookiePrefs() { window.dispatchEvent(new Event('relivr:cookie-prefs')) }

// First-run onboarding walkthrough — a skippable slideshow shown once after a member
// first reaches the app. Persisted in localStorage; re-openable via the
// 'relivr:show-walkthrough' window event. Mounted only inside the authed member shell,
// so it never renders on the public landing (no clash with the auth modal).
const ONBOARDING_KEY = 'rl_onboarding_seen_v1'
// The guide tailors itself to the signup intent ('post' | 'earn' | 'both', kept
// in localStorage by the onboarding flows). Unknown/absent intent → full tour.
function buildWalkthroughSlides(intent) {
  const slides = [
    { icon:'logo', title:'Welcome to ReLivR', body:'Your local marketplace — post what you need done, or earn by helping out. Here’s the 30-second tour.' },
  ]
  if (intent !== 'earn') slides.push(
    { icon:'＋', title:'Post a task in seconds', body:'Describe what you need and set a budget. People nearby send offers — you pick who to work with, chat, and confirm when it’s done.' })
  if (intent !== 'post') slides.push(
    { icon:'◈', title:'Bid & get hired', body:'Browse open tasks that match your skills, send a pitch with your price, and message the poster to lock in details. Every job builds your public rating.' })
  slides.push(
    { icon:'◇', title:'Discover Local & Deals', body:'Browse local businesses Instagram-style and grab deals — verified students also get exclusive student-only QR discounts.' },
    { icon:'☂', title:'Stay safe', body:'Members verify their identity, and ratings and trust scores are public. If anything goes wrong our dispute team steps in. Your data stays protected under POPIA.' },
  )
  return slides
}
function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const [slides, setSlides] = useState(() => buildWalkthroughSlides(null))
  useEffect(() => {
    const readIntent = () => { try { return localStorage.getItem('rl_intent') } catch { return null } }
    let seen = true
    try { seen = !!localStorage.getItem(ONBOARDING_KEY) } catch { /* storage blocked → don't nag */ }
    if (!seen) { setSlides(buildWalkthroughSlides(readIntent())); setOpen(true) }
    const replay = () => { setSlides(buildWalkthroughSlides(readIntent())); setI(0); setOpen(true) }
    window.addEventListener('relivr:show-walkthrough', replay)
    return () => window.removeEventListener('relivr:show-walkthrough', replay)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') { try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* ignore */ } setOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  const last = i >= slides.length - 1
  const close = () => { try { localStorage.setItem(ONBOARDING_KEY, '1') } catch { /* ignore */ } setOpen(false) }
  const s = slides[i]
  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to ReLivR"
      style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(20,16,30,.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-xl)', padding:'28px 26px', textAlign:'center' }}>
        <div style={{ width:64, height:64, margin:'0 auto 18px', borderRadius:'50%', background:'var(--accent-glow)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem' }}>{s.icon === 'logo' ? <LogoMark size={40} /> : s.icon}</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', margin:'0 0 10px' }}>{s.title}</h2>
        <p style={{ color:'var(--text-secondary)', lineHeight:1.6, margin:'0 0 22px', fontSize:'.95rem' }}>{s.body}</p>
        <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:22 }}>
          {slides.map((_, n) => <span key={n} style={{ width:7, height:7, borderRadius:'50%', background:n===i?'var(--accent)':'var(--border-strong)', transition:'background 160ms var(--ease)' }} />)}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          {!last && <Btn variant="ghost" size="sm" onClick={close}>Skip</Btn>}
          {i > 0 && <Btn variant="secondary" size="sm" onClick={() => setI(n => n - 1)}>Back</Btn>}
          {last
            ? <Btn variant="primary" size="sm" onClick={close}>Get started</Btn>
            : <Btn variant="primary" size="sm" onClick={() => setI(n => n + 1)}>Next</Btn>}
        </div>
      </div>
    </div>
  )
}

// First-use note — a one-time, dismissible "how this works" callout shown the first
// time a user opens a feature. Keyed by id in localStorage so it never re-nags.
function FirstUseNote({ id, children }) {
  const KEY = 'rl_seen_hints'
  const [show, setShow] = useState(false)
  useEffect(() => {
    let seen = []
    try { seen = JSON.parse(localStorage.getItem(KEY) || '[]') } catch { seen = [] }
    if (!Array.isArray(seen) || !seen.includes(id)) setShow(true)
  }, [id])
  if (!show) return null
  const dismiss = () => {
    try {
      const seen = JSON.parse(localStorage.getItem(KEY) || '[]')
      const arr = Array.isArray(seen) ? seen : []
      if (!arr.includes(id)) { arr.push(id); localStorage.setItem(KEY, JSON.stringify(arr)) }
    } catch { /* storage blocked — just hide for this session */ }
    setShow(false)
  }
  return (
    <div role="note" style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 14px', marginBottom:16, background:'var(--accent-glow)', border:'1px solid var(--accent-dim)', borderRadius:'var(--radius-md)' }}>
      <span aria-hidden="true" style={{ color:'var(--accent)', fontWeight:800, fontSize:'.95rem', lineHeight:1.5 }}>ⓘ</span>
      <div style={{ flex:1, fontSize:'.84rem', color:'var(--text-secondary)', lineHeight:1.55 }}>{children}</div>
      <button onClick={dismiss} aria-label="Dismiss tip" style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'.95rem', lineHeight:1, padding:2 }}>✕</button>
    </div>
  )
}

function CookieConsent() {
  const [open, setOpen] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [choices, setChoices] = useState({ analytics: false, functional: false, advertising: false })
  useEffect(() => {
    if (!getCookieConsent()) setOpen(true)
    const reopen = () => {
      const c = getCookieConsent()
      if (c) setChoices({ analytics: !!c.analytics, functional: !!c.functional, advertising: !!c.advertising })
      setCustomizing(true); setOpen(true)
    }
    window.addEventListener('relivr:cookie-prefs', reopen)
    return () => window.removeEventListener('relivr:cookie-prefs', reopen)
  }, [])
  if (!open) return null
  const save = (c) => {
    try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, necessary: true, ...c, ts: Date.now() })) } catch { /* storage blocked */ }
    setOpen(false); setCustomizing(false)
  }
  const Toggle = ({ k, label, desc, locked }) => (
    <label style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'7px 0', cursor: locked ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={locked ? true : choices[k]} disabled={locked}
        onChange={e => setChoices(s => ({ ...s, [k]: e.target.checked }))} style={{ marginTop:3, accentColor:'var(--accent)' }} />
      <span>
        <span style={{ fontWeight:600, fontSize:'.82rem' }}>{label}</span>
        {locked && <span style={{ fontSize:'.64rem', color:'var(--text-muted)', marginLeft:6, fontFamily:'var(--fm)', textTransform:'uppercase', letterSpacing:'.06em' }}>always on</span>}
        <br /><span style={{ fontSize:'.74rem', color:'var(--text-muted)', lineHeight:1.5 }}>{desc}</span>
      </span>
    </label>
  )
  return (
    <div role="dialog" aria-label="Cookie preferences" style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:1200, background:'var(--bg-surface)', borderTop:'1px solid var(--border)', boxShadow:'0 -4px 24px rgba(19,17,24,.14)', padding:'16px 20px' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ flex:1, minWidth:240 }}>
            <div style={{ fontWeight:700, fontSize:'.95rem', marginBottom:4 }}>🍪 Cookies on ReLivR</div>
            <p style={{ fontSize:'.82rem', color:'var(--text-secondary)', lineHeight:1.6, margin:0 }}>
              We use strictly necessary technologies to keep you signed in, plus optional analytics. Accept all, reject non-essential, or customise — see our <a href="/cookies" style={{ color:'var(--accent)', fontWeight:600 }}>Cookie Policy</a>.
            </p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Btn variant="ghost" size="sm" onClick={() => setCustomizing(c => !c)}>Customise</Btn>
            <Btn variant="secondary" size="sm" onClick={() => save({ analytics:false, functional:false, advertising:false })}>Reject non-essential</Btn>
            <Btn size="sm" onClick={() => save({ analytics:true, functional:true, advertising:true })}>Accept all</Btn>
          </div>
        </div>
        {customizing && (
          <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:10 }}>
            <Toggle locked label="Strictly necessary" desc="Required to sign in and keep the Platform secure." />
            <Toggle k="analytics" label="Analytics & performance" desc="Help us understand usage so we can improve ReLivR." />
            <Toggle k="functional" label="Functional" desc="Remember your preferences and settings." />
            <Toggle k="advertising" label="Advertising & marketing" desc="Not currently used — reserved for the future, only with your consent." />
            <div style={{ marginTop:10 }}><Btn size="sm" onClick={() => save(choices)}>Save preferences</Btn></div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE LANDING — a purpose-built phone design (not the desktop page reflowed).
// App-store cadence: sticky compact header, thumb-first CTAs, a live-feed glimpse,
// a segmented "How it works", single-column feature list, and a sticky bottom CTA.
// Rendered by App only when useIsMobile() is true.
// ─────────────────────────────────────────────────────────────────────────────
function MobileLanding({ onOpenAuth, onNav }) {
  const [track, setTrack] = useState('you') // 'you' | 'biz'
  const steps = track === 'you' ? STEPS_DATA : BIZ_STEPS_DATA

  const primaryBtn = { width:'100%', padding:'16px', borderRadius:15, border:'none', background:'var(--accent)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.02rem', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 8px 22px var(--accent-glow)' }
  const ghostBtn   = { width:'100%', padding:'16px', borderRadius:15, background:'var(--bg-surface)', color:'var(--text-primary)', border:'1px solid var(--border-strong)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.02rem', cursor:'pointer' }
  const eyebrow    = { display:'block', fontFamily:'var(--font-mono)', fontSize:'.62rem', fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--accent)', marginBottom:12 }
  const h2         = { fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.5rem', letterSpacing:'-.02em', lineHeight:1.15, margin:'0 0 20px' }
  const proof      = [{ v:'R0', l:'to start' }, { v:'~24h', l:'to first bid' }, { v:'Free', l:'while in beta' }]

  return (
    <div style={{ background:'var(--bg-base)', paddingBottom:'calc(92px + env(safe-area-inset-bottom))' }}>
      {/* Sticky header */}
      <header style={{ position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', background:'color-mix(in srgb, var(--bg-base) 85%, transparent)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <LogoMark size={26} /><span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.15rem', letterSpacing:'-.01em' }}>ReLivR</span>
        </span>
        <button onClick={() => onOpenAuth('login')} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:100, padding:'7px 16px', color:'var(--text-primary)', fontWeight:600, fontSize:'.86rem', cursor:'pointer' }}>Sign in</button>
      </header>

      {/* Hero — corporate: flat white ground, ink type, no decorative glow */}
      <section style={{ position:'relative', padding:'34px 22px 30px', overflow:'hidden' }}>
        <div style={{ position:'relative' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:20 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--verified)' }} />
            <span style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text-secondary)', letterSpacing:'.06em', textTransform:'uppercase' }}>Proudly South African · Beta</span>
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(2.5rem,12vw,3.15rem)', lineHeight:1.04, letterSpacing:'-.04em', margin:'0 0 16px' }}>
            Help around<br />the corner.
          </h1>
          <p style={{ fontSize:'1.06rem', color:'var(--text-secondary)', lineHeight:1.58, margin:'0 0 26px', maxWidth:'19rem' }}>
            Book trusted, ID-verified neighbours in Makhanda for anything on your list.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <button style={primaryBtn} onClick={() => onOpenAuth('register')}>Post a task — it’s free <Icon name="arrow" size={18} /></button>
            <button style={ghostBtn} onClick={() => onOpenAuth('register')}>Start earning</button>
          </div>
          <p style={{ marginTop:16, fontSize:'.78rem', color:'var(--text-muted)', textAlign:'center' }}>No card needed · Free to post · Free while in beta</p>
        </div>
      </section>

      {/* Proof — a clean 3-up card (short labels, one line each) */}
      <section style={{ padding:'4px 22px 0' }}>
        <div style={{ display:'flex', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-sm)', overflow:'hidden' }}>
          {proof.map((s,i) => (
            <div key={i} style={{ flex:1, textAlign:'center', padding:'17px 6px', borderLeft:i>0?'1px solid var(--border)':'none' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.32rem', letterSpacing:'-.02em', color:'var(--accent)' }}>{s.v}</div>
              <div style={{ fontSize:'.66rem', color:'var(--text-muted)', marginTop:4, lineHeight:1.3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live-feed glimpse */}
      <section style={{ padding:'40px 22px' }}>
        <span style={eyebrow}>Live near you</span>
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-sm)', overflow:'hidden' }}>
          {TASK_EXAMPLES.slice(0,3).map((t,i) => (
            <div key={i} style={{ padding:'15px 16px', borderBottom:i<2?'1px solid var(--border)':'none', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:'.94rem', marginBottom:6 }}>{t.title}</div>
                <div style={{ display:'flex', gap:5 }}>{t.tags.slice(0,2).map(tag => <span key={tag} style={{ background:'var(--bg-elevated)', color:'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:'.56rem', padding:'3px 8px', borderRadius:'var(--radius-sm)', textTransform:'uppercase', letterSpacing:'.05em' }}>{tag}</span>)}</div>
              </div>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.05rem', flexShrink:0 }}>{t.budget}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — banded, segmented */}
      <section style={{ padding:'44px 22px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
        <span style={eyebrow}>How it works</span>
        <h2 style={h2}>Two ways to use ReLivR</h2>
        <div style={{ display:'flex', gap:4, background:'var(--bg-elevated)', borderRadius:13, padding:5, marginBottom:26 }}>
          {[['you','For you'],['biz','For business']].map(([k,label]) => (
            <button key={k} onClick={() => setTrack(k)}
              style={{ flex:1, padding:'11px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:'.9rem', fontFamily:'var(--font-display)', background:track===k?'var(--bg-surface)':'transparent', color:track===k?'var(--accent)':'var(--text-muted)', boxShadow:track===k?'var(--shadow-sm)':'none', transition:'all 150ms ease' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {steps.map((s,i) => (
            <div key={i} style={{ display:'flex', gap:15, alignItems:'flex-start' }}>
              <span style={{ flexShrink:0, width:34, height:34, borderRadius:'50%', background:'var(--accent-glow)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'.95rem' }}>{s.n.replace(/^0/,'')}</span>
              <div style={{ paddingTop:3 }}>
                <div style={{ fontWeight:700, fontSize:'1.02rem', marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:'.9rem', color:'var(--text-secondary)', lineHeight:1.55 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature list */}
      <section style={{ padding:'44px 22px' }}>
        <span style={eyebrow}>Why ReLivR</span>
        <h2 style={h2}>Everything you need</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:1, border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', background:'var(--border)' }}>
          {FEATURES_DATA.map((f,i) => (
            <div key={i} style={{ display:'flex', gap:15, alignItems:'center', padding:'16px', background:'var(--bg-surface)' }}>
              <span style={{ flexShrink:0, width:42, height:42, borderRadius:12, background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={f.icon} size={21} color="var(--accent)" /></span>
              <div>
                <div style={{ fontWeight:700, fontSize:'.96rem', marginBottom:3 }}>{f.title}</div>
                <div style={{ fontSize:'.83rem', color:'var(--text-muted)', lineHeight:1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA — tinted band */}
      <section style={{ padding:'52px 22px', textAlign:'center', background:'var(--bg-surface)', borderTop:'1px solid var(--border)' }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.7rem', letterSpacing:'-.02em', lineHeight:1.12, margin:'0 0 12px' }}>Ready to join your local economy?</h2>
        <p style={{ fontSize:'.94rem', color:'var(--text-secondary)', margin:'0 0 24px' }}>Free to start · No credit card · Free while in beta</p>
        <button style={primaryBtn} onClick={() => onOpenAuth('register')}>Get started free</button>
      </section>

      {/* Footer */}
      <footer style={{ padding:'26px 22px 34px', textAlign:'center' }}>
        <div style={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:'12px 20px', marginBottom:16 }}>
          {[['how-it-works-page','How it works'],['pricing-page','Pricing'],['terms','Terms'],['privacy','Privacy'],['help-centre','Help']].map(([v,l]) => (
            <button key={v} onClick={() => onNav(v)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'.82rem', cursor:'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:'.66rem', color:'var(--text-muted)', letterSpacing:'.04em' }}>© 2026 ReLivR · Proudly South African</div>
      </footer>

      {/* Sticky bottom CTA bar */}
      <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:60, padding:'12px 16px calc(12px + env(safe-area-inset-bottom))', background:'color-mix(in srgb, var(--bg-surface) 90%, transparent)', backdropFilter:'blur(14px)', borderTop:'1px solid var(--border)' }}>
        <button style={primaryBtn} onClick={() => onOpenAuth('register')}>Get started — it’s free</button>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser]         = useState(null)
  // Google signups still owe us the onboarding questions (set from the OAuth
  // redirect params or a session restore with onboarded_at missing).
  const [pendingOnboarding, setPendingOnboarding] = useState(false)
  const [userLoading, setUserLoading] = useState(true) // true while restoring session
  const initialLoc = parseLocation()
  const [view, setView] = useState(initialLoc.view)
  const isMobile = useIsMobile()
  // Dark mode: device preference, persisted (rl_theme survives logout on purpose).
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('rl_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') } catch { return 'light' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('rl_theme', theme) } catch { /* ignore */ }
  }, [theme])
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const [authModal, setAuthModal] = useState(null)
  const [dashPage, setDashPage]   = useState(initialLoc.dashPage || 'tasks-browse')
  const [selectedTask,    setSelectedTask]    = useState(initialLoc.taskId || null)
  const [selectedDispute, setSelectedDispute] = useState(initialLoc.disputeId || null)
  const [selectedUser,    setSelectedUser]    = useState(initialLoc.userId || null)
  useEffect(() => { window.__rlProfileId = selectedUser }, [selectedUser])
  // { userId, name } of a person to start/open a conversation with (set from TaskDetail)
  const [messageTarget,   setMessageTarget]   = useState(null)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Live unread-notification count — polls the backend so the bell badge
  // stays current across the whole app (falls back to mock store if offline)
  const [unreadCount, setUnreadCount] = useState(state.notifications.filter(n => !n.is_read).length)
  useEffect(() => {
    if (!user) return
    let stop = false
    async function pollUnread() {
      try {
        const res = await fetch(API_BASE + '/notifications?unread_only=true', {
          headers: { Authorization: `Bearer ${localStorage.getItem('rl_token')}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!stop) setUnreadCount(data.unread_count ?? (data.notifications?.length || 0))
      } catch {
        if (!stop) setUnreadCount(state.notifications.filter(n => !n.is_read).length)
      }
    }
    pollUnread()
    const id = setInterval(pollUnread, 15000)
    return () => { stop = true; clearInterval(id) }
  }, [user]) // eslint-disable-line

  // ── Presence heartbeat (Batch 4) ────────────────────────────────────────────
  // Keeps a logged-in provider showing as "online" in the Available-Now rail while
  // they idle on a page. Only fires when the tab is visible, so a backgrounded tab
  // correctly goes stale. requireAuth bumps last_seen_at on the ping.
  useEffect(() => {
    if (!user) return
    async function beat() {
      if (document.visibilityState !== 'visible') return
      try {
        await fetch(API_BASE + '/availability/heartbeat', {
          method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('rl_token')}` },
        })
      } catch { /* offline — presence will simply go stale */ }
    }
    beat()
    const id = setInterval(beat, 180000) // every 3 min; the 5-min online window absorbs a miss
    return () => clearInterval(id)
  }, [user]) // eslint-disable-line

  // ── Student email verification link (Batch 6) ───────────────────────────────
  // The emailed link opens /verify-student?token=…; verify (public endpoint),
  // stash a toast, and bounce to a clean URL. Works logged-in or out.
  useEffect(() => {
    if (window.location.pathname !== '/verify-student') return
    const finish = (msg, kind) => {
      try { sessionStorage.setItem('rl_pending_toast', JSON.stringify({ msg, kind })) } catch { /* ignore */ }
      window.history.replaceState({}, '', localStorage.getItem('rl_token') ? '/profile' : '/')
      window.dispatchEvent(new Event('relivr:pending-toast'))
    }
    const t = new URLSearchParams(window.location.search).get('token')
    if (!t) { finish('That verification link is missing its token.', 'error'); return }
    fetch(API_BASE + '/auth/student-email/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })).catch(() => ({ ok: r.ok, d: {} })))
      .then(({ ok, d }) => finish(ok ? (d.message || 'Student email verified — perks unlocked!') : (d.message || 'This verification link is invalid or expired.'), ok ? 'success' : 'error'))
      .catch(() => finish('Could not reach the server to verify. Try the link again.', 'error'))
  }, []) // eslint-disable-line

  // ── Session restore on every page load ──────────────────────────────────────
  // Reads the JWT from localStorage, validates it, and fetches the user's
  // current profile from the backend. If the token is expired or invalid,
  // it clears everything and shows the landing page.
  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem('rl_token')
      if (!token) {
        // No session — if they landed on a private dashboard URL, send them home to log in
        const loc = parseLocation()
        if (loc.view === 'dashboard') { setView('landing'); window.history.replaceState({}, '', '/') }
        setUserLoading(false)
        return
      }

      // Hydrate identity from the cached rl_user so the app can render even when
      // /auth/me can't be reached right now (cold backend, flaky network). The
      // token stays in place; per-request auth still happens on every API call.
      const hydrateFromCache = () => {
        try {
          const cached = JSON.parse(localStorage.getItem('rl_user') || 'null')
          if (cached && cached.role) setUser({ ...cached, popia_consent: cached.popia_consent !== false })
        } catch { /* ignore */ }
      }

      // Defensively decode the JWT payload first, OUTSIDE the network try/catch.
      // A token that isn't a well-formed JWT (e.g. a legacy fake 'demo-token') is
      // invalid — clear it and show landing rather than hydrating a dead session.
      let payload = null
      try { payload = JSON.parse(atob(token.split('.')[1] || '')) } catch { payload = null }
      if (!payload || typeof payload !== 'object') {
        localStorage.removeItem('rl_token')
        localStorage.removeItem('rl_user')
        const loc = parseLocation()
        if (loc.view === 'dashboard') { setView('landing'); window.history.replaceState({}, '', '/') }
        setUserLoading(false)
        return
      }

      try {
        // Check token isn't expired
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('rl_token')
          localStorage.removeItem('rl_user')
          const loc = parseLocation()
          if (loc.view === 'dashboard') { setView('landing'); window.history.replaceState({}, '', '/') }
          setUserLoading(false)
          return
        }

        // Fetch fresh user profile from backend
        const res = await fetch(API_BASE + '/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          const u = data.user
          setUser({
            userId:      u.user_id,
            email:       u.email,
            role:        u.role,
            displayName: u.display_name || u.email?.split('@')[0] || 'User',
            avatarUrl:   u.avatar_url   || u.google_avatar_url || null,
            provider:    u.google_id ? 'google' : 'email',
            popia_consent: u.popia_consent !== false,
          })
          // Onboarding state: keep the walkthrough intent fresh, and re-offer the
          // onboarding questions to anyone who bailed mid-flow (Google signups).
          if (u.intent) { try { localStorage.setItem('rl_intent', u.intent) } catch { /* ignore */ } }
          if (u.google_id && !u.onboarded_at && u.role !== 'admin' && u.role !== 'business') setPendingOnboarding(true)
          // Logged-in users must not see the landing page — redirect to app.
          // A pending QR-scan deep-link (rl_pending_biz) sends them to Local instead.
          const loc = parseLocation()
          if (loc.view === 'landing') {
            const home = u.role === 'admin' ? 'dashboard' : 'tasks-browse'
            setView('dashboard')
            setDashPage(homeAfterAuth(u.role, home))
          }
        } else if (res.status === 401 || res.status === 403) {
          // Token genuinely rejected (expired/revoked) — clear and go to landing.
          localStorage.removeItem('rl_token')
          localStorage.removeItem('rl_user')
          const loc = parseLocation()
          if (loc.view === 'dashboard') { setView('landing'); window.history.replaceState({}, '', '/') }
        } else {
          // Transient server error (5xx/timeout) — keep the session, hydrate
          // from cache so a cold backend doesn't bounce the user to landing.
          hydrateFromCache()
        }
      } catch {
        // Network error or malformed response — transient. Keep the token and
        // hydrate from cache rather than silently logging the user out.
        hydrateFromCache()
      } finally {
        setUserLoading(false)
      }
    }
    restoreSession()
  }, [])

  // Keep the browser URL in sync with the current view (so refresh & deep-links work)
  useEffect(() => {
    if (view === 'oauth-callback') return
    const target = buildPath({ view, dashPage, taskId: selectedTask, disputeId: selectedDispute })
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target)
    }
    // Refresh SEO title/description/canonical to match the route we just rendered.
    applyRouteMeta(view)
  }, [view, dashPage, selectedTask, selectedDispute])

  // Handle browser back/forward — re-derive state from the URL
  useEffect(() => {
    function onPop() {
      const loc = parseLocation()
      setView(loc.view)
      if (loc.dashPage) setDashPage(loc.dashPage)
      setSelectedTask(loc.taskId || null)
      setSelectedDispute(loc.disputeId || null)
      setSelectedUser(loc.userId || null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ── Persist user to localStorage so sidebar always has latest info ──────────
  function saveUser(u) {
    if (!u) { localStorage.removeItem('rl_user'); return }
    localStorage.setItem('rl_user', JSON.stringify(u))
    setUser(u)
  }

  // ── Called after email/password login or registration ───────────────────────
  function handleLogin(rawUser) {
    const u = {
      userId:      rawUser.userId      || rawUser.user_id,
      email:       rawUser.email,
      role:        rawUser.role,
      displayName: rawUser.displayName || rawUser.display_name || rawUser.email?.split('@')[0] || 'User',
      avatarUrl:   rawUser.avatarUrl   || rawUser.avatar_url   || null,
      provider:    'email',
    }
    localStorage.setItem('rl_token', rawUser.token || '')
    saveUser(u)
    setView('dashboard')
    setDashPage(homeAfterAuth(u.role, u.role === 'admin' ? 'dashboard' : 'tasks-browse'))
    setAuthModal(null)
  }

  // ── Called after Google OAuth redirect ──────────────────────────────────────
  function handleOAuthCallback(params) {
    try {
      const token       = params.get('token')
      const userId      = params.get('userId')
      const email       = params.get('email')
      const role        = params.get('role')
      const displayName = params.get('displayName') || email?.split('@')[0] || 'User'
      const avatarUrl   = params.get('avatarUrl') || null
      const needsConsent = params.get('needsConsent') === '1'
      const needsOnboarding = params.get('needsOnboarding') === '1'

      if (!token || !userId) return false

      localStorage.setItem('rl_token', token)
      saveUser({ userId, email, role, displayName, avatarUrl, provider: 'google',
                 popia_consent: !needsConsent })
      // First-time (or mid-flow) Google users owe the onboarding questions —
      // the modal handles POPIA consent too, so it covers needsConsent as well.
      if (needsOnboarding || needsConsent) setPendingOnboarding(true)
      setView('dashboard')
      setDashPage(homeAfterAuth(role, role === 'admin' ? 'dashboard' : 'tasks-browse'))
      setAuthModal(null)
      return true
    } catch {
      return false
    }
  }

  // ── Logout — clears everything and returns to landing ───────────────────────
  function logout() {
    // Tell auth service to destroy the session (non-blocking)
    const token = localStorage.getItem('rl_token')
    if (token) {
      fetch(API_BASE + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    // Clear all stored state — including per-user keys, so nothing from this
    // account (intent, draft handoffs, pending deep-links) leaks to the next
    // person who signs in on this browser.
    localStorage.removeItem('rl_token')
    localStorage.removeItem('rl_user')
    localStorage.removeItem('rl_intent')
    sessionStorage.removeItem('rl_view')
    sessionStorage.removeItem('rl_edit_draft')
    sessionStorage.removeItem('rl_pending_biz')
    sessionStorage.removeItem('rl_pending_toast')
    setUser(null)
    setPendingOnboarding(false)
    setView('landing')
    setDashPage('tasks-browse')
    setSelectedTask(null)
    setAuthModal(null)
    window.history.pushState({}, '', '/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const authValue = {
    user,
    userLoading,
    handleOAuthCallback,
    handleLogin,
    // Merge-and-persist a partial update to the signed-in user (e.g. a new avatar)
    // so every render site — top bar, profile, menus — reflects it immediately and
    // it survives a reload via the cached rl_user.
    updateUser: (patch) => setUser(u => { const next = { ...u, ...patch }; try { localStorage.setItem('rl_user', JSON.stringify(next)) } catch { /* ignore */ } return next }),
    // Go straight to the backend so the OAuth redirect works in production.
    // (In dev API_BASE is '' and Vite proxies /auth → localhost:3001.)
    loginWithGoogle: () => { window.location.href = API_BASE + '/auth/google' },
    logout,
  }
  const storeValue = { state, dispatch }

  // Info/legal/product pages — all routed through setView
  const INFO_PAGES = Object.values(INFO_ROUTES)

  // The in-app "home" page depends on role — earners/creators land on the feed,
  // admins on their dispute queue. Used by the logo and the bottom-nav home tab.
  function appHome() {
    if (!user) return 'tasks-browse'
    if (user.role === 'admin') return 'dashboard'
    return 'tasks-browse'
  }
  function goAppHome() {
    setSelectedTask(null)
    setDashPage(appHome())
    setView('dashboard')
    window.scrollTo({ top:0, behavior:'smooth' })
  }
  // Landing-page CTAs: if already logged in, enter the app; otherwise open auth modal
  function openAuth(mode) {
    if (user) { goAppHome(); return }
    setAuthModal(mode)
  }

  function navigate(target) {
    if (target==='home')      { if (user) { goAppHome(); return } setView('landing'); window.scrollTo({top:0,behavior:'smooth'}); return }
    if (target==='dashboard') { if (user) setView('dashboard'); else setAuthModal('login'); return }
    if (INFO_PAGES.includes(target)) { setView(target); window.scrollTo({top:0,behavior:'smooth'}); return }
    setView('landing')
  }

  function renderInfoPage() {
    const props = { onNav: navigate }
    switch (view) {
      case 'how-it-works-page': return <HowItWorksPage   {...props} />
      case 'features-page':     return <FeaturesPage      {...props} />
      case 'pricing-page':      return <PricingPage        {...props} onOpenAuth={setAuthModal} />
      case 'trust-safety':      return <TrustSafetyPage   {...props} />
      case 'terms':             return <TermsPage          {...props} />
      case 'privacy':           return <PrivacyPage        {...props} />
      case 'cookies':           return <CookiesPage        {...props} />
      case 'popia':             return <POPIAPage           {...props} />
      case 'help-centre':       return <HelpCentrePage     {...props} />
      case 'contact':           return <ContactPage         {...props} />
      case 'report':            return <ReportPage          {...props} />
      case 'guidelines':        return <GuidelinesPage      {...props} />
      case 'about-page':        return <ComingSoonPage title="About ReLivR" subtitle="Company" onNav={navigate} />
      case 'blog':              return <ComingSoonPage title="Blog"             subtitle="Company" onNav={navigate} />
      case 'careers':           return <ComingSoonPage title="Careers"          subtitle="Company" onNav={navigate} />
      default:                  return null
    }
  }

  function renderDashPage() {
    switch (dashPage) {
      case 'dashboard':            return user.role==='admin' ? <AdminDashboard /> : <Dashboard setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'tasks-browse':         return <TaskBrowse setPage={setDashPage} setSelectedTask={setSelectedTask} openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />
      case 'search':               return <SearchResults query={searchQuery} setPage={setDashPage} setSelectedTask={setSelectedTask} openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />

      case 'task-detail':          return <TaskDetail taskId={selectedTask} setPage={setDashPage} openChat={(userId, name) => { setMessageTarget({ userId, name }); setDashPage('messages') }} openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />
      case 'tasks-new':            return <TaskNew setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'tasks-mine':           return <MyTasks setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'my-bids':              return <MyBids setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'my-orders':            return <MyOrders openBusiness={(bid) => { try { sessionStorage.setItem('rl_pending_biz', bid) } catch { /* noop */ } setDashPage('local-browse') }} />
      case 'suggestions':          return <Suggestions setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'messages':             return <Messages target={messageTarget} clearTarget={() => setMessageTarget(null)} />
      case 'notifications':        return <Notifications setPage={setDashPage} setSelectedTask={setSelectedTask} openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />
      case 'profile':              return <Profile openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />
      case 'public-profile':       return <PublicProfile userId={selectedUser} setPage={setDashPage} openChat={(uid, name) => { setMessageTarget({ userId: uid, name }); setDashPage('messages') }} />
      case 'admin-disputes':       return <AdminDisputes setPage={setDashPage} setSelectedDispute={setSelectedDispute} />
      case 'admin-dispute-detail': return <AdminDisputeDetail disputeId={selectedDispute} setPage={setDashPage} />
      case 'admin-users':          return <AdminUsers />
      case 'admin-locations':      return <AdminLocations />
      case 'admin-flags':          return <AdminFlags />
      case 'local-browse':         return <LocalBrowse setPage={setDashPage} />
      case 'deals':                return <DealsPage />
      case 'schedule':             return <SchedulePage />
      case 'following':            return <FollowingPage openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} setPage={setDashPage} />
      case 'admin-deals':          return <AdminDeals />
      case 'admin-tasks':          return <AdminTasks />
      case 'admin-audit':          return <AdminAudit />
      case 'admin-businesses':     return <AdminBusinesses />
      default:                     return <Dashboard setPage={setDashPage} setSelectedTask={setSelectedTask} />
    }
  }
  // While restoring session from localStorage, show a minimal loading screen
  // so the user doesn't see a flash of the landing page before the dashboard loads
  if (userLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg-base)' }}>
        <LogoLoader size={84} />
      </div>
    )
  }

  return (
    <AuthCtx.Provider value={authValue}>
      <StoreCtx.Provider value={storeValue}>
        <ToastProvider>

          <PendingToast />

          {/* ── OAUTH CALLBACK — must be inside AuthCtx so useAuth() works ── */}
          {view === 'oauth-callback' && <OAuthCallback />}

          {/* ── LANDING PAGE ─────────────────────────────────── */}
          {view==='landing' && isMobile && (
            <MobileLanding onOpenAuth={openAuth} onNav={navigate} />
          )}

          {view==='landing' && !isMobile && (
            <div>
              <LandingNavbar onOpenAuth={openAuth} onNav={navigate} user={user} onEnterApp={goAppHome} />
              <RevealObserver />
              <Hero         onOpenAuth={openAuth} />
              <LaunchSection />
              <StatsBar />
              <CampusStrip />
              <HowItWorks />
              <Features />
              <LiveTasks    onOpenAuth={openAuth} />
              <Pricing      onOpenAuth={openAuth} />
              <Testimonials />
              <LandingAbout />
              <FeedbackSection />
              <LandingCTA   onOpenAuth={openAuth} />
              <LandingFooter onNav={navigate} />
            </div>
          )}

          {/* ── INFO / LEGAL / PRODUCT PAGES ─────────────────── */}
          {INFO_PAGES.includes(view) && (
            <div>
              <LandingNavbar onOpenAuth={openAuth} onNav={navigate} user={user} onEnterApp={goAppHome} />
              {renderInfoPage()}
              <LandingFooter onNav={navigate} />
            </div>
          )}

          {/* ── DASHBOARD ────────────────────────────────────── */}
          {/* Pre-launch lock: only admins reach the real app. Everyone else who
              signs in/up lands on the founding-member holding screen instead. */}
          {view==='dashboard' && user && isAppLocked(user) && (
            <>
              <LaunchGate user={user} onLogout={logout} onViewLanding={() => navigate('landing')} />
              {/* New signups wait here until launch — the guided tour must be
                  available (and auto-offer once) on this screen, not just in-app. */}
              <OnboardingWalkthrough />
            </>
          )}
          {/* Business partners get their own self-contained dashboard surface. */}
          {view==='dashboard' && user && !isAppLocked(user) && user.role==='business' && (
            <BusinessDashboard onLogout={logout} onViewLanding={() => navigate('landing')} theme={theme} onToggleTheme={toggleTheme} />
          )}
          {view==='dashboard' && user && !isAppLocked(user) && user.role!=='business' && (
            <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)' }}>
              <TopBar page={dashPage} setPage={setDashPage} unreadCount={unreadCount} onGoHome={goAppHome} onViewLanding={() => navigate('landing')} onSearch={(q) => { setSearchQuery(q); setDashPage('search') }} theme={theme} onToggleTheme={toggleTheme} />
              <main className="dash-main" style={{ flex:1, width:'100%', maxWidth:1280, margin:'0 auto', padding:'28px 24px 60px' }}>
                {renderDashPage()}
              </main>
              <OnboardingWalkthrough />
            </div>
          )}

          {/* Google onboarding — first-time Google users answer the same questions
              email signups get in the modal (consent + intent + campus). Shows over
              the LaunchGate too: founding members complete their profile pre-launch. */}
          {user && pendingOnboarding && (
            <GoogleOnboardingModal
              user={user}
              onDone={() => {
                setUser(u => ({ ...u, popia_consent: true }))
                setPendingOnboarding(false)
              }}
            />
          )}

          {/* POPIA consent gate — blocks the app until consent is explicitly given
              (chiefly the Google path, which can't capture consent at OAuth).
              Safety net only: the onboarding modal above normally captures consent.
              Suppressed while the launch gate is up — they'll consent at launch. */}
          {user && user.popia_consent === false && !isAppLocked(user) && !pendingOnboarding && (
            <ConsentGate
              onConsented={() => setUser(u => ({ ...u, popia_consent: true }))}
              onDecline={logout}
              onViewPrivacy={() => navigate('privacy')}
            />
          )}

          {/* ── AUTH MODAL (accessible from any view) ────────── */}
          {authModal && (
            <AuthModal
              mode={authModal}
              onClose={() => setAuthModal(null)}
              onSwitch={() => setAuthModal(m => m==='login'?'register':'login')}
              onLogin={handleLogin}
            />
          )}

          {/* ── COOKIE CONSENT (POPIA) — shows on first visit, re-openable ── */}
          <CookieConsent />

        </ToastProvider>
      </StoreCtx.Provider>
    </AuthCtx.Provider>
  )
}
