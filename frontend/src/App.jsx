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
import {
  MOCK_TASKS, MOCK_BIDS, MOCK_NOTIFICATIONS,
  MOCK_MESSAGES, MOCK_DISPUTES, MOCK_SUGGESTIONS,
} from './api/mock'

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
_fl.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,400&family=DM+Mono:wght@400;500&display=swap'
document.head.appendChild(_fl)

const _style = document.createElement('style')
_style.textContent = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --black:         #211c2e;
  --white:         #faf9f6;
  --amber:         #5b21b6;
  --amber2:        #4c1d95;
  --green:         #15803d;
  --red:           #b91c1c;
  --blue:          #1d4ed8;
  --purple:        #b45309;
  --highlight:     #ffd84d;
  --bg-base:       #faf9f6;
  --bg-surface:    #ffffff;
  --bg-elevated:   #f3f1ec;
  --bg-hover:      #ebe8e1;
  --border:        #e7e4dc;
  --border-strong: #d5d1c6;
  --text-primary:  #211c2e;
  --text-secondary:#5a5468;
  --text-muted:    #948f9e;
  --accent:        #5b21b6;
  --accent-dim:    #ece4fb;
  --accent-glow:   rgba(91,33,182,0.10);
  --success:       #15803d;
  --danger:        #b91c1c;
  --info:          #1d4ed8;
  --warning:       #b45309;
  --font-display:  'Bricolage Grotesque', sans-serif;
  --font-body:     'DM Sans', sans-serif;
  --font-mono:     'DM Mono', monospace;
  --fd: 'Bricolage Grotesque', sans-serif;
  --fb: 'DM Sans', sans-serif;
  --fm: 'DM Mono', monospace;
  --surface:       #ffffff;
  --surface2:      #f3f1ec;
  --muted:         #948f9e;
  --radius-sm:     10px;
  --radius-md:     14px;
  --radius-lg:     20px;
  --radius-xl:     28px;
  --radius-pill:   999px;
  --transition:    150ms ease;
  --ease:          cubic-bezier(.4,0,.2,1);
  /* Soft, layered elevation scale — the backbone of the premium/clean feel */
  --shadow-xs:     0 1px 2px rgba(33,28,46,.05);
  --shadow-sm:     0 1px 3px rgba(33,28,46,.06), 0 1px 2px rgba(33,28,46,.04);
  --shadow-md:     0 6px 16px rgba(33,28,46,.07), 0 2px 6px rgba(33,28,46,.04);
  --shadow-lg:     0 16px 40px rgba(33,28,46,.10), 0 4px 12px rgba(33,28,46,.05);
  --shadow-xl:     0 30px 70px rgba(33,28,46,.14), 0 10px 24px rgba(33,28,46,.06);
  --ring:          0 0 0 3px rgba(91,33,182,.14);
}
html { scroll-behavior: smooth; font-size: 16px; }
body {
  background: var(--bg-base); color: var(--text-primary);
  font-family: var(--font-body); font-size: 15px; line-height: 1.6;
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
::selection { background: var(--amber); color: #fff; }
a { color: inherit; text-decoration: none; }
button { cursor: pointer; font-family: var(--font-body); border: none; }
/* Visible keyboard focus for a11y (mouse clicks don't trigger :focus-visible) */
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
a:focus-visible, button:focus-visible, [role="button"]:focus-visible,
input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input, textarea, select { font-family: var(--font-body); font-size: inherit; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--bg-base); }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

@keyframes slideUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
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
.slabel { font-family:var(--fm); font-size:.68rem; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--amber); display:flex; align-items:center; gap:8px; }
.slabel::before { content:''; display:block; width:18px; height:1px; background:var(--amber); }
.lcard { background:var(--bg-surface); border:1px solid var(--border); border-radius:16px; padding:28px; box-shadow:var(--shadow-xs); transition:border-color 200ms var(--ease),transform 200ms var(--ease),box-shadow 200ms var(--ease); }
.lcard:hover { border-color:var(--border-strong); transform:translateY(-4px); box-shadow:var(--shadow-lg); }
.photo-card img { transition:transform .55s var(--ease); will-change:transform; }
.photo-card:hover img { transform:scale(1.05); }
.btn-p { background:var(--amber); color:#fff; border:none; padding:13px 28px; border-radius:12px; font-family:var(--fd); font-weight:700; font-size:.9rem; letter-spacing:.01em; cursor:pointer; box-shadow:var(--shadow-sm); transition:all 160ms var(--ease); display:inline-flex; align-items:center; gap:7px; }
.btn-p:hover { background:var(--amber2); transform:translateY(-1px); box-shadow:0 10px 24px rgba(91,33,182,.26); }
.btn-p:active { transform:translateY(0); box-shadow:var(--shadow-sm); }
.btn-p:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
.btn-s { background:var(--bg-surface); color:var(--text-primary); border:1px solid var(--border-strong); padding:13px 28px; border-radius:12px; font-family:var(--fd); font-weight:700; font-size:.9rem; letter-spacing:.01em; cursor:pointer; transition:all 160ms var(--ease); }
.btn-s:hover { border-color:var(--text-primary); background:var(--bg-surface); box-shadow:var(--shadow-md); transform:translateY(-1px); }
.btn-g { background:transparent; color:var(--text-muted); border:none; padding:10px 18px; font-family:var(--font-body); font-size:.875rem; cursor:pointer; transition:color 150ms; }
.btn-g:hover { color:var(--text-primary); }

/* Forms */
input, textarea, select { background:var(--bg-elevated); border:1px solid var(--border-strong); border-radius:10px; color:var(--text-primary); padding:11px 14px; font-size:.9rem; width:100%; outline:none; transition:border-color 150ms,box-shadow 150ms; }
input:focus, textarea:focus, select:focus { border-color:var(--amber); box-shadow:var(--ring); }
input::placeholder, textarea::placeholder { color:#b3aebc; }
label { font-family:var(--fm); font-size:.62rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:.1em; display:block; margin-bottom:6px; }

/* Prose */
.prose h2 { font-family:var(--fd); font-size:1.3rem; font-weight:800; margin:32px 0 12px; color:var(--text-primary); }
.prose h3 { font-family:var(--fd); font-size:1.05rem; font-weight:700; margin:24px 0 8px; color:#3b3548; }
.prose p  { color:#5f5970; line-height:1.8; margin-bottom:16px; font-size:.925rem; }
.prose ul { color:#5f5970; line-height:1.8; margin-bottom:16px; padding-left:20px; font-size:.925rem; }
.prose li { margin-bottom:6px; }
.prose a  { color:var(--amber); }
.prose .highlight { background:rgba(91,33,182,.08); border:1px solid rgba(91,33,182,.2); border-radius:6px; padding:16px 20px; margin:20px 0; }
.prose .highlight p { color:#3b3548; margin:0; }
.prose table { width:100%; border-collapse:collapse; font-size:.875rem; margin-bottom:16px; }
.prose th { text-align:left; padding:8px 12px; font-family:var(--fm); font-size:.62rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:.1em; font-weight:400; border-bottom:1px solid var(--border-strong); }
.prose td { padding:10px 12px; color:#5f5970; border-bottom:1px solid var(--border); }

/* Drawer */
.drawer { position:fixed; top:0; right:0; bottom:0; width:280px; background:var(--bg-surface); border-left:1px solid var(--border-strong); z-index:200; padding:24px; transform:translateX(100%); transition:transform 300ms ease; overflow-y:auto; }
.drawer.open { transform:translateX(0); }
.doverlay { position:fixed; inset:0; background:rgba(33,28,46,.35); z-index:199; opacity:0; pointer-events:none; transition:opacity 300ms; }
.doverlay.open { opacity:1; pointer-events:all; }

/* Modal */
.moverlay { position:fixed; inset:0; background:rgba(33,28,46,.45); display:flex; align-items:center; justify-content:center; z-index:300; padding:16px; animation:fadeIn .2s ease; backdrop-filter:blur(6px); }
.modal { background:var(--bg-surface); border:1px solid var(--border-strong); border-radius:18px; width:100%; max-width:440px; animation:fadeUp .22s ease; overflow:hidden; max-height:92vh; overflow-y:auto; }

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
  /* Dashboard mobile bottom nav */
  .dash-shell   { grid-template-columns:1fr !important; }
  .dash-main    { padding:20px 16px 80px 16px !important; }
  .dash-sidebar { position:fixed !important; bottom:0 !important; left:0 !important; right:0 !important; top:auto !important; width:100% !important; height:64px !important; flex-direction:row !important; padding:0 8px !important; border-right:none !important; border-top:1px solid var(--border) !important; z-index:100 !important; overflow:hidden !important; }
  .sidebar-logo, .sidebar-status, .sidebar-user { display:none !important; }
  .dash-nav     { flex-direction:row !important; width:100% !important; justify-content:space-around !important; gap:0 !important; align-items:center !important; }
  .dash-nav-btn { flex-direction:column !important; gap:2px !important; padding:6px 8px !important; font-size:.55rem !important; min-height:52px !important; justify-content:center !important; align-items:center !important; border-left:none !important; border-top:2px solid transparent !important; }
  .dash-nav-btn.active { border-top-color:var(--accent) !important; border-left-color:transparent !important; }
}
@media (min-width:769px) {
  .show-m { display:none !important; }
}

/* ── Native PWA feel ── */
html, body { overscroll-behavior-y: contain; }
button, nav, .dash-nav-btn { -webkit-tap-highlight-color: transparent; }
button { touch-action: manipulation; user-select: none; }
button:active { transform: scale(.97); }
.feed-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.feed-scroll::-webkit-scrollbar { display: none; }
@media (max-width:768px) {
  input, textarea, select { font-size: 16px !important; } /* stops iOS auto-zoom */
  .dash-sidebar { height: calc(64px + env(safe-area-inset-bottom)) !important; padding-bottom: env(safe-area-inset-bottom) !important; }
  .dash-nav-btn:nth-child(n+6) { display: none !important; } /* native 5-tab bar */
  .msg-shell { height: calc(100dvh - 200px) !important; }
}
@media (min-width:769px) {
  .dash-sidebar { display:none !important; }
}

/* Top-bar nav: links + search are desktop-only; bottom bar handles mobile nav */
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

const initialState = {
  tasks:         MOCK_TASKS.map(t => ({ ...t })),
  bids:          MOCK_BIDS.map(b => ({ ...b })),
  notifications: MOCK_NOTIFICATIONS.map(n => ({ ...n })),
  messages:      MOCK_MESSAGES.map(m => ({ ...m })),
  disputes:      MOCK_DISPUTES.map(d => ({ ...d })),
  reviews:       [],
  escrows:       { '1': { status: 'pending' } },
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
    warning: { bg:'rgba(91,33,182,0.15)',  border:'rgba(91,33,182,0.4)',  icon:'⚠', color:'var(--accent)' },
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

function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', flexShrink:0 }}>
      <div style={{ background:'var(--amber)', color:'#fff', fontFamily:'var(--fd)', fontWeight:800, fontSize:'.88rem', padding:'4px 8px', borderRadius:8, letterSpacing:'.02em' }}>R</div>
      <span style={{ fontFamily:'var(--fd)', fontSize:'1.15rem', fontWeight:800, letterSpacing:'.02em' }}>ReLivR</span>
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
    warning:   { background:hov?'rgba(91,33,182,0.2)':'rgba(91,33,182,0.1)', color:'var(--accent)', border:'1px solid rgba(91,33,182,0.3)' },
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
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && <label style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-secondary)' }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', fontSize:'0.88rem', outline:'none', cursor:'pointer', ...style }}>{children}</select>
    </div>
  )
}

function Badge({ children, variant='default' }) {
  const map = {
    default:     { background:'var(--bg-elevated)',            color:'var(--text-secondary)' },
    open:        { background:'rgba(16,185,129,0.15)',         color:'var(--success)' },
    in_progress: { background:'rgba(59,130,246,0.15)',         color:'var(--info)' },
    disputed:    { background:'rgba(239,68,68,0.15)',          color:'var(--danger)' },
    completed:   { background:'rgba(91,33,182,0.15)',         color:'var(--accent)' },
    expired:     { background:'var(--bg-elevated)',            color:'var(--text-muted)' },
    admin:       { background:'rgba(239,68,68,0.15)',          color:'var(--danger)' },
    earner:      { background:'rgba(16,185,129,0.15)',         color:'var(--success)' },
    creator:     { background:'rgba(91,33,182,0.15)',         color:'var(--accent)' },
    pending:     { background:'rgba(59,130,246,0.12)',         color:'var(--info)' },
    accepted:    { background:'rgba(16,185,129,0.15)',         color:'var(--success)' },
    rejected:    { background:'var(--bg-elevated)',            color:'var(--text-muted)' },
    withdrawn:   { background:'var(--bg-elevated)',            color:'var(--text-muted)' },
  }
  const v = map[variant] || map.default
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-mono)', fontSize:'0.63rem', fontWeight:500, letterSpacing:'0.06em', textTransform:'uppercase', ...v }}>{children}</span>
}

function DCard({ children, style={}, onClick, hover=true, className='' }) {
  const [hov, setHov] = useState(false)
  return (
    <div className={className} onClick={onClick} onMouseEnter={() => hover&&setHov(true)} onMouseLeave={() => hover&&setHov(false)}
      style={{ background:'var(--bg-surface)', border:`1px solid ${hov?'var(--border-strong)':'var(--border)'}`, borderRadius:'var(--radius-md)', padding:20, transition:'all 150ms ease', ...(hover&&hov?{transform:'translateY(-2px)',boxShadow:'0 8px 32px rgba(33,28,46,.10)'}:{}), ...(onClick?{cursor:'pointer'}:{}), ...style }}>
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
    <span style={{ fontFamily:'var(--font-mono)', fontSize:'1rem', color:'#d97706', cursor:interactive?'pointer':'default', letterSpacing:2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} onMouseEnter={() => interactive&&setHov(i)} onMouseLeave={() => interactive&&setHov(0)} onClick={() => interactive&&onRate&&onRate(i)}
          style={{ color:i<=display?'#d97706':'var(--border-strong)', transition:'color 100ms ease' }}>★</span>
      ))}
      {!interactive && <span style={{ color:'var(--text-muted)', marginLeft:4, fontSize:'0.75rem' }}>{r.toFixed(1)}</span>}
    </span>
  )
}

function Divider({ style={} }) { return <div style={{ height:1, background:'var(--border)', width:'100%', ...style }} /> }

function PageTitle({ children, sub }) {
  return (
    <div style={{ marginBottom:28 }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2.4rem', fontWeight:700, letterSpacing:'-0.01em', lineHeight:1 }}>{children}</h1>
      {sub && <Mono style={{ marginTop:6, display:'block' }}>{sub}</Mono>}
    </div>
  )
}

function EmptyState({ icon='◻', message, action }) {
  return (
    <div style={{ textAlign:'center', padding:'56px 24px' }}>
      <div style={{ width:60, height:60, margin:'0 auto 14px', borderRadius:'50%', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', color:'var(--text-muted)' }}>{icon}</div>
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
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(33,28,46,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, backdropFilter:'blur(4px)', animation:'fadeIn 0.2s ease' }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={e => e.stopPropagation()} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, animation:'slideUp 0.2s ease both', overflow:'hidden', outline:'none' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <span id={titleId} style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', letterSpacing:'-0.01em' }}>{title}</span>
          <button onClick={onClose} aria-label="Close dialog" style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.2rem', cursor:'pointer', lineHeight:1, padding:'2px 6px', borderRadius:'var(--radius-sm)' }}>✕</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
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
      <div style={{ background:'var(--amber)', color:'#fff', textAlign:'center', padding:'7px 16px', fontSize:'.8rem', fontFamily:'var(--fb)', fontWeight:600, lineHeight:1.45 }}>
        🚀 ReLivR is in <strong>beta</strong> — full launch 7 July 2026.<span className="hide-m"> Your feedback shapes what we build.</span> Secure escrow payments coming soon.
      </div>
      <nav style={{ background:scrolled?'rgba(250,249,246,.92)':'rgba(250,249,246,.72)', borderBottom:scrolled?'1px solid var(--border-strong)':'1px solid transparent', backdropFilter:'blur(14px)', transition:'all 300ms ease', padding:'0 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <Logo onClick={() => onNav('home')} />
          <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:32 }}>
            {navItems.map(item => <a key={item.label} href={item.href} className="nav-link">{item.label}</a>)}
          </div>
          <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:10 }}>
            {user ? (
              <button className="btn-p" onClick={onEnterApp}>Open App →</button>
            ) : (
              <>
                <button className="btn-g" onClick={() => onOpenAuth('login')}>Sign In</button>
                <button className="btn-p" onClick={() => onOpenAuth('register')}>Get Started →</button>
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
    <footer style={{ borderTop:'1px solid var(--border)', padding:'60px 24px 28px', background:'var(--bg-surface)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="footer-grid" style={{ display:'grid', gridTemplateColumns:'2fr repeat(4,1fr)', gap:44, marginBottom:44 }}>
          <div>
            <Logo onClick={() => onNav('home')} />
            <p style={{ fontSize:'.875rem', color:'#7c7585', lineHeight:1.75, maxWidth:220, margin:'14px 0 16px' }}>The peer-to-peer service marketplace built for Rhodes University students.</p>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em' }}>Rhodes University · Makhanda, EC</div>
          </div>
          {Object.entries(links).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:14 }}>{cat}</div>
              {items.map(item => (
                <div key={item.label} style={{ marginBottom:9 }}>
                  <button onClick={() => item.page ? onNav(item.page) : item.href && window.open(item.href,'_blank')}
                    className="nav-link" style={{ background:'none', border:'none', fontSize:'.875rem', padding:0, textAlign:'left' }}>{item.label}</button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <Divider style={{ marginBottom:20 }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>© 2026 ReLivR · All rights reserved</span>
          <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <button onClick={openCookiePrefs} className="nav-link" style={{ background:'none', border:'none', padding:0, fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em', cursor:'pointer' }}>Cookie preferences</button>
            <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>POPIA Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── AUTH MODAL (unified — used from landing + dashboard sign out) ────────────

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

  const CAMPUS_ZONES = useLocations()

  // Reset to step 1 whenever the modal mode flips (login ⇄ register)
  useEffect(() => { setStep(1); setError('') }, [mode])

  function validateStep1() {
    if (mode==='register' && !name.trim()) return 'Please enter your name'
    if (!email.includes('@')) return 'Enter a valid email address'
    if (password.length < 8)  return 'Password must be at least 8 characters'
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
            <div style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', marginTop:2 }}>{mode==='register' ? `ReLivR · Step ${step} of 2` : 'ReLivR · Rhodes Campus'}</div>
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
                <div><label>Email</label><input type="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ru.ac.za" required /></div>
                <div><label>Password <span style={{ color:'var(--text-muted)' }}>(min 8 chars)</span></label><input type="password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
                <div style={{ background:'var(--accent-glow)', border:'1px solid var(--accent-dim)', borderRadius:12, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.1rem' }}>✨</span>
                  <div style={{ fontSize:'.8rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
                    With one ReLivR account you can <strong style={{ color:'var(--text-primary)' }}>post tasks</strong> when you need help and <strong style={{ color:'var(--text-primary)' }}>bid on tasks</strong> to earn — switch anytime.
                  </div>
                </div>
                <label style={{ display:'flex', gap:8, alignItems:'flex-start', cursor:'pointer' }}>
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width:'auto', marginTop:3, flexShrink:0, accentColor:'var(--accent)' }} />
                  <span style={{ fontSize:'.76rem', color:'var(--text-secondary)', lineHeight:1.5 }}>I agree to the <span style={{ color:'var(--accent)', fontWeight:600 }}>Terms of Service</span> and <span style={{ color:'var(--accent)', fontWeight:600 }}>Privacy Policy</span>, and consent to ReLivR processing my data under POPIA.</span>
                </label>
              </>
            )}

            {/* ===== REGISTER · STEP 2 — marketplace profile ===== */}
            {mode==='register' && step===2 && (
              <>
                <p style={{ fontSize:'.82rem', color:'var(--text-secondary)', lineHeight:1.5, margin:'0 0 4px' }}>
                  A complete profile gets you more tasks and better bids. You can skip and finish this later in your profile.
                </p>
                <div><label>Phone number <span style={{ color:'var(--text-muted)' }}>(optional)</span></label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 ..." /></div>
                <div>
                  <label>Campus residence / area</label>
                  <select value={campus} onChange={e => setCampus(e.target.value)}>
                    <option value="">Select your area…</option>
                    {CAMPUS_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div><label>Your skills <span style={{ color:'var(--text-muted)' }}>(comma separated)</span></label><input value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. python, tutoring, design" /></div>
                <div><label>Short bio <span style={{ color:'var(--text-muted)' }}>(optional)</span></label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell others what you’re good at…" style={{ resize:'vertical' }} />
                </div>
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
            <div style={{ textAlign:'center', fontSize:'.85rem', color:'#6d6678' }}>
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

const TASK_EXAMPLES = [
  { title:'Fix Python script crashing on import', budget:'R180', tags:['python','debugging'], time:'2h ago' },
  { title:'Proofread 3000-word essay',            budget:'R120', tags:['writing','editing'],  time:'4h ago' },
  { title:'Laundry pickup & delivery',            budget:'R80',  tags:['errands','delivery'], time:'1h ago' },
  { title:'React component for student portal',   budget:'R350', tags:['react','javascript'], time:'6h ago' },
  { title:'Guitar lesson — 1 hour',               budget:'R150', tags:['music','tutoring'],   time:'3h ago' },
  { title:'Translate doc Zulu → English',         budget:'R200', tags:['translation','lang'],  time:'5h ago' },
]

const FEATURES_DATA = [
  { icon:'⚡', title:'Post in 60 Seconds',   desc:'Describe your task, set a budget, and go live instantly. No lengthy forms, no approval process.' },
  { icon:'🎯', title:'Smart Matching',       desc:'Our engine surfaces your task to earners with the exact skills you need — automatically.' },
  { icon:'🔒', title:'Escrow Protection',    desc:'Funds are held securely until you confirm the work is done. No pay-and-pray.' },
  { icon:'⭐', title:'Trust Scores',         desc:'Every user builds a verified reputation. Know who you\'re working with before you commit.' },
  { icon:'💬', title:'Built-in Messaging',   desc:'Negotiate, clarify, and collaborate — all in one place without switching apps.' },
  { icon:'⚖️', title:'Dispute Resolution',  desc:'If something goes wrong, our admin team steps in. Fair outcomes, every time.' },
]

const STEPS_DATA = [
  { n:'01', role:'Creator', color:'var(--amber)', title:'Post Your Task',      desc:'Describe what you need, set a budget, add skill tags. Your task goes live immediately.' },
  { n:'02', role:'Earner',  color:'var(--green)', title:'Submit a Bid',        desc:'Browse tasks matching your skills. Write a pitch, name your price, and submit.' },
  { n:'03', role:'Creator', color:'var(--amber)', title:'Accept a Bid', desc:'Review bids and pick the best fit. Secure escrow payments are coming soon — for now, arrange payment with your earner directly.' },
  { n:'04', role:'Both',    color:'var(--purple)',title:'Work & Release',      desc:'Communicate through the platform. When done, release payment. Both sides win.' },
]

const STATS_DATA = [
  { v:'R0',   l:'Cost to Start' },
  { v:'Beta', l:'Free While in Beta' },
  { v:'24h',  l:'Avg First Bid Time' },
  { v:'Soon', l:'Secure Escrow Coming' },
]

const TESTIMONIALS_DATA = [
  { name:'Sipho M.',   role:'3rd Year CS · Earner',       rating:5, text:'I made R2400 in my first two weeks just fixing bugs and building small scripts for other students. ReLivR is the side hustle I didn\'t know I needed.' },
  { name:'Anika V.',   role:'PostGrad Law · Creator',      rating:5, text:'Got my thesis transcribed, my room cleaned, and my laptop fixed all through ReLivR. The escrow system means I never worried about paying upfront.' },
  { name:'Lethabo K.', role:'2nd Year Commerce · Earner',  rating:5, text:'The trust score system is what makes it different. People know I\'m a real Rhodes student, not some random from the internet.' },
]

function CampusStrip() {
  const slots = [
    { img:'/img/campus-tech.webp',     caption:'Tech help, same day', tag:'Tech & Coding' },
    { img:'/img/campus-errands.webp',  caption:'Errands, sorted',     tag:'Errands' },
    { img:'/img/campus-tutoring.webp', caption:'Skills, shared',      tag:'Tutoring' },
  ]
  return (
    <section style={{ padding:'88px 24px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="slabel" style={{ marginBottom:28 }}>Real campus, real tasks</div>
        <div className="tasks-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
          {slots.map((s,i) => (
            <figure key={i} className="lcard photo-card" style={{ margin:0, padding:0, overflow:'hidden', borderRadius:18 }}>
              <div style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden' }}>
                <img src={s.img} alt={s.caption} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                <span style={{ position:'absolute', top:12, left:12, background:'rgba(33,28,46,.5)', backdropFilter:'blur(8px)', color:'#fff', fontFamily:'var(--fm)', fontSize:'.6rem', letterSpacing:'.08em', textTransform:'uppercase', padding:'5px 11px', borderRadius:100 }}>{s.tag}</span>
              </div>
              <figcaption style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.02rem', padding:'16px 18px' }}>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function Hero({ onOpenAuth }) {
  return (
    <section className="hero-section" style={{ minHeight:'100vh', display:'flex', alignItems:'center', padding:'128px 24px 72px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0, backgroundImage:'linear-gradient(rgba(33,28,46,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,46,.05) 1px,transparent 1px)', backgroundSize:'56px 56px' }} />
      <div style={{ position:'absolute', top:'15%', right:'8%', width:500, height:500, background:'radial-gradient(circle,rgba(91,33,182,.07) 0%,transparent 70%)', zIndex:0 }} />
      <div style={{ maxWidth:1200, margin:'0 auto', width:'100%', position:'relative', zIndex:1 }}>
        <div className="hero-inner" style={{ display:'flex', alignItems:'center', gap:60 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(91,33,182,.1)', border:'1px solid rgba(91,33,182,.25)', borderRadius:100, padding:'5px 14px', marginBottom:28, animation:'fadeUp .6s ease both' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--amber)', animation:'pulse 2s infinite', flexShrink:0 }} />
              <span style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', letterSpacing:'.1em', textTransform:'uppercase' }}>Now in beta on Rhodes Campus</span>
            </div>
            <h1 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(2.8rem,6.5vw,5.2rem)', lineHeight:1.0, letterSpacing:'-.02em', marginBottom:24, animation:'fadeUp .6s .1s ease both', opacity:0, animationFillMode:'forwards' }}>
              Live more.<br /><span style={{ background:'linear-gradient(100deg, transparent 0%, var(--highlight) 6%, var(--highlight) 94%, transparent 100%)', padding:'0 0.18em', borderRadius:12, WebkitBoxDecorationBreak:'clone', boxDecorationBreak:'clone' }}>stress less.</span>
            </h1>
            <p style={{ fontSize:'clamp(.95rem,1.8vw,1.2rem)', color:'#5f5970', lineHeight:1.75, maxWidth:520, marginBottom:36, animation:'fadeUp .6s .2s ease both', opacity:0, animationFillMode:'forwards' }}>
              ReLivR connects students. Post a task, earn money, or get things done — with verified student trust scores. Secure escrow payments (recurring, split &amp; more) are coming soon.
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', animation:'fadeUp .6s .3s ease both', opacity:0, animationFillMode:'forwards' }}>
              <button className="btn-p" style={{ fontSize:'.95rem', padding:'14px 30px' }} onClick={() => onOpenAuth('register')}>Post a Task Free →</button>
              <button className="btn-s" style={{ fontSize:'.95rem', padding:'14px 30px' }} onClick={() => onOpenAuth('register')}>Start Earning</button>
            </div>
            <p style={{ marginTop:20, fontSize:'.78rem', color:'var(--text-muted)', fontFamily:'var(--fm)', animation:'fadeUp .6s .4s ease both', opacity:0, animationFillMode:'forwards' }}>
              No credit card required · Free to post · Pay only when done
            </p>
          </div>
          <div className="hide-m" style={{ width:316, flexShrink:0, display:'flex', flexDirection:'column', gap:10, animation:'slideL .8s .4s ease both', opacity:0, animationFillMode:'forwards', border:'10px solid #211c2e', borderRadius:40, padding:'34px 14px 22px', background:'var(--bg-base)', boxShadow:'0 24px 64px rgba(33,28,46,.18)', position:'relative' }}>
            {TASK_EXAMPLES.slice(0,3).map((t,i) => (
              <div key={i} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', animation:`float ${3+i*.5}s ${i*.3}s ease-in-out infinite` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:'.84rem', fontWeight:500, lineHeight:1.3, maxWidth:180 }}>{t.title}</span>
                  <span style={{ fontFamily:'var(--fm)', fontSize:'.88rem', color:'var(--amber)', fontWeight:500, flexShrink:0, marginLeft:8 }}>{t.budget}</span>
                </div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {t.tags.map(tag => <span key={tag} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-strong)', color:'#7c7585', fontFamily:'var(--fm)', fontSize:'.58rem', padding:'2px 7px', borderRadius:3, textTransform:'uppercase', letterSpacing:'.06em' }}>{tag}</span>)}
                  <span style={{ marginLeft:'auto', fontFamily:'var(--fm)', fontSize:'.58rem', color:'var(--text-muted)' }}>{t.time}</span>
                </div>
              </div>
            ))}
            <div style={{ textAlign:'center', padding:'6px 0' }}>
              <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', letterSpacing:'.1em', textTransform:'uppercase' }}>Live tasks on campus →</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatsBar() {
  return (
    <section style={{ borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'36px 24px', background:'var(--bg-surface)' }}>
      <div className="stats-grid" style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
        {STATS_DATA.map((s,i) => (
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,3vw,2.6rem)', fontWeight:800, color:'var(--amber)', lineHeight:1, marginBottom:5 }}>{s.v}</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" style={{ padding:'100px 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:56 }}>
          <div className="slabel" style={{ marginBottom:14 }}>How It Works</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1, maxWidth:440 }}>From task to payment in four steps</h2>
        </div>
        <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:2 }}>
          {STEPS_DATA.map((s,i) => (
            <div key={i} style={{ padding:'32px 26px', background:i%2===0?'var(--bg-surface)':'var(--bg-base)', border:'1px solid var(--border)', position:'relative' }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:'3.5rem', fontWeight:800, color:'var(--border-strong)', lineHeight:1, marginBottom:16, userSelect:'none' }}>{s.n}</div>
              <div style={{ display:'inline-block', background:s.color==='var(--amber)'?'rgba(91,33,182,.1)':s.color==='var(--green)'?'rgba(16,185,129,.1)':'rgba(180,83,9,.1)', border:`1px solid ${s.color==='var(--amber)'?'rgba(91,33,182,.3)':s.color==='var(--green)'?'rgba(16,185,129,.3)':'rgba(180,83,9,.3)'}`, borderRadius:100, padding:'3px 11px', marginBottom:12 }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:s.color, textTransform:'uppercase', letterSpacing:'.1em' }}>{s.role}</span>
              </div>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.15rem', fontWeight:700, marginBottom:10 }}>{s.title}</h3>
              <p style={{ fontSize:'.875rem', color:'#665f72', lineHeight:1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" style={{ padding:'100px 24px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:56, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:20 }}>
          <div>
            <div className="slabel" style={{ marginBottom:14 }}>Features</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1 }}>Everything you need.<br />Nothing you don't.</h2>
          </div>
          <p style={{ maxWidth:320, color:'#665f72', fontSize:'.9rem', lineHeight:1.7 }}>Built specifically for campus life. Lightweight, fast, and designed around the way students actually work.</p>
        </div>
        <div className="feat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          {FEATURES_DATA.map((f,i) => (
            <div key={i} style={{ padding:'32px 28px', background:'var(--bg-base)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', transition:'background 200ms', cursor:'default' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--bg-base)'}>
              <div style={{ fontSize:'1.7rem', marginBottom:14 }}>{f.icon}</div>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', fontWeight:700, marginBottom:9 }}>{f.title}</h3>
              <p style={{ fontSize:'.875rem', color:'#6d6678', lineHeight:1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LiveTasks({ onOpenAuth }) {
  return (
    <section style={{ padding:'100px 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:44, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:16 }}>
          <div>
            <div className="slabel" style={{ marginBottom:14 }}>Live Right Now</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, lineHeight:1.1 }}>Tasks posted today</h2>
          </div>
          <button className="btn-s" onClick={() => onOpenAuth('register')}>View All Tasks →</button>
        </div>
        <div className="tasks-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {TASK_EXAMPLES.map((t,i) => (
            <div key={i} className="lcard" style={{ cursor:'pointer' }} onClick={() => onOpenAuth('register')}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <span style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:100, padding:'2px 9px', fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--green)', textTransform:'uppercase', letterSpacing:'.08em' }}>Open</span>
                <span style={{ fontFamily:'var(--fm)', fontSize:'1rem', color:'var(--amber)', fontWeight:500 }}>{t.budget}</span>
              </div>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'.98rem', fontWeight:700, marginBottom:10, lineHeight:1.3 }}>{t.title}</h3>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
                {t.tags.map(tag => <span key={tag} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-strong)', color:'#7c7585', fontFamily:'var(--fm)', fontSize:'.58rem', padding:'2px 7px', borderRadius:3, textTransform:'uppercase', letterSpacing:'.06em' }}>{tag}</span>)}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)' }}>📍 Rhodes Campus</span>
                <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)' }}>{t.time}</span>
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
    <section id="pricing" style={{ padding:'100px 24px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:56, textAlign:'center' }}>
          <div className="slabel" style={{ justifyContent:'center', marginBottom:14 }}>Pricing</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1, marginBottom:14 }}>Simple. Fair. Transparent.</h2>
          <p style={{ color:'#665f72', maxWidth:420, margin:'0 auto', lineHeight:1.7, fontSize:'.9rem' }}>No subscriptions. No hidden fees. We only make money when you do.</p>
        </div>
        <div className="price-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, maxWidth:760, margin:'0 auto' }}>
          <div style={{ background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:14, padding:'32px 28px' }}>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>For Creators</div>
            <div style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, lineHeight:1, marginBottom:5 }}>Free</div>
            <p style={{ color:'#6d6678', fontSize:'.875rem', marginBottom:24 }}>to post a task</p>
            <Divider style={{ marginBottom:20 }} />
            {['Post unlimited tasks','Receive unlimited bids','Built-in messaging','Escrow payments — coming soon','Dispute resolution support'].map(item => (
              <div key={item} style={{ display:'flex', gap:9, alignItems:'center', marginBottom:10 }}>
                <span style={{ color:'var(--green)', fontSize:'.875rem', flexShrink:0 }}>✓</span>
                <span style={{ fontSize:'.875rem', color:'#454050' }}>{item}</span>
              </div>
            ))}
            <button className="btn-s" style={{ width:'100%', marginTop:24, justifyContent:'center', display:'flex' }} onClick={() => onOpenAuth('register')}>Post a Task Free</button>
          </div>
          <div style={{ background:'var(--bg-base)', border:'1px solid var(--amber)', borderRadius:14, padding:'32px 28px', position:'relative', boxShadow:'0 0 40px rgba(91,33,182,.08)' }}>
            <div style={{ position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)', background:'var(--amber)', color:'#fff', fontFamily:'var(--fm)', fontSize:'.58rem', fontWeight:500, textTransform:'uppercase', letterSpacing:'.1em', padding:'3px 12px', borderRadius:100 }}>Most Popular</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>For Earners</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:5 }}>
              <span style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, lineHeight:1 }}>Free</span>
              <span style={{ color:'#6d6678', fontSize:'.875rem' }}>during beta</span>
            </div>
            <p style={{ color:'#6d6678', fontSize:'.875rem', marginBottom:24 }}>secure payouts coming soon</p>
            <Divider style={{ marginBottom:20 }} />
            {['Bid on any open task','Verified student trust score','Instant escrow payouts — coming soon','Build a campus reputation','Zero upfront cost'].map(item => (
              <div key={item} style={{ display:'flex', gap:9, alignItems:'center', marginBottom:10 }}>
                <span style={{ color:'var(--amber)', fontSize:'.875rem', flexShrink:0 }}>✓</span>
                <span style={{ fontSize:'.875rem', color:'#454050' }}>{item}</span>
              </div>
            ))}
            <button className="btn-p" style={{ width:'100%', marginTop:24, justifyContent:'center', display:'flex' }} onClick={() => onOpenAuth('register')}>Start Earning →</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section style={{ padding:'100px 24px' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ marginBottom:56 }}>
          <div className="slabel" style={{ marginBottom:14 }}>Testimonials</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.1 }}>Real students.<br />Real results.</h2>
        </div>
        <div className="test-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {TESTIMONIALS_DATA.map((t,i) => (
            <div key={i} className="lcard">
              <div style={{ color:'#d97706', letterSpacing:2, marginBottom:14 }}>{'★'.repeat(t.rating)}</div>
              <p style={{ fontSize:'.9rem', color:'#454050', lineHeight:1.8, marginBottom:22, fontStyle:'italic' }}>"{t.text}"</p>
              <div style={{ display:'flex', alignItems:'center', gap:11, paddingTop:18, borderTop:'1px solid var(--border)' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(91,33,182,.12)', border:'1px solid rgba(91,33,182,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontWeight:700, fontSize:'.85rem', color:'var(--amber)' }}>{t.name.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:'.875rem' }}>{t.name}</div>
                  <div style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>{t.role}</div>
                </div>
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
    <section id="about" style={{ padding:'100px 24px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="about-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>
          <div>
            <div className="slabel" style={{ marginBottom:18 }}>About ReLivR</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:800, lineHeight:1.1, marginBottom:22 }}>Built for students,<br />by students.</h2>
            <p style={{ color:'#665f72', lineHeight:1.8, marginBottom:18, fontSize:'.9rem' }}>ReLivR started with a simple observation: Rhodes University has thousands of talented students who need extra income, and thousands more who need help getting things done. We built the infrastructure to connect them safely.</p>
            <p style={{ color:'#665f72', lineHeight:1.8, fontSize:'.9rem' }}>Every feature — from the escrow payment system to the trust score engine — was designed with one campus in mind. No bloat. Just a fast, safe marketplace that works.</p>
          </div>
          <div style={{ background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:14, padding:26, fontFamily:'var(--fm)', fontSize:'.78rem', lineHeight:2, color:'#7c7585' }}>
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

// Launch countdown + reminder waitlist.
function LaunchSection() {
  const [email, setEmail]     = useState('')
  const [done, setDone]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!/.+@.+\..+/.test(email)) { setErr('Enter a valid email'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch(API_BASE + '/waitlist', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email }) })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch { setErr('Something went wrong — please try again') } finally { setLoading(false) }
  }
  return (
    <section style={{ padding:'56px 24px', textAlign:'center', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:680, margin:'0 auto' }}>
        <div className="slabel" style={{ justifyContent:'center', marginBottom:14 }}>Full launch · 7 July 2026</div>
        <h2 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(1.6rem,4vw,2.4rem)', marginBottom:22 }}>The countdown is on</h2>
        <div style={{ marginBottom:26 }}><Countdown target={LAUNCH_AT} /></div>
        <p style={{ color:'#5f5970', marginBottom:20, lineHeight:1.7 }}>
          We're in <strong>beta</strong> now — sign up to use ReLivR today as a founding member, or drop your email and we'll remind you the moment we fully launch.
        </p>
        {done ? (
          <div style={{ color:'var(--green)', fontWeight:600 }}>✓ You're on the list — we'll email you when ReLivR launches.</div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); setErr('') }} placeholder="you@email.com" aria-label="Email for launch reminder"
              style={{ maxWidth:280, padding:'12px 16px', borderRadius:10, border:'1px solid var(--border-strong)', background:'var(--bg-elevated)' }} />
            <button type="submit" className="btn-p" disabled={loading}>{loading ? '…' : 'Remind me at launch'}</button>
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
  async function submit(e) {
    e.preventDefault()
    if (msg.trim().length < 3) return
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/feedback', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message: msg.trim(), email: email.trim() || undefined }) })
      if (res.ok) setDone(true)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  return (
    <section id="feedback" style={{ padding:'64px 24px' }}>
      <div style={{ maxWidth:560, margin:'0 auto', textAlign:'center' }}>
        <div className="slabel" style={{ justifyContent:'center', marginBottom:14 }}>Beta feedback</div>
        <h2 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(1.6rem,4vw,2.4rem)', marginBottom:12 }}>Help us shape ReLivR</h2>
        <p style={{ color:'#5f5970', marginBottom:24, lineHeight:1.7 }}>
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
        <p style={{ color:'#5f5970', fontSize:'1.05rem', lineHeight:1.7, marginBottom:34, maxWidth:520, marginLeft:'auto', marginRight:'auto' }}>
          ReLivR opens to everyone on <strong>7 July 2026</strong>. Your account is reserved
          and you'll wear the <strong>★ Founding Member</strong> badge for being here from day one.
          We'll email you the moment the doors open — this page unlocks into the app automatically.
        </p>
        <div style={{ marginBottom:36 }}>
          <Countdown target={LAUNCH_AT} onComplete={() => window.location.reload()} />
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn-s" onClick={onViewLanding}>← Back to site</button>
          <button className="btn-g" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </div>
  )
}

function LandingCTA({ onOpenAuth }) {
  return (
    <section style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', position:'relative', borderRadius:28, overflow:'hidden', boxShadow:'var(--shadow-xl)' }}>
        <img src="/img/community.webp" alt="Rhodes students together on campus" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(115deg, rgba(33,28,46,.88) 0%, rgba(33,28,46,.6) 52%, rgba(76,29,149,.5) 100%)' }} />
        <div style={{ position:'relative', zIndex:1, padding:'clamp(44px,7vw,86px) clamp(26px,6vw,72px)', maxWidth:640 }}>
          <div className="slabel" style={{ color:'var(--highlight)', marginBottom:18 }}>Get Started</div>
          <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,4vw,3.4rem)', fontWeight:800, lineHeight:1.06, marginBottom:18, letterSpacing:'-.02em', color:'#fff' }}>
            Ready to join your<br /><span style={{ color:'var(--highlight)' }}>campus economy?</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.82)', maxWidth:440, marginBottom:32, lineHeight:1.7, fontSize:'.98rem' }}>Join hundreds of Rhodes students already posting tasks, earning money, and getting things done — all in one place they trust.</p>
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
          <button onClick={() => onNav('home')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.65rem', textTransform:'uppercase', letterSpacing:'.1em', cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>← Back to Home</button>
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
          <button onClick={() => onNav('home')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.65rem', textTransform:'uppercase', letterSpacing:'.1em', cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>← Back to Home</button>
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
                style={{ display:'block', width:'100%', textAlign:'left', background:active===s.id?'rgba(91,33,182,.06)':'none', border:'none', borderLeft:active===s.id?'2px solid var(--amber)':'2px solid transparent', color:active===s.id?'var(--amber)':'var(--text-muted)', padding:'9px 20px', fontSize:'.85rem', cursor:'pointer', transition:'all 150ms' }}>
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
        <p style={{ color:'#5f5970', maxWidth:360, margin:'0 auto', lineHeight:1.7 }}>This page is being worked on and will be available shortly.</p>
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
      <div id="overview"><h2>Overview</h2><p>ReLivR is a peer-to-peer service marketplace for students, launching first at Rhodes University. It connects people who need tasks done (Creators) with people who have the skills to do them (Earners).</p><div className="highlight"><p>🎓 ReLivR is launching Rhodes-first. Verifying your Rhodes student email (@ru.ac.za) earns a verified-student badge and boosts your trust.</p></div></div>
      <div id="creators"><h2>For Creators</h2><h3>Posting a Task</h3><p>Creating a task takes less than 60 seconds. Provide a title, description, budget, deadline, and skill tags. Once posted, your task is immediately visible and earners with matching skills are notified automatically.</p><h3>Reviewing Bids</h3><p>Earners submit bids with a proposed price and pitch. You can review all bids, message earners directly, and take as long as you need before accepting.</p><h3>Accepting a Bid</h3><p>When you accept a bid, all other bids are automatically declined and the winning earner is notified. You are then prompted to fund the escrow — this secures the payment without charging you yet.</p><h3>Releasing Payment</h3><p>Once the task is complete to your satisfaction, you release the payment. Funds transfer immediately to the earner's account. You are then prompted to leave a review.</p></div>
      <div id="earners"><h2>For Earners</h2><h3>Finding Tasks</h3><p>Browse the task feed by skill, keyword, or campus zone. The Suggestions tab surfaces tasks specifically matched to your skill profile using our Jaccard similarity algorithm.</p><h3>Submitting a Bid</h3><p>Write a pitch explaining why you're the right person for the task and propose your price. You can bid on multiple tasks simultaneously and withdraw a bid at any time before it's accepted.</p><h3>Getting Paid</h3><p>Payments are processed via Paystack and paid out to your linked bank account. The platform retains a 10% fee from your payout on each completed task.</p></div>
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
      <div id="overview"><h2>All Features</h2><p>ReLivR is built with a focused feature set designed around the realities of campus life. Everything was chosen because it solves a real problem for students.</p></div>
      <div id="matching"><h2>Smart Matching Engine</h2><p>When a task is posted, our matching engine automatically identifies earners whose skill profiles overlap with the task's skill tags using Jaccard similarity scoring. Earners are ranked by skill overlap score, average rating bonus (up to +20% for 5-star earners), and account longevity.</p></div>
      <div id="trust"><h2>Trust Score System</h2><p>Every user has a trust score between 0 and 100, calculated from:</p><ul><li><strong style={{color:'#3b3548'}}>Identity (40pts)</strong> — verified Rhodes student email @ru.ac.za (30pts) + verified email or Google sign-in (10pts)</li><li><strong style={{color:'#3b3548'}}>Track record (40pts)</strong> — completed tasks (up to 20pts) + average rating (up to 20pts)</li><li><strong style={{color:'#3b3548'}}>Longevity (20pts)</strong> — 5 points per month, capped at 20</li><li><strong style={{color:'#3b3548'}}>Dispute penalty</strong> — -10pts per dispute raised against you</li></ul><div className="highlight"><p>Levels: Unverified (0–19) · New (20–49) · Established (50–79) · Verified (80–100)</p></div></div>
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
      <div id="overview"><h2>Our Commitment to Safety</h2><p>ReLivR is built on the principle that two students from the same campus should be able to transact with confidence. Every feature exists to make that possible.</p><div className="highlight"><p>🔒 All payments are held in escrow and never leave the platform until both parties are satisfied — or an admin resolves a dispute.</p></div></div>
      <div id="trust-scores"><h2>Trust Scores</h2><p>Every user has a visible trust score calculated from verifiable signals: verified identity, completed transactions, earned ratings, and account history. A high trust score is not a guarantee of quality, but it is a meaningful signal that a user has a real, verified identity and a track record on the platform.</p></div>
      <div id="verification"><h2>Identity Verification</h2><p>Verifying your Rhodes student email (@ru.ac.za) earns a verified-student badge and boosts your trust. Email verification and Google sign-in further confirm a real identity and help prevent anonymous bad-faith accounts from accumulating trust.</p></div>
      <div id="escrow"><h2>Payment Safety</h2><p>ReLivR never holds your money directly — payments are processed and held in escrow by our payment provider, Paystack, a PCI-DSS-compliant processor. Your card details are never stored by ReLivR.</p></div>
      <div id="reporting"><h2>Reporting Issues</h2><p>If you encounter a problem:</p><ul><li><strong style={{color:'#3b3548'}}>Raise a dispute</strong> — for unresolved task delivery issues. Freezes escrow immediately.</li><li><strong style={{color:'#3b3548'}}>Report a user</strong> — for conduct violations, harassment, or fraud.</li><li><strong style={{color:'#3b3548'}}>Contact support</strong> — for account issues or technical problems.</li></ul></div>
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
      <div id="collect"><h2>2. What We Collect</h2><ul><li>Identity and profile information — your name, display name, profile photo, headline, skills, and any bio or services you add</li><li>Contact information — email address, phone number, and physical or campus address</li><li>Account information — login credentials and preferences</li><li>Payment and transaction information — once payments are enabled</li><li>Location — your campus or area, to help facilitate tasks</li><li>Communications — messages with other users and with support</li><li>Technical and device information — IP address, device/browser type, a hashed identifier derived from your browser (used to detect new sign-ins), cookies, local storage and usage data</li><li>Content you create — tasks, bids, reviews and ratings, and (for businesses) listings and deal posts</li><li>Social and activity information — the users and businesses you follow and the deals you redeem</li></ul><p>Some information (name, email, password) is required to use the Platform; other information is optional.</p></div>
      <div id="lawful"><h2>3. Lawful Basis for Processing</h2><p>We process personal information where you have consented, where it is necessary to perform our contract with you, to comply with a legal obligation, to protect a legitimate interest, or as otherwise permitted by law — consistent with POPIA's eight conditions for lawful processing.</p></div>
      <div id="use"><h2>4. How We Use It</h2><p>We use your information to create and manage accounts, match users with taskers, process payments, facilitate communication, verify identity and prevent fraud, provide support, improve and secure the Platform, comply with legal obligations, and send service-related notifications. <strong style={{color:'#3b3548'}}>We do not sell your personal information.</strong></p></div>
      <div id="share"><h2>5. Who We Share With</h2><p>We share personal information only as needed to operate the Platform:</p><ul><li>Payment processors (e.g. Paystack), once payments are enabled</li><li>Cloud hosting and database providers (e.g. Railway, Vercel, Neon)</li><li>Image-hosting providers for photos you upload (e.g. Cloudinary)</li><li>Authentication and email providers (e.g. Google / Gmail, and email-delivery services)</li><li>Analytics providers that help us improve the Platform</li><li>Other users and businesses when you interact — for example, your display name is shared with the other party when you post a task, bid, message or leave a review; and when you redeem a business's deal, your name is shared with that business. Your public profile and reviews are visible to other users.</li><li>Law enforcement or regulators where required by law</li></ul></div>
      <div id="transfers"><h2>6. Cross-Border Transfers</h2><p>Some of our providers process or store information outside South Africa, including in the European Union and the United States. Where information is transferred across borders, we ensure an adequate level of protection consistent with section 72 of POPIA.</p></div>
      <div id="retention"><h2>7. Data Retention</h2><p>We keep personal information only as long as necessary, then delete or anonymise it. Account data is kept while your account is active (and anonymised when you delete it); payment records are kept for the period required by tax and financial-record laws (generally up to five years, once payments are enabled); support communications and security logs are kept for a limited period; and consent records are kept until you change them. We may retain information longer where required by law or to resolve disputes.</p></div>
      <div id="rights"><h2>8. Your Rights Under POPIA</h2><p>You may access your information, correct it, request deletion (where permitted), object to certain processing (including direct marketing), withdraw consent, and request a copy of your data in a portable format. You can download your data and delete your account at any time from <strong style={{color:'#3b3548'}}>Profile → Security</strong>. You may also lodge a complaint with the Information Regulator.</p><div className="highlight"><p>Information Regulator: <a href="https://inforeg.org.za">inforeg.org.za</a> · complaints.IR@inforegulator.org.za</p></div></div>
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
      <div id="getting-started"><h2>Getting Started</h2><h3>How do I create an account?</h3><p>Click "Get Started" on the homepage, fill in your name, email, and password, and choose whether you want to post tasks (Creator) or earn money (Earner). You can explore both roles after signup.</p><h3>Is it free to sign up?</h3><p>Yes. Creating an account is completely free. There are no monthly fees or charges for browsing.</p><h3>Do I need a Rhodes email?</h3><p>Any email works to create an account. Verifying a Rhodes student email (@ru.ac.za) earns a verified-student badge and increases your trust score.</p></div>
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
          <p style={{ color:'#5f5970', lineHeight:1.8, marginBottom:28, fontSize:'.9rem' }}>Have a question, problem, or feedback? We read every message and respond within 24 hours on business days.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { icon:'📧', label:'General enquiries', value:'hello@reliv.co.za' },
              { icon:'🔒', label:'Privacy & data',    value:'privacy@reliv.co.za' },
              { icon:'⚖️', label:'Legal',             value:'legal@reliv.co.za' },
              { icon:'🛠️', label:'Technical support', value:'support@reliv.co.za' },
            ].map(item => (
              <div key={item.label} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{item.icon}</span>
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
              <p style={{ color:'#5f5970', fontSize:'.875rem' }}>We'll get back to you within 24 hours.</p>
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
      <div id="overview"><h2>Our Community Standards</h2><p>ReLivR works because students trust each other. These guidelines exist to protect that trust and ensure the platform remains a safe, fair place for everyone on campus.</p></div>
      <div id="respect"><h2>Respect</h2><p>Every person on ReLivR is a member of the Rhodes community. Treat them accordingly.</p><ul><li>Communicate professionally, even when disagreements arise</li><li>No harassment, threats, hate speech, or discriminatory language</li><li>Respect boundaries — if someone withdraws from a transaction, accept it</li><li>Do not share other users' personal information outside the platform</li></ul></div>
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
      <p style={{ color:'#5f5970', lineHeight:1.8, marginBottom:32, fontSize:'.9rem', maxWidth:560 }}>Use this form to report a user, task, or platform issue. All reports are reviewed within 24 hours and kept confidential.</p>
      {sent ? (
        <div style={{ textAlign:'center', padding:'40px 20px', maxWidth:400 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✓</div>
          <div style={{ fontFamily:'var(--fd)', fontSize:'1.3rem', fontWeight:800, marginBottom:8 }}>Report submitted</div>
          <p style={{ color:'#5f5970', fontSize:'.875rem' }}>Our team will review your report and take appropriate action.</p>
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
      <div style={{ textAlign:'center' }}>
        <Spinner size={32} />
        <p style={{ marginTop:16, color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Completing Google sign-in…</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

const NAV = {
  // First 5 = native bottom-tab bar on mobile; the rest stay desktop-only.
  // Roles merged: every member can both post tasks and bid on them.
  member: [
    { id:'tasks-browse',  label:'Home',      icon:'⌂' },
    { id:'tasks-new',     label:'Post',      icon:'＋' },
    { id:'tasks-mine',    label:'My Tasks',  icon:'▤' },
    { id:'messages',      label:'Messages',  icon:'◎' },
    { id:'profile',       label:'Profile',   icon:'◷' },
    { id:'local-browse',  label:'Local',     icon:'◇' },
    { id:'following',     label:'Following', icon:'♡' },
    { id:'my-bids',       label:'My Bids',   icon:'◈' },
    { id:'dashboard',     label:'Stats',     icon:'⊞' },
    { id:'notifications', label:'Alerts',    icon:'◉' },
  ],
  admin: [
    { id:'dashboard',       label:'Dashboard',  icon:'⊞' },
    { id:'admin-disputes',  label:'Disputes',   icon:'⚖' },
    { id:'admin-users',     label:'Users',      icon:'◈' },
    { id:'admin-businesses',label:'Businesses', icon:'◇' },
    { id:'tasks-browse',    label:'All Tasks',  icon:'▤' },
    { id:'notifications',   label:'Alerts',     icon:'◐' },
  ],
}

function TopBar({ page, setPage, unreadCount, onGoHome, onViewLanding, onSearch }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const isCreator = user.role === 'creator'
  // Desktop nav links — role-aware. These render in the top bar on every screen
  // wide enough to fit them, so navigation never depends on the mobile bottom bar.
  const isAdmin = user.role === 'admin'
  const navLinks = isAdmin
    ? [ { id:'dashboard', label:'Dashboard' }, { id:'admin-disputes', label:'Disputes' }, { id:'admin-users', label:'Users' }, { id:'admin-tasks', label:'Tasks' }, { id:'admin-businesses', label:'Businesses' }, { id:'admin-deals', label:'Deals' }, { id:'admin-locations', label:'Locations' }, { id:'admin-flags', label:'Flags' }, { id:'admin-audit', label:'Audit' } ]
    : [
        { id:'tasks-browse', label:'Browse' },
        { id:'local-browse', label:'Local' },
        { id:'deals',        label:'Deals' },
        { id:'following',    label:'Following' },
        { id:'tasks-mine',   label:'My Tasks' },
        { id:'my-bids',      label:'My Bids' },
      ]

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
          <button onClick={() => setPage('messages')} aria-label="Messages" title="Messages"
            style={{ width:38, height:38, borderRadius:'50%', border:'none', background:page==='messages'?'var(--accent-glow)':'transparent', color:page==='messages'?'var(--accent)':'var(--text-secondary)', fontSize:'1.05rem', cursor:'pointer' }}><span aria-hidden="true">◎</span></button>
          <button onClick={() => setPage('notifications')} title="Alerts"
            aria-label={unreadCount > 0 ? `Alerts, ${unreadCount} unread` : 'Alerts'}
            style={{ position:'relative', width:38, height:38, borderRadius:'50%', border:'none', background:page==='notifications'?'var(--accent-glow)':'transparent', color:page==='notifications'?'var(--accent)':'var(--text-secondary)', fontSize:'1.05rem', cursor:'pointer' }}>
            <span aria-hidden="true">◉</span>{unreadCount>0 && <span style={{ position:'absolute', top:4, right:4, background:'var(--danger)', color:'#fff', fontFamily:'var(--font-mono)', fontSize:'.55rem', fontWeight:700, minWidth:15, height:15, lineHeight:'15px', borderRadius:8, textAlign:'center', padding:'0 3px' }}>{unreadCount}</span>}
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
                <div style={{ position:'absolute', right:0, top:44, zIndex:92, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:14, boxShadow:'0 12px 32px rgba(33,28,46,.14)', minWidth:200, overflow:'hidden', animation:'fadeUp .15s ease both' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>{user.displayName || user.email?.split('@')[0]}</div>
                    <Mono>{user.email}</Mono>
                  </div>
                  {[
                    { label:'My Profile', go:'profile' },
                    { label:'My Tasks', go:'tasks-mine' },
                    { label:'My Bids',  go:'my-bids' },
                    { label:'Stats & Activity', go:'dashboard' },
                  ].map(item => (
                    <button key={item.go} onClick={() => { setPage(item.go); setMenuOpen(false) }}
                      style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', fontSize:'.875rem', color:'var(--text-secondary)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>{item.label}</button>
                  ))}
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

function DashSidebar({ page, setPage, unreadCount, onGoHome }) {
  const { user, logout } = useAuth()
  const [signHov, setSignHov] = useState(false)
  const items = NAV[user.role === 'admin' ? 'admin' : 'member'] || []

  return (
    <aside className="dash-sidebar" style={{ background:'var(--bg-surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'20px 14px', position:'sticky', top:0, height:'100vh', overflowY:'auto', width:220, flexShrink:0 }}>
      <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
        <div onClick={onGoHome} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }}>
          <div style={{ background:'var(--accent)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.85rem', padding:'4px 8px', borderRadius:'var(--radius-sm)', letterSpacing:'0.06em' }}>R</div>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700, letterSpacing:'-0.01em' }}>ReLivR</span>
        </div>
      </div>
      <div className="sidebar-status" style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:20 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 6px var(--success)', flexShrink:0, animation:'pulse 2s infinite' }} />
        Demo Mode
      </div>
      <nav className="dash-nav" style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
        {items.map(item => {
          const active = page === item.id
          return (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`dash-nav-btn ${active?'active':''}`}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:'var(--radius-sm)', fontSize:'0.875rem', fontWeight:500, fontFamily:'var(--font-body)', cursor:'pointer', textAlign:'left', transition:'all 150ms ease', border:'none', color:active?'var(--accent)':'var(--text-secondary)', background:active?'var(--accent-glow)':'transparent', borderLeft:active?'2px solid var(--accent)':'2px solid transparent' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text-primary)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-secondary)' } }}>
              <span style={{ display:'flex', alignItems:'center', gap:10 }}><span style={{ fontSize:'1.05rem', width:20, textAlign:'center', lineHeight:1 }}>{item.icon}</span><span>{item.label}</span></span>
              {item.id==='notifications' && unreadCount>0 && (
                <span style={{ background:'var(--accent)', color:'#fff', fontFamily:'var(--font-mono)', fontSize:'0.6rem', fontWeight:700, padding:'1px 6px', borderRadius:10, minWidth:18, textAlign:'center' }}>{unreadCount}</span>
              )}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-user" style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginTop:14 }}>
        {/* Avatar + user info */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName}
              style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--border-strong)', flexShrink:0 }} />
          ) : (
            <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-glow)', border:'1px solid var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.85rem', color:'var(--accent)', flexShrink:0 }}>
              {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.displayName || user.email?.split('@')[0] || 'User'}
            </div>
            <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.email}
            </div>
          </div>
        </div>
        <Badge variant={user.role} style={{ marginBottom:10 }}>{user.role}</Badge>
        {user.provider === 'google' && (
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
            via Google
          </div>
        )}
        <button onClick={logout}
          onMouseEnter={() => setSignHov(true)} onMouseLeave={() => setSignHov(false)}
          style={{ background:'transparent', padding:'6px 12px', width:'100%', border:`1px solid ${signHov?'var(--danger)':'var(--border)'}`, color:signHov?'var(--danger)':'var(--text-muted)', borderRadius:'var(--radius-sm)', fontSize:'0.7rem', fontFamily:'var(--font-display)', textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', transition:'all 150ms ease' }}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

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
                <Badge variant={task.status}>{task.status.replace('_',' ')}</Badge>
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

function categoryFor(task) {
  const hay = ((task.skill_tags || []).join(' ') + ' ' + (task.title || '')).toLowerCase()
  return CATEGORIES.find(c => c.kw.some(k => hay.includes(k))) || CATEGORIES[CATEGORIES.length - 1]
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

function CardCover({ task, height = 108 }) {
  const c = categoryFor(task)
  return (
    <div style={{ height, background:`linear-gradient(135deg, ${c.g[0]}, ${c.g[1]})`, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
      <div style={{ position:'absolute', width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,.35)', top:-58, left:-34 }} />
      <div style={{ position:'absolute', width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,.25)', bottom:-44, right:36 }} />
      <span style={{ fontSize:'2.5rem', position:'relative', filter:'drop-shadow(0 2px 6px rgba(33,28,46,.15))' }}>{c.icon}</span>
      <div style={{ position:'absolute', top:10, left:10 }}><Badge variant={task.status}>{task.status.replace('_',' ')}</Badge></div>
      <span style={{ position:'absolute', right:10, bottom:10, background:'rgba(255,255,255,.94)', color:'var(--text-primary)', fontFamily:'var(--font-display)', fontWeight:800, padding:'4px 11px', borderRadius:10, fontSize:'.95rem', boxShadow:'0 1px 4px rgba(33,28,46,.12)' }}>R{task.budget}</span>
    </div>
  )
}

function TaskBrowse({ setPage, setSelectedTask }) {
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

  const filtered = tasks
    .filter(t => (status==='all'||t.status===status) && (!cat || categoryFor(t).name===cat) && (!skill||(t.skill_tags||[]).some(s=>s.toLowerCase().includes(skill.toLowerCase()))||t.title.toLowerCase().includes(skill.toLowerCase())))
    .sort((a,b) => {
      if (sort==='newest')    return new Date(b.created_at)-new Date(a.created_at)
      if (sort==='budget-hi') return parseFloat(b.budget)-parseFloat(a.budget)
      if (sort==='budget-lo') return parseFloat(a.budget)-parseFloat(b.budget)
      if (sort==='deadline')  return new Date(a.deadline)-new Date(b.deadline)
      return 0
    })

  const filtersActive = skill||cat||status!=='all'||sort!=='newest'

  return (
    <div className="page-enter">
      {/* Marketplace hero — search-first, like Fiverr/FB Marketplace */}
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.5rem,3vw,2.1rem)', letterSpacing:'-0.01em', marginBottom:14 }}>What do you need done?</h1>
        <div style={{ position:'relative', maxWidth:560 }}>
          <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'1.05rem' }}>⌕</span>
          <input id="feed-search" placeholder="Search — laundry, python, tutoring…" value={skill} onChange={e => setSkill(e.target.value)}
            style={{ padding:'14px 16px 14px 44px', borderRadius:14, fontSize:'1rem', background:'var(--bg-surface)', boxShadow:'0 1px 4px rgba(33,28,46,.07)' }} />
        </div>
      </div>

      {/* Illustrated category rail */}
      <div className="feed-scroll" style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:18, paddingBottom:4 }}>
        {cats.map(c => {
          const active = cat === c.name
          return (
            <button key={c.name} onClick={() => setCat(active ? null : c.name)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:100, whiteSpace:'nowrap', cursor:'pointer', transition:'all 150ms ease', border:`1.5px solid ${active?'var(--accent)':'var(--border)'}`, background:active?'var(--accent-glow)':'var(--bg-surface)', color:active?'var(--accent)':'var(--text-secondary)', fontWeight:600, fontSize:'.85rem', fontFamily:'var(--font-body)' }}>
              <span style={{ fontSize:'1rem' }}>{c.icon}</span>{c.name}
            </button>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
        <Mono>{filtered.length} open task{filtered.length!==1?'s':''} near Rhodes</Mono>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
        <SelectField value={status} onChange={e => setStatus(e.target.value)} style={{ minWidth:150 }}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="disputed">Disputed</option>
        </SelectField>
        <SelectField value={sort} onChange={e => setSort(e.target.value)} style={{ minWidth:160 }}>
          <option value="newest">Newest First</option>
          <option value="budget-hi">Budget: High → Low</option>
          <option value="budget-lo">Budget: Low → High</option>
          <option value="deadline">Deadline: Soonest</option>
        </SelectField>
          {filtersActive && <Btn variant="ghost" size="sm" onClick={() => { setSkill(''); setCat(null); setStatus('all'); setSort('newest') }}>✕ Clear</Btn>}
        </div>
      </div>
      {loading && <div style={{ padding:40, textAlign:'center' }}><Spinner /></div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:14 }}>
        {!loading && filtered.map(task => (
          <DCard key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }} style={{ padding:0, overflow:'hidden' }}>
            <CardCover task={task} />
            <div style={{ padding:'14px 16px 16px' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700, marginBottom:6, lineHeight:1.3 }}>{task.title}</h2>
              <Mono style={{ display:'block', marginBottom:10 }}>📍 {task.campus_zone || 'Rhodes Campus'} · {timeAgo(task.created_at)}</Mono>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>{task.skill_tags.slice(0,3).map(t => <Tag key={t}>{t}</Tag>)}</div>
              <Divider style={{ marginBottom:10 }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
                <Mono>{bidCount(task.task_id)} bid{bidCount(task.task_id)!==1?'s':''}</Mono>
              </div>
            </div>
          </DCard>
        ))}
        {filtered.length===0 && <div style={{ gridColumn:'1/-1' }}><EmptyState icon="◻" message="No tasks match your filter" action={filtersActive?<Btn variant="secondary" size="sm" onClick={() => { setSkill(''); setCat(null); setStatus('all'); setSort('newest') }}>Clear Filters</Btn>:null} /></div>}
      </div>
    </div>
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
    if (!window.confirm('Cancel this task? Any pending bids will be declined. This cannot be undone.')) return
    setCancelling(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/cancel`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not cancel task')
      toast('Task cancelled', 'success')
      setPage('tasks-mine')
    } catch (err) { toast(err.message, 'error') } finally { setCancelling(false) }
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
      <button onClick={() => { if (window.history.length > 1) window.history.back(); else setPage('tasks-browse') }} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer', marginBottom:20 }}>← Back</button>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
            <Badge variant={currentStatus}>{currentStatus?.replace('_',' ')}</Badge>
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
          <Btn variant="danger" size="sm" loading={cancelling} onClick={cancelTask}>Cancel task</Btn>
        </div>
      )}

      {escrow&&isCreator&&(
        <div style={{ marginBottom:20, padding:'14px 18px', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', ...(escrow.status==='funded'?{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)'}:escrow.status==='released'?{background:'rgba(91,33,182,0.1)',border:'1px solid rgba(91,33,182,0.3)'}:escrow.status==='disputed'?{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}:{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)'}) }}>
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

          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Bids ({bids.length})</Mono>
            {bids.length===0 ? <EmptyState icon="◻" message="No bids yet" /> : (
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
          {isEarner&&currentStatus==='open'&&!alreadyBid&&(
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
            {[['Budget',`R${task.budget}`],['Deadline',new Date(task.deadline).toLocaleDateString()],['Status',currentStatus?.replace('_',' ')],['Posted',new Date(task.created_at).toLocaleDateString()],['Bids',`${bids.length} bid${bids.length!==1?'s':''}`],['Task ID',`#${task.task_id}`]].map(([k,v]) => (
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
          <Input label="Deadline" type="date" value={editForm.deadline} onChange={e => setEditForm(f => ({ ...f, deadline:e.target.value }))} />
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
  const [tags, setTags]     = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [createdId, setCreatedId] = useState(null)
  const STEPS = ['Details','Budget & Date','Skills','Review']

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
    try {
      const res = await fetch(API_BASE + '/tasks', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}` },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim(),
          budget: parseFloat(budget),
          deadline: new Date(deadline).toISOString(),
          skill_tags: skillTags,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Could not post task')
      }
      const data = await res.json()
      const id = data.task.task_id
      toast(`Task "${title}" posted successfully!`, 'success')
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
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', fontWeight:700, marginBottom:8 }}>Task Posted!</h2>
        <p style={{ color:'var(--text-muted)', marginBottom:24, lineHeight:1.6 }}>Your task is live. Earners with matching skills have been notified.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Btn onClick={() => { setSelectedTask(createdId); setPage('task-detail') }}>View Task</Btn>
          <Btn variant="secondary" onClick={() => { setSelectedTask(null); setPage('tasks-mine') }}>All My Tasks</Btn>
          <Btn variant="ghost" onClick={() => { setTitle(''); setDesc(''); setBudget(''); setDead(''); setTags(''); setCreatedId(null); setStep(0) }}>Post Another</Btn>
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
        </div>}
        {step===1&&<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
          <Input label="Budget (R)" type="number" min="1" placeholder="e.g. 500" value={budget} onChange={e=>{setBudget(e.target.value);setErrors(v=>({...v,budget:null}))}} error={errors.budget} />
          <Input label="Deadline" type="date" value={deadline} onChange={e=>{setDead(e.target.value);setErrors(v=>({...v,deadline:null}))}} error={errors.deadline} />
        </div>}
        {step===2&&<Input label="Skill Tags (comma separated)" placeholder="e.g. react, node.js, postgres" value={tags} onChange={e=>{setTags(e.target.value);setErrors(v=>({...v,tags:null}))}} hint="Used to automatically match and notify earners" error={errors.tags} />}
        {step===3&&<div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Mono style={{ display:'block', marginBottom:4 }}>Review your task</Mono>
          {[['Title',title],['Budget',`R${budget}`],['Deadline',deadline?new Date(deadline).toLocaleDateString():'—'],['Skills',tags||'—']].map(([k,v]) => (
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
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
        <div style={{ display:'flex', gap:10 }}>
          {step>0&&<Btn variant="secondary" onClick={back}>← Back</Btn>}
          <Btn variant="ghost" onClick={() => setPage('dashboard')}>Cancel</Btn>
        </div>
        {step<STEPS.length-1?<Btn onClick={next}>Next →</Btn>:<Btn loading={loading} onClick={submit}>Post Task</Btn>}
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
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} />
          <div><label>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} style={{ minHeight:100 }} /></div>
          <Input label="Budget (R)" type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget:e.target.value }))} />
          <Input label="Deadline (days from posting)" type="number" value={form.deadlineDays} onChange={e => setForm(f => ({ ...f, deadlineDays:e.target.value }))} />
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
            <Btn variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={create}>Save template</Btn>
          </div>
        </div>
      </Modal>
    </DCard>
  )
}

function MyTasks({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const { user } = useAuth()
  const [filter, setFilter] = useState('all')
  const [myTasks, setMyTasks] = useState([])
  const token = () => localStorage.getItem('rl_token')

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
        {['all','open','in_progress','completed','disputed','expired'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(33,28,46,.14)':'none' }}>
            {s.replace('_',' ')} ({s==='all'?myTasks.length:myTasks.filter(t=>t.status===s).length})
          </button>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filtered.map(task => {
          const pendingBids = typeof task.bid_count === 'number'
            ? task.bid_count
            : state.bids.filter(b=>b.task_id===task.task_id&&b.status==='pending').length
          return (
            <DCard key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }} style={{ display:'flex', alignItems:'center', gap:20, padding:'16px 20px' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:6 }}>
                  <Badge variant={task.status}>{task.status.replace('_',' ')}</Badge>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:600 }}>{task.title}</span>
                </div>
                <div style={{ display:'flex', gap:6 }}>{task.skill_tags.slice(0,3).map(t=><Tag key={t}>{t}</Tag>)}</div>
              </div>
              <div style={{ display:'flex', gap:24, alignItems:'center', flexShrink:0 }}>
                {pendingBids>0&&<div style={{ textAlign:'center' }}><div style={{ fontFamily:'var(--font-mono)', fontSize:'1.2rem', fontWeight:500, color:'var(--accent)' }}>{pendingBids}</div><Mono>new bids</Mono></div>}
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:500 }}>R{task.budget}</div>
                  <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
                </div>
              </div>
            </DCard>
          )
        })}
        {filtered.length===0&&<EmptyState icon="▤" message={`No ${filter==='all'?'':filter.replace('_',' ')} tasks`} action={<Btn size="sm" onClick={() => setPage('tasks-new')}>Post a Task</Btn>} />}
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
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(33,28,46,.14)':'none' }}>
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
        {filtered.length===0&&<EmptyState icon="◻" message="No bids in this category" action={<Btn size="sm" onClick={() => setPage('tasks-browse')}>Browse Tasks</Btn>} />}
      </div>
    </div>
  )
}

function Suggestions({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const toast = useToast()
  const [dismissed, setDismissed] = useState(new Set())
  const suggestions = MOCK_SUGGESTIONS.filter(s=>!dismissed.has(s.task_id)).map(s => { const live=state.tasks.find(t=>t.task_id===s.task_id); return live?{...s,status:live.status}:s })
  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <PageTitle sub="Ranked by Jaccard similarity score against your skill profile">For You</PageTitle>
        <Mono size="0.72rem" color="var(--text-secondary)">{suggestions.length} matches</Mono>
      </div>
      {suggestions.length===0&&<EmptyState icon="🎯" message="No more suggestions — check back soon" action={<Btn onClick={() => setDismissed(new Set())}>Reset</Btn>} />}
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
              <EmptyState icon="◎" message="Select a conversation" />
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
                {messages.length===0 && <EmptyState icon="◎" message="Start the conversation" />}
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

function Notifications({ setPage, setSelectedTask }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [notifs, setNotifs] = useState(state.notifications)
  const [offline, setOffline] = useState(false)
  const token = () => localStorage.getItem('rl_token')
  const icons = { 'bid.submitted':'⚡','bid.accepted':'🎉','task.matched':'🎯','task.completed':'✅','payment.released':'💰','escrow.funded':'🔒','dispute.resolved':'⚖️','review.received':'⭐','task.created':'✓' }

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
    if (n.reference_id && state.tasks.find(t=>t.task_id===n.reference_id)) { setSelectedTask(n.reference_id); setPage('task-detail') }
  }
  return (
    <div className="page-enter" style={{ maxWidth:680 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <PageTitle sub={`${notifs.filter(n=>!n.is_read).length} unread`}>Notifications</PageTitle>
        {notifs.some(n=>!n.is_read)&&<Btn variant="ghost" size="sm" onClick={markAll}>Mark all read</Btn>}
      </div>
      {notifs.length===0&&<EmptyState icon="◐" message="No notifications yet" />}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {notifs.map(n => (
          <div key={n.notification_id} onClick={() => handleClick(n)}
            style={{ background:n.is_read?'var(--bg-surface)':'var(--bg-elevated)', border:`1px solid ${n.is_read?'var(--border)':'var(--border-strong)'}`, borderRadius:'var(--radius-md)', padding:'14px 16px', display:'flex', gap:14, cursor:'pointer', transition:'all 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-strong)'}
            onMouseLeave={e => e.currentTarget.style.borderColor=n.is_read?'var(--border)':'var(--border-strong)'}>
            <div style={{ fontSize:'1.25rem', flexShrink:0, marginTop:2 }}>{icons[n.type]||'🔔'}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                <span style={{ fontWeight:n.is_read?400:600, fontSize:'0.9rem' }}>{n.title}</span>
                <Mono style={{ flexShrink:0, marginLeft:10 }}>{new Date(n.created_at).toLocaleDateString()}</Mono>
              </div>
              <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{n.body}</p>
              {state.tasks.find(t=>t.task_id===n.reference_id)&&<Mono color="var(--accent)" size="0.65rem" style={{ display:'block', marginTop:6 }}>Click to view →</Mono>}
            </div>
            {!n.is_read&&<div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', flexShrink:0, marginTop:6 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOCAL BUSINESS LISTINGS — student-facing browse + admin management
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

// Small image gallery used on business cards/detail
// ─── SOCIAL GRAPH ──────────────────────────────────────────────────────────────
// Follow/unfollow a user or business. Shows follower count + the viewer's state.
// Renders nothing for logged-out viewers (following is a signed-in action).
function FollowButton({ targetType, targetId, size }) {
  const [state, setState] = useState(null)   // { following, followers }
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
      if (res.ok) setState(s => ({ following: !was, followers: Math.max(0, (s.followers || 0) + (was ? -1 : 1)) }))
    } catch { /* ignore */ } finally { setBusy(false) }
  }
  return (
    <Btn variant={state.following ? 'secondary' : 'primary'} size={size} loading={busy} onClick={toggle}>
      {state.following ? '✓ Following' : '+ Follow'}{state.followers > 0 ? ` · ${state.followers}` : ''}
    </Btn>
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
      {empty ? <EmptyState icon="👥" message="You're not following anyone yet — follow people and businesses to see them here" />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {data.users.length > 0 && <div>
            <Mono style={{ display: 'block', marginBottom: 10 }}>People ({data.users.length})</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.users.map(u => (
                <DCard key={u.user_id} hover onClick={() => openProfile(u.user_id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                  {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(u.display_name || '?').charAt(0).toUpperCase()}</div>}
                  <span style={{ fontWeight: 600 }}>{u.display_name || 'ReLivR user'}</span>
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
                  <div><div style={{ fontWeight: 600 }}>{b.name || 'Business'}</div><Mono style={{ color: 'var(--text-muted)' }}>{b.category}</Mono></div>
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
function BizGridTile({ b, onOpen }) {
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

function LocalBrowse({ setPage }) {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [cat, setCat]               = useState('all')
  const [selected, setSelected]     = useState(null)
  const [lightbox, setLightbox]     = useState(null)   // photo index in the open profile, or null

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
        <button onClick={() => { setSelected(null); setLightbox(null) }} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', cursor:'pointer', marginBottom:18 }}>← Back to Local</button>

        {/* Profile header */}
        <div style={{ display:'flex', flexDirection:'column', gap:18, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:'clamp(18px,5vw,44px)', alignItems:'center' }}>
            {b.logo_url
              ? <img src={b.logo_url} alt="" style={{ width:avatarSize, height:avatarSize, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'1px solid var(--border)' }} />
              : <div style={{ width:avatarSize, height:avatarSize, borderRadius:'50%', flexShrink:0, background:'var(--accent-glow)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontFamily:'var(--font-display)', fontSize:'clamp(1.8rem,6vw,3rem)' }}>{initial}</div>}
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:14 }}>
                <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.3rem,4vw,1.7rem)', margin:0 }}>{b.name}</h1>
                <FollowButton targetType="business" targetId={b.business_id} size="sm" />
              </div>
              <div style={{ display:'flex', gap:'clamp(16px,4vw,30px)', flexWrap:'wrap', alignItems:'center', fontSize:'.9rem', color:'var(--text-secondary)' }}>
                <span><strong style={{ color:'var(--text-primary)' }}>{photos.length}</strong> photo{photos.length===1?'':'s'}</span>
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
              {b.address && <Mono>📍 {b.address}</Mono>}
              {b.hours   && <Mono>🕒 {b.hours}</Mono>}
            </div>
          </div>

          {/* Contact actions */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {b.phone    && <a href={`tel:${b.phone}`} onClick={() => trackBizEvent(b.business_id, 'phone_click')} style={{ textDecoration:'none' }}><Btn variant="secondary" size="sm">📞 Call</Btn></a>}
            {b.whatsapp && <a href={`https://wa.me/${b.whatsapp.replace(/[^0-9]/g,'')}`} onClick={() => trackBizEvent(b.business_id, 'whatsapp_click')} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}><Btn variant="secondary" size="sm">💬 WhatsApp</Btn></a>}
            {b.link_url && <a href={b.link_url} onClick={() => trackBizEvent(b.business_id, 'link_click')} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration:'none' }}><Btn variant="ghost" size="sm">🔗 Website</Btn></a>}
          </div>
        </div>

        {/* Photo grid */}
        {photos.length === 0
          ? <EmptyState icon="◇" message="No photos yet." />
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'clamp(2px,1vw,6px)', marginTop:4 }}>
              {photos.map((src, i) => (
                <div key={i} onClick={() => setLightbox(i)} style={{ aspectRatio:'1 / 1', overflow:'hidden', cursor:'pointer', background:'var(--bg-elevated)' }}>
                  <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                </div>
              ))}
            </div>}

        {lightbox != null && <BizLightbox images={photos} index={lightbox} onClose={() => setLightbox(null)} onNav={(d) => setLightbox(i => (i + d + photos.length) % photos.length)} />}
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div style={{ position:'relative', borderRadius:22, overflow:'hidden', marginBottom:22, boxShadow:'var(--shadow-md)' }}>
        <img src="/img/local-cafe.webp" alt="Local café near campus" loading="lazy" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg, rgba(33,28,46,.82) 0%, rgba(33,28,46,.5) 55%, rgba(33,28,46,.2) 100%)' }} />
        <div style={{ position:'relative', zIndex:1, padding:'clamp(26px,5vw,44px)' }}>
          <div className="slabel" style={{ color:'var(--highlight)', marginBottom:12 }}>Local Directory</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.6rem,3vw,2.2rem)', marginBottom:6, color:'#fff', letterSpacing:'-.01em' }}>Local in Makhanda</h1>
          <p style={{ color:'rgba(255,255,255,.85)', fontSize:'.95rem', maxWidth:440 }}>Discover the businesses around Grahamstown — supported by ReLivR.</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="feed-scroll" style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
        {['all', ...BIZ_CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding:'7px 14px', borderRadius:100, fontSize:'.82rem', fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', border:`1px solid ${cat===c?'var(--accent)':'var(--border)'}`, background:cat===c?'var(--accent)':'var(--bg-surface)', color:cat===c?'#fff':'var(--text-secondary)' }}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding:50, textAlign:'center' }}><Spinner /></div>
       : businesses.length === 0 ? (
        <EmptyState icon="◇" message={cat==='all' ? 'No local businesses listed yet — check back soon!' : `No businesses in ${cat} yet`} />
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'clamp(8px,1.5vw,16px)' }}>
          {businesses.map(b => (
            <BizGridTile key={b.business_id} b={b} onOpen={() => { setSelected(b); setLightbox(null); trackBizEvent(b.business_id, 'view') }} />
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
        <EmptyState icon="◇" message="No businesses yet — add your first local partner." action={<Btn onClick={() => setEditing('new')}>＋ Add Business</Btn>} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {businesses.map(b => (
            <DCard key={b.business_id} hover={false} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px' }}>
              <div style={{ width:48, height:48, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--bg-elevated)' }}>
                {(b.image_urls?.[0] || b.logo_url) ? <img src={b.logo_url || b.image_urls[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)' }}>◇</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700 }}>{b.name}</div>
                <Mono>{b.category}{b.signed_by_rep?` · ${b.signed_by_rep}`:''}</Mono>
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:statusColor[b.status]||'var(--text-muted)' }}>{b.status}</span>
              <Btn variant="secondary" size="sm" onClick={() => setEditing(b)}>Edit</Btn>
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
      <button onClick={onCancel} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', cursor:'pointer', marginBottom:16 }}>← Back to listings</button>
      <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.5rem', marginBottom:18 }}>{isNew ? 'Add a business' : 'Edit business'}</h1>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <DCard hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Public details</Mono>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Input label="Business name" value={f.name} onChange={set('name')} />
            <SelectField label="Category" value={f.category} onChange={set('category')}>
              {BIZ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <Textarea label="Description" value={f.description} onChange={set('description')} hint="1–2 sentences students will see." />
            <Input label="Address" value={f.address} onChange={set('address')} placeholder="e.g. 12 High Street, Makhanda" />
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
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Internal (not shown to students)</Mono>
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
  ru_student:    { icon:'🎓', label:'Rhodes student',  color:'#5b21b6', desc:'Verified @ru.ac.za email' },
  email_verified:{ icon:'✓',  label:'Verified',        color:'#15803d', desc:'Email verified via Google' },
  google_linked: { icon:'🔗', label:'Google-linked',   color:'#1d4ed8', desc:'Signed in with Google' },
  top_rated:     { icon:'⭐', label:'Top rated',        color:'#d97706', desc:'4.5+ stars across 5+ reviews' },
  established:   { icon:'🏅', label:'Established',      color:'#b45309', desc:'10+ tasks completed' },
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
    fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`)
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
      {!loading && error && <EmptyState icon="◷" message={error} />}
      {!loading && !error && total === 0 && (
        <EmptyState icon="◻" message={query ? `No people, businesses, or tasks match “${query}”.` : 'Search for people, businesses, or tasks.'} />
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
    fetch(`${API_BASE}/profile/public/${userId}`)
      .then(r => { if (!r.ok) throw new Error('Could not load profile'); return r.json() })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); setTab((d.completed?.length ? 'completed' : 'reviews')) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [userId])

  if (loading) return <div style={{ padding:60, textAlign:'center' }}><Spinner /></div>
  if (error || !data) return <EmptyState icon="◷" message={error || 'Profile not found'} action={<Btn onClick={() => setPage('tasks-browse')}>← Back to Browse</Btn>} />

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
        <button onClick={() => { if (window.history.length>1) window.history.back(); else setPage('tasks-browse') }}
          style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', cursor:'pointer' }}>← Back</button>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" size="sm" onClick={share}>🔗 Share</Btn>
          {isMe && <Btn variant="secondary" size="sm" onClick={() => setPage('profile')}>Edit profile</Btn>}
        </div>
      </div>

      {/* ── Hero ── */}
      <DCard hover={false} style={{ marginBottom:18, overflow:'hidden', padding:0 }}>
        <div style={{ height:88, background:'linear-gradient(120deg, var(--accent-dim), var(--bg-elevated))' }} />
        <div style={{ padding:'0 24px 22px', marginTop:-44 }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width:96, height:96, borderRadius:'50%', objectFit:'cover', border:'4px solid var(--bg-surface)', boxShadow:'0 2px 10px rgba(33,28,46,.12)' }} />
            : <div style={{ width:96, height:96, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'2.3rem', color:'#fff', border:'4px solid var(--bg-surface)', boxShadow:'0 2px 10px rgba(33,28,46,.12)' }}>{name.charAt(0).toUpperCase()}</div>}
          <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:12, flexWrap:'wrap' }}>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.7rem', lineHeight:1.1 }}>{name}</h1>
            {profile.beta_founder && (
              <span title="Joined during the ReLivR beta" style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(91,33,182,.1)', border:'1px solid rgba(91,33,182,.3)', color:'var(--amber)', borderRadius:100, padding:'3px 11px', fontFamily:'var(--font-mono)', fontSize:'.6rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em' }}>★ Founding Member</span>
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
              <FollowButton targetType="user" targetId={userId} />
            </div>
          )}
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
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', border:'none', whiteSpace:'nowrap', background:tab===tb.id?'var(--bg-surface)':'transparent', color:tab===tb.id?'var(--accent)':'var(--text-muted)', boxShadow:tab===tb.id?'0 1px 3px rgba(33,28,46,.14)':'none' }}>{tb.label}</button>
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
                {tab==='posted' && <Badge variant={t.status}>{t.status?.replace('_',' ')}</Badge>}
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
          <EmptyState icon="◻" message={tab==='completed' ? 'No completed tasks yet' : tab==='posted' ? 'No tasks posted yet' : 'No reviews yet'} />
        )}
      </div>
    </div>
  )
}

function Profile({ openProfile }) {
  const { user, logout } = useAuth()
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
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" style={{ width:72, height:72, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--bg-surface)', boxShadow:'var(--shadow-sm)', flexShrink:0, marginTop:-50 }} />
            : <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.6rem', color:'var(--accent)', border:'3px solid var(--bg-surface)', boxShadow:'var(--shadow-sm)', flexShrink:0, marginTop:-50 }}>{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</div>}
          <div style={{ minWidth:140, paddingBottom:4 }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', lineHeight:1.2, letterSpacing:'-0.01em' }}>{user.displayName || user.email?.split('@')[0]}</div>
            <Mono>{user.email}</Mono>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:0, paddingBottom:2 }}>
            <div style={{ textAlign:'center', padding:'0 22px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.35rem', color:'#d97706', lineHeight:1 }}>{avgRating || '—'}</div>
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
            <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:16, lineHeight:1.5 }}>This is what students see on your public profile. A strong headline and services section help you win more work.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Input label="Headline" value={headline} onChange={e=>setHeadline(e.target.value)} hint="One line, e.g. “First-year Stats tutor & freelance designer”" />
              <Textarea label="Services offered" value={services} onChange={e=>setServices(e.target.value)} style={{ minHeight:90 }} hint="What can people hire you for? Rates, availability, specialities." />
            </div>
          </DCard>
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
          {myReviews.length===0&&<EmptyState icon="★" message="No reviews yet — complete a task to receive your first review" />}
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

function BusinessDashboard({ onLogout, onViewLanding }) {
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
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ background:'var(--accent)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.85rem', padding:'4px 8px', borderRadius:'var(--radius-sm)', letterSpacing:'0.06em' }}>R</div>
            <span style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700 }}>ReLivR <span style={{ color:'var(--text-muted)', fontWeight:500 }}>· Business</span></span>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'.72rem', color:'var(--text-muted)' }}>{biz?.name || user?.email}</span>
            {biz?.follower_count > 0 && <span style={{ fontFamily:'var(--font-mono)', fontSize:'.68rem', fontWeight:600, color:'var(--accent)', background:'var(--accent-glow)', borderRadius:999, padding:'3px 10px', whiteSpace:'nowrap' }}>♡ {biz.follower_count} follower{biz.follower_count===1?'':'s'}</span>}
            {onViewLanding && <button onClick={onViewLanding} style={bizGhostBtn}>Public site</button>}
            <button onClick={onLogout} style={{ ...bizGhostBtn, color:'var(--danger)' }}>Sign out</button>
          </div>
        </div>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', gap:4, padding:'0 20px' }}>
          <button onClick={() => setTab('page')}      style={bizTab(tab==='page')}>My Page</button>
          <button onClick={() => setTab('deals')}     style={bizTab(tab==='deals')}>Deals</button>
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
         : tab === 'deals' ? <BusinessDeals biz={biz} />
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

// One deal as students see it (public grid + live preview in the editor).
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
        {onRedeem && !expired && (
          <button type="button" disabled={claimed} onClick={() => onRedeem(d)}
            style={{ marginTop: d.price_cents != null ? 8 : 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: claimed ? 'default' : 'pointer', fontWeight: 700, fontSize: '.82rem', background: claimed ? 'var(--bg-elevated)' : 'var(--accent)', color: claimed ? 'var(--text-muted)' : '#fff' }}>
            {claimed ? 'Claimed ✓' : 'Claim deal'}
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
        status: f.status, expiresAt, recurrence: f.recurrence,
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
    business_name: biz.name, logo_url: biz.logo_url,
  }

  return (
    <div className="page-enter">
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 16 }}>← Back to deals</button>
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
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn loading={saving} onClick={save}>{isNew ? 'Post deal' : 'Save changes'}</Btn>
              <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
            </div>
          </div>
        </DCard>
        <div>
          <Mono style={{ display: 'block', marginBottom: 10 }}>Live preview — how students see it</Mono>
          <div style={{ maxWidth: 280 }}><DealCard d={preview} /></div>
        </div>
      </div>
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
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Campus Deals</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', marginTop: 4 }}>Post a limited-time special. It appears on the public Deals page and auto-hides the moment it expires.</p>
        </div>
        <Btn onClick={() => { setEditing(null); setView('form') }}>＋ New deal</Btn>
      </div>
      {deals === null ? <div style={{ padding: 50, textAlign: 'center' }}><Spinner /></div>
        : deals.length === 0 ? <EmptyState icon="🏷" message="No deals yet — post your first special" action={<Btn size="sm" onClick={() => setView('form')}>＋ New deal</Btn>} />
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
function DealsPage() {
  const toast = useToast()
  const [deals, setDeals] = useState(null)
  const [claimed, setClaimed] = useState({})
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

  async function redeem(d) {
    const t = localStorage.getItem('rl_token')
    if (!t) { toast('Sign in to claim deals', 'error'); return }
    try {
      const res = await fetch(`${API_BASE}/deals/${d.deal_id}/redeem`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
      if (res.status === 201) { setClaimed(c => ({ ...c, [d.deal_id]: true })); toast('Deal claimed! Show this at the business.', 'success') }
      else if (res.status === 409) { setClaimed(c => ({ ...c, [d.deal_id]: true })); toast('You already claimed this today.', 'success') }
      else if (res.status === 400) toast("You can't claim your own deal.", 'error')
      else if (res.status === 401) toast('Sign in to claim deals', 'error')
      else toast('Could not claim the deal', 'error')
    } catch { toast('Could not claim the deal', 'error') }
  }

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', margin: 0 }}>Campus Deals</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Limited-time specials from local businesses. Grab them before they expire.</p>
      </div>
      {deals === null ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
        : deals.length === 0 ? <EmptyState icon="🏷" message="No live deals right now — check back soon" />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {deals.map(d => <DealCard key={d.deal_id} d={d} onRedeem={redeem} claimed={!!claimed[d.deal_id]} />)}
          </div>}
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
        : deals.length === 0 ? <EmptyState icon="🏷" message="No deals posted yet" />
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
  if (!data) return <EmptyState icon="◷" message="Couldn't load your client history" />

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Client History</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', marginTop: 4 }}>Everyone who's claimed your Campus Deals — your repeat-customer base.</p>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <BizStatTile label="Redemptions" value={data.total_redemptions} />
        <BizStatTile label="Unique clients" value={data.unique_customers} />
        <BizStatTile label="Repeat clients" value={data.repeat_customers} color="#15803d" />
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
        ? <EmptyState icon="👥" message="No redemptions yet — share your deals to start building your client base" />
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

function BusinessPageEditor({ biz, onSaved }) {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const s = biz.socials || {}
  const [f, setF] = useState({
    name: biz.name || '', tagline: biz.tagline || '', category: biz.category || '',
    description: biz.description || '', hours: biz.hours || '', address: biz.address || '',
    phone: biz.phone || '', whatsapp: biz.whatsapp || '', email: biz.email || '',
    themeColor: biz.theme_color || '#6C5CE7',
    coverImageUrl: biz.cover_image_url || '', logoUrl: biz.logo_url || '', linkUrl: biz.link_url || '',
    gallery: Array.isArray(biz.image_urls) ? biz.image_urls : [],
    instagram: s.instagram || '', facebook: s.facebook || '', tiktok: s.tiktok || '', website: s.website || '',
  })
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))
  const [saving, setSaving] = useState(false)
  const [imgInput, setImgInput] = useState('')

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
        hours: f.hours, address: f.address, phone: f.phone, whatsapp: f.whatsapp, email: f.email,
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
        <Mono style={{ display:'block', marginBottom:10 }}>Live preview — how students see you</Mono>
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
  if (!data)   return <EmptyState icon="📊" message="No analytics yet — they’ll appear as students view your page." />

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
  if (error || !stats) return <EmptyState icon="◷" message={error || 'No stats'} />

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
        {activity.length === 0 ? <EmptyState icon="◷" message="No activity recorded yet — actions will appear here." /> : (
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
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(33,28,46,.14)':'none' }}>
            {s.replace('_',' ')} ({s==='all'?disputes.length:disputes.filter(d=>d.status===s).length})
          </button>
        ))}
      </div>
      {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> :
       filtered.length===0 ? <EmptyState icon="⚖" message="No disputes in this category" /> : (
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
        : tasks.length === 0 ? <EmptyState icon="▤" message="No tasks match" />
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
        : rows.length === 0 ? <EmptyState icon="▦" message="No audit entries yet" />
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
          {filtered.length===0 && <EmptyState icon="◈" message="No users match your search" />}
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
    fetch(API_BASE + '/flags').then(r => r.ok ? r.json() : { flags:{} })
      .then(d => { if (alive) setFlags(d.flags || {}) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return flags
}

// Admin: add campuses / zones without writing SQL (§7.8).
function AdminLocations() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [campuses, setCampuses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm] = useState({ name:'', kind:'campus', parentId:'' })
  const [saving, setSaving] = useState(false)

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
       campuses.length===0 ? <EmptyState icon="◇" message="No locations yet — add your first campus." /> :
       campuses.map(c => (
        <DCard key={c.location_id} hover={false} style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700 }}>{c.name}</div>
            <Mono>{c.zones?.length || 0} zones</Mono>
          </div>
          {c.zones?.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>{c.zones.map(z => <Tag key={z.location_id}>{z.name}</Tag>)}</div>}
        </DCard>
      ))}
    </div>
  )
}

// Admin: toggle feature flags (§7.8).
function AdminFlags() {
  const toast = useToast()
  const token = () => localStorage.getItem('rl_token')
  const [flags, setFlags]   = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try { const res = await fetch(API_BASE + '/admin/flags', { headers:{ Authorization:`Bearer ${token()}` } }); if (res.ok) { const d = await res.json(); setFlags(d.flags || []) } }
    catch { /* offline */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function toggle(f) {
    try {
      const res = await fetch(`${API_BASE}/admin/flags/${f.flag_key}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify({ enabled: !f.enabled }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Could not update flag')
      setFlags(fs => fs.map(x => x.flag_key===f.flag_key ? { ...x, enabled: !x.enabled } : x))
      toast(`${f.flag_key} turned ${!f.enabled ? 'on' : 'off'}`, 'success')
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div className="page-enter">
      <PageTitle sub="Toggle features without a deploy">Feature Flags</PageTitle>
      {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> :
       flags.length===0 ? <EmptyState icon="⚑" message="No feature flags defined." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {flags.map(f => (
            <DCard key={f.flag_key} hover={false}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontFamily:'var(--font-mono)', fontSize:'0.88rem' }}>{f.flag_key}</div>
                  {f.description && <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{f.description}</div>}
                </div>
                <Btn variant={f.enabled ? 'success' : 'secondary'} size="sm" onClick={() => toggle(f)}>{f.enabled ? 'On' : 'Off'}</Btn>
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
  '/suggestions':     'suggestions',
  '/messages':        'messages',
  '/notifications':   'notifications',
  '/profile':         'profile',
  '/local':           'local-browse',
  '/deals':           'deals',
  '/following':       'following',
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
    <div role="dialog" aria-label="Cookie preferences" style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:1200, background:'var(--bg-surface)', borderTop:'1px solid var(--border)', boxShadow:'0 -4px 24px rgba(33,28,46,.14)', padding:'16px 20px' }}>
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

export default function App() {
  const [user, setUser]         = useState(null)
  const [userLoading, setUserLoading] = useState(true) // true while restoring session
  const initialLoc = parseLocation()
  const [view, setView] = useState(initialLoc.view)
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
          // Logged-in users must not see the landing page — redirect to app.
          const loc = parseLocation()
          if (loc.view === 'landing') {
            const home = u.role === 'admin' ? 'dashboard' : 'tasks-browse'
            setView('dashboard')
            setDashPage(home)
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
    setDashPage(u.role === 'admin' ? 'dashboard' : 'tasks-browse')
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

      if (!token || !userId) return false

      localStorage.setItem('rl_token', token)
      saveUser({ userId, email, role, displayName, avatarUrl, provider: 'google',
                 popia_consent: !needsConsent })
      setView('dashboard')
      setDashPage(role === 'admin' ? 'dashboard' : 'tasks-browse')
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
    // Clear all stored state
    localStorage.removeItem('rl_token')
    localStorage.removeItem('rl_user')
    sessionStorage.removeItem('rl_view')
    setUser(null)
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
      case 'tasks-browse':         return <TaskBrowse setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'search':               return <SearchResults query={searchQuery} setPage={setDashPage} setSelectedTask={setSelectedTask} openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />

      case 'task-detail':          return <TaskDetail taskId={selectedTask} setPage={setDashPage} openChat={(userId, name) => { setMessageTarget({ userId, name }); setDashPage('messages') }} openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />
      case 'tasks-new':            return <TaskNew setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'tasks-mine':           return <MyTasks setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'my-bids':              return <MyBids setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'suggestions':          return <Suggestions setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'messages':             return <Messages target={messageTarget} clearTarget={() => setMessageTarget(null)} />
      case 'notifications':        return <Notifications setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'profile':              return <Profile openProfile={(uid) => { setSelectedUser(uid); setDashPage('public-profile') }} />
      case 'public-profile':       return <PublicProfile userId={selectedUser} setPage={setDashPage} openChat={(uid, name) => { setMessageTarget({ userId: uid, name }); setDashPage('messages') }} />
      case 'admin-disputes':       return <AdminDisputes setPage={setDashPage} setSelectedDispute={setSelectedDispute} />
      case 'admin-dispute-detail': return <AdminDisputeDetail disputeId={selectedDispute} setPage={setDashPage} />
      case 'admin-users':          return <AdminUsers />
      case 'admin-locations':      return <AdminLocations />
      case 'admin-flags':          return <AdminFlags />
      case 'local-browse':         return <LocalBrowse setPage={setDashPage} />
      case 'deals':                return <DealsPage />
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
        <div style={{ textAlign:'center' }}>
          <div style={{ background:'var(--amber)', color:'#fff', fontFamily:'var(--fd)', fontWeight:800, fontSize:'1rem', padding:'8px 14px', borderRadius:8, marginBottom:16, display:'inline-block' }}>R</div>
          <div style={{ display:'block' }}><Spinner size={20} /></div>
        </div>
      </div>
    )
  }

  return (
    <AuthCtx.Provider value={authValue}>
      <StoreCtx.Provider value={storeValue}>
        <ToastProvider>

          {/* ── OAUTH CALLBACK — must be inside AuthCtx so useAuth() works ── */}
          {view === 'oauth-callback' && <OAuthCallback />}

          {/* ── LANDING PAGE ─────────────────────────────────── */}
          {view==='landing' && (
            <div>
              <LandingNavbar onOpenAuth={openAuth} onNav={navigate} user={user} onEnterApp={goAppHome} />
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
            <LaunchGate user={user} onLogout={logout} onViewLanding={() => navigate('landing')} />
          )}
          {/* Business partners get their own self-contained dashboard surface. */}
          {view==='dashboard' && user && !isAppLocked(user) && user.role==='business' && (
            <BusinessDashboard onLogout={logout} onViewLanding={() => navigate('landing')} />
          )}
          {view==='dashboard' && user && !isAppLocked(user) && user.role!=='business' && (
            <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)' }}>
              <TopBar page={dashPage} setPage={setDashPage} unreadCount={unreadCount} onGoHome={goAppHome} onViewLanding={() => navigate('landing')} onSearch={(q) => { setSearchQuery(q); setDashPage('search') }} />
              {/* DashSidebar is mobile-only now — CSS turns it into the bottom tab bar */}
              <DashSidebar page={dashPage} setPage={setDashPage} unreadCount={unreadCount} onGoHome={goAppHome} />
              <main className="dash-main" style={{ flex:1, width:'100%', maxWidth:1280, margin:'0 auto', padding:'28px 24px 60px' }}>
                {renderDashPage()}
              </main>
            </div>
          )}

          {/* POPIA consent gate — blocks the app until consent is explicitly given
              (chiefly the Google path, which can't capture consent at OAuth).
              Suppressed while the launch gate is up — they'll consent at launch. */}
          {user && user.popia_consent === false && !isAppLocked(user) && (
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
