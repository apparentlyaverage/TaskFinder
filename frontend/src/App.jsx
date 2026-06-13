// ─── UNIFIED RELIV APP ──────────────────────────────────────────────────
// Landing page → Auth → Dashboard
// All legal, product, and support pages included
// Single design system, single auth context, single router
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
  createContext, useContext, useReducer,
} from 'react'
import {
  MOCK_TASKS, MOCK_BIDS, MOCK_NOTIFICATIONS,
  MOCK_MESSAGES, MOCK_DISPUTES, MOCK_SUGGESTIONS,
} from './api/mock'

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
  --transition:    150ms ease;
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
.lcard { background:var(--bg-surface); border:1px solid var(--border); border-radius:14px; padding:26px; transition:border-color 200ms,transform 200ms,box-shadow 200ms; }
.lcard:hover { border-color:var(--border-strong); transform:translateY(-3px); box-shadow:0 12px 40px rgba(33,28,46,.10); }
.btn-p { background:var(--amber); color:#fff; border:none; padding:12px 26px; border-radius:10px; font-family:var(--fd); font-weight:700; font-size:.9rem; letter-spacing:.01em; cursor:pointer; transition:all 150ms; display:inline-flex; align-items:center; gap:7px; }
.btn-p:hover { background:var(--amber2); transform:translateY(-2px); box-shadow:0 8px 24px rgba(91,33,182,.35); }
.btn-p:disabled { opacity:.5; cursor:not-allowed; transform:none; }
.btn-s { background:transparent; color:var(--text-primary); border:1px solid var(--border-strong); padding:12px 26px; border-radius:10px; font-family:var(--fd); font-weight:700; font-size:.9rem; letter-spacing:.01em; cursor:pointer; transition:all 150ms; }
.btn-s:hover { border-color:var(--text-primary); background:rgba(33,28,46,.04); }
.btn-g { background:transparent; color:var(--text-muted); border:none; padding:10px 18px; font-family:var(--font-body); font-size:.875rem; cursor:pointer; transition:color 150ms; }
.btn-g:hover { color:var(--text-primary); }

/* Forms */
input, textarea, select { background:var(--bg-elevated); border:1px solid var(--border-strong); border-radius:10px; color:var(--text-primary); padding:11px 14px; font-size:.9rem; width:100%; outline:none; transition:border-color 150ms,box-shadow 150ms; }
input:focus, textarea:focus, select:focus { border-color:var(--amber); box-shadow:0 0 0 3px rgba(91,33,182,.1); }
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
      <span style={{ fontFamily:'var(--fd)', fontSize:'1.15rem', fontWeight:800, letterSpacing:'.02em' }}>ReLiv</span>
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
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && <label style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-secondary)' }}>{label}</label>}
      <input style={{ background:'var(--bg-surface)', border:`1px solid ${error?'var(--danger)':focused?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', outline:'none', width:'100%', fontSize:'0.9rem', boxShadow:focused?'0 0 0 3px var(--accent-glow)':'none', transition:'all 150ms ease', ...style }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...p} />
      {error && <span style={{ fontSize:'0.78rem', color:'var(--danger)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{hint}</span>}
    </div>
  )
}

function Textarea({ label, error, style={}, ...p }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && <label style={{ fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-secondary)' }}>{label}</label>}
      <textarea style={{ background:'var(--bg-surface)', border:`1px solid ${error?'var(--danger)':focused?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', outline:'none', width:'100%', resize:'vertical', minHeight:100, fontSize:'0.9rem', fontFamily:'var(--font-body)', boxShadow:focused?'0 0 0 3px var(--accent-glow)':'none', transition:'all 150ms ease', ...style }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...p} />
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
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12, opacity:0.25 }}>{icon}</div>
      <Mono style={{ display:'block', marginBottom:action?16:0 }}>{message}</Mono>
      {action && action}
    </div>
  )
}

function StatCard({ label, value, accent=false }) {
  return (
    <DCard hover={false} style={{ flex:1, minWidth:120 }}>
      <Mono style={{ display:'block', marginBottom:8 }}>{label}</Mono>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:700, color:accent?'var(--accent)':'var(--text-primary)', lineHeight:1 }}>{value}</div>
    </DCard>
  )
}

function Modal({ open, onClose, title, children, maxWidth=480 }) {
  useEffect(() => { if (open) document.body.style.overflow='hidden'; else document.body.style.overflow=''; return () => { document.body.style.overflow='' } }, [open])
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(33,28,46,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, backdropFilter:'blur(4px)', animation:'fadeIn 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, animation:'slideUp 0.2s ease both', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', letterSpacing:'-0.01em' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.2rem', cursor:'pointer', lineHeight:1, padding:'2px 6px', borderRadius:'var(--radius-sm)' }}>✕</button>
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

function LandingNavbar({ onOpenAuth, onNav }) {
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
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, background:scrolled?'rgba(250,249,246,.92)':'transparent', borderBottom:scrolled?'1px solid var(--border-strong)':'1px solid transparent', backdropFilter:scrolled?'blur(14px)':'none', transition:'all 300ms ease', padding:'0 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:66 }}>
          <Logo onClick={() => onNav('home')} />
          <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:32 }}>
            {navItems.map(item => <a key={item.label} href={item.href} className="nav-link">{item.label}</a>)}
          </div>
          <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="btn-g" onClick={() => onOpenAuth('login')}>Sign In</button>
            <button className="btn-p" onClick={() => onOpenAuth('register')}>Get Started →</button>
          </div>
          <button className="show-m" onClick={() => setDrawerOpen(true)}
            style={{ background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer', fontSize:'1.4rem', padding:8 }}>☰</button>
        </div>
      </nav>

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
          <button className="btn-s" onClick={() => { onOpenAuth('login'); setDrawerOpen(false) }}>Sign In</button>
          <button className="btn-p" style={{ justifyContent:'center' }} onClick={() => { onOpenAuth('register'); setDrawerOpen(false) }}>Get Started →</button>
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
          <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>© 2026 ReLiv (PTY) Ltd · All rights reserved</span>
          <span style={{ fontFamily:'var(--fm)', fontSize:'.62rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Registered in South Africa · POPIA Compliant</span>
        </div>
      </div>
    </footer>
  )
}

// ─── AUTH MODAL (unified — used from landing + dashboard sign out) ────────────

function AuthModal({ mode, onClose, onSwitch, onLogin }) {
  const { loginWithGoogle } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('creator')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]       = useState('')

  const presets = [
    { label:'Creator', role:'creator', email:'creator@demo.com' },
    { label:'Earner',  role:'earner',  email:'earner@demo.com' },
    { label:'Admin',   role:'admin',   email:'admin@demo.com' },
  ]

  function validate() {
    if (!email.includes('@')) return 'Enter a valid email address'
    if (password.length < 8)  return 'Password must be at least 8 characters'
    if (mode==='register' && !name.trim()) return 'Display name is required'
    return null
  }

  async function submit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError(''); setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const body     = mode === 'login'
        ? { email, password }
        : { email, password, role, displayName: name || email.split('@')[0] }

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
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
      // Network error — fall back to demo mode so app still works without backend
      console.warn('[auth] Backend unreachable, using demo mode:', err.message)
      onLogin({
        token:       'demo-token',
        userId:      'demo-' + Date.now(),
        email,
        role:        role || 'creator',
        displayName: name || email.split('@')[0],
        avatarUrl:   null,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // loginWithGoogle comes from AuthCtx (defined in App root)
  // It redirects to /auth/google → Vite proxies to localhost:3001 → Google consent screen

  return (
    <div className="moverlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'var(--fd)', fontSize:'1.25rem', fontWeight:800 }}>{mode==='login'?'Welcome back':'Create account'}</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em', marginTop:2 }}>ReLiv · Rhodes Campus</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem', padding:'4px 8px' }}>✕</button>
        </div>

        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:13 }}>

          {/* ── Google Sign-In button ── sits at the top, above the form ── */}
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

          {/* ── Divider between Google and email form ── */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
            <span style={{ fontFamily:'var(--fm)', fontSize:'.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.1em' }}>or continue with email</span>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>

          {/* ── Email / password form ── */}
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:13 }}>
            {mode==='register' && <div><label>Display Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></div>}
            <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ru.ac.za" required /></div>
            <div><label>Password {mode==='register'&&<span style={{ color:'#9a94a4' }}>(min 8 chars)</span>}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            {mode==='register' && (
              <div><label>I want to</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="creator">Post tasks and hire — Creator</option>
                  <option value="earner">Bid on tasks and earn — Earner</option>
                </select>
              </div>
            )}
            {mode==='login' && (
              <div>
                <Mono style={{ display:'block', marginBottom:8 }}>Quick demo login</Mono>
                <div style={{ display:'flex', gap:6 }}>
                  {presets.map(p => (
                    <button key={p.role} type="button" onClick={() => { setRole(p.role); setEmail(p.email) }}
                      style={{ flex:1, padding:'6px 8px', background:role===p.role?'var(--accent-glow)':'var(--bg-elevated)', border:`1px solid ${role===p.role?'var(--accent)':'var(--border)'}`, color:role===p.role?'var(--accent)':'var(--text-muted)', borderRadius:'var(--radius-sm)', fontSize:'0.72rem', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', transition:'all 150ms ease' }}>{p.label}</button>
                  ))}
                </div>
              </div>
            )}
            {mode==='register' && (
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <input type="checkbox" required style={{ width:'auto', marginTop:3, flexShrink:0, accentColor:'var(--amber)' }} />
                <span style={{ fontSize:'.76rem', color:'#6d6678', lineHeight:1.5 }}>I agree to the <span style={{ color:'var(--amber)', cursor:'pointer' }}>Terms of Service</span> and <span style={{ color:'var(--amber)', cursor:'pointer' }}>Privacy Policy</span></span>
              </div>
            )}
            {error && <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'9px 13px', fontSize:'.82rem', color:'var(--red)' }}>{error}</div>}
            <button type="submit" className="btn-p" style={{ width:'100%', justifyContent:'center', marginTop:4 }} disabled={loading || googleLoading}>
              {loading ? <Spinner /> : mode==='login'?'Sign In →':'Create Account →'}
            </button>
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
  { n:'03', role:'Creator', color:'var(--amber)', title:'Accept & Lock Funds', desc:'Review bids, pick the best fit, and fund escrow. Your money is protected until delivery.' },
  { n:'04', role:'Both',    color:'var(--purple)',title:'Work & Release',      desc:'Communicate through the platform. When done, release payment. Both sides win.' },
]

const STATS_DATA = [
  { v:'R0',   l:'Cost to Start' },
  { v:'10%',  l:'Fee on Completion Only' },
  { v:'24h',  l:'Avg First Bid Time' },
  { v:'100%', l:'Escrow Protected' },
]

const TESTIMONIALS_DATA = [
  { name:'Sipho M.',   role:'3rd Year CS · Earner',       rating:5, text:'I made R2400 in my first two weeks just fixing bugs and building small scripts for other students. ReLiv is the side hustle I didn\'t know I needed.' },
  { name:'Anika V.',   role:'PostGrad Law · Creator',      rating:5, text:'Got my thesis transcribed, my room cleaned, and my laptop fixed all through ReLiv. The escrow system means I never worried about paying upfront.' },
  { name:'Lethabo K.', role:'2nd Year Commerce · Earner',  rating:5, text:'The trust score system is what makes it different. People know I\'m a real Rhodes student, not some random from the internet.' },
]

function CampusStrip() {
  const slots = [
    { label:'[Image: Student earner fixing a laptop in res]',                    caption:'Tech help, same day' },
    { label:'[Image: Two students exchanging laundry bags outside Eden Grove]',  caption:'Errands, sorted' },
    { label:'[Image: Tutoring session on the library lawn]',                     caption:'Skills, shared' },
  ]
  return (
    <section style={{ padding:'72px 24px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div className="slabel" style={{ marginBottom:28 }}>Real campus, real tasks</div>
        <div className="tasks-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {slots.map((s,i) => (
            <figure key={i} style={{ margin:0 }}>
              <div style={{ aspectRatio:'4/3', borderRadius:18, background:'linear-gradient(135deg, var(--accent-dim), var(--bg-elevated))', border:'1px dashed var(--border-strong)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, textAlign:'center' }}>
                <Mono size="0.68rem">{s.label}</Mono>
              </div>
              <figcaption style={{ fontFamily:'var(--font-display)', fontWeight:700, marginTop:10, fontSize:'.95rem' }}>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function Hero({ onOpenAuth }) {
  return (
    <section style={{ minHeight:'100vh', display:'flex', alignItems:'center', padding:'110px 24px 72px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0, backgroundImage:'linear-gradient(rgba(33,28,46,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,28,46,.05) 1px,transparent 1px)', backgroundSize:'56px 56px' }} />
      <div style={{ position:'absolute', top:'15%', right:'8%', width:500, height:500, background:'radial-gradient(circle,rgba(91,33,182,.07) 0%,transparent 70%)', zIndex:0 }} />
      <div style={{ maxWidth:1200, margin:'0 auto', width:'100%', position:'relative', zIndex:1 }}>
        <div className="hero-inner" style={{ display:'flex', alignItems:'center', gap:60 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(91,33,182,.1)', border:'1px solid rgba(91,33,182,.25)', borderRadius:100, padding:'5px 14px', marginBottom:28, animation:'fadeUp .6s ease both' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--amber)', animation:'pulse 2s infinite', flexShrink:0 }} />
              <span style={{ fontFamily:'var(--fm)', fontSize:'.65rem', color:'var(--amber)', letterSpacing:'.1em', textTransform:'uppercase' }}>Now live on Rhodes Campus</span>
            </div>
            <h1 style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'clamp(2.8rem,6.5vw,5.2rem)', lineHeight:1.0, letterSpacing:'-.02em', marginBottom:24, animation:'fadeUp .6s .1s ease both', opacity:0, animationFillMode:'forwards' }}>
              Live more.<br /><span style={{ background:'linear-gradient(100deg, transparent 0%, var(--highlight) 6%, var(--highlight) 94%, transparent 100%)', padding:'0 0.18em', borderRadius:12, WebkitBoxDecorationBreak:'clone', boxDecorationBreak:'clone' }}>stress less.</span>
            </h1>
            <p style={{ fontSize:'clamp(.95rem,1.8vw,1.2rem)', color:'#5f5970', lineHeight:1.75, maxWidth:520, marginBottom:36, animation:'fadeUp .6s .2s ease both', opacity:0, animationFillMode:'forwards' }}>
              ReLiv connects Rhodes University students. Post a task, earn money, or get things done — all with escrow-protected payments and verified student trust scores.
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
            {['Post unlimited tasks','Receive unlimited bids','Built-in messaging','Escrow payment protection','Dispute resolution support'].map(item => (
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
              <span style={{ fontFamily:'var(--fd)', fontSize:'3rem', fontWeight:800, lineHeight:1 }}>10%</span>
              <span style={{ color:'#6d6678', fontSize:'.875rem' }}>per completed task</span>
            </div>
            <p style={{ color:'#6d6678', fontSize:'.875rem', marginBottom:24 }}>only when you get paid</p>
            <Divider style={{ marginBottom:20 }} />
            {['Bid on any open task','Verified student trust score','Stripe-powered instant payouts','Build a campus reputation','Zero upfront cost'].map(item => (
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
            <div className="slabel" style={{ marginBottom:18 }}>About ReLiv</div>
            <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:800, lineHeight:1.1, marginBottom:22 }}>Built for students,<br />by students.</h2>
            <p style={{ color:'#665f72', lineHeight:1.8, marginBottom:18, fontSize:'.9rem' }}>ReLiv started with a simple observation: Rhodes University has thousands of talented students who need extra income, and thousands more who need help getting things done. We built the infrastructure to connect them safely.</p>
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

function LandingCTA({ onOpenAuth }) {
  return (
    <section style={{ padding:'100px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:700, height:350, background:'radial-gradient(ellipse,rgba(91,33,182,.05) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div className="slabel" style={{ justifyContent:'center', marginBottom:18 }}>Get Started</div>
        <h2 style={{ fontFamily:'var(--fd)', fontSize:'clamp(2.2rem,4.5vw,3.8rem)', fontWeight:800, lineHeight:1.05, marginBottom:20, letterSpacing:'-.02em' }}>
          Ready to join your<br /><span style={{ color:'var(--amber)' }}>campus economy?</span>
        </h2>
        <p style={{ color:'#665f72', maxWidth:400, margin:'0 auto 36px', lineHeight:1.7, fontSize:'.9rem' }}>Join hundreds of Rhodes students already posting tasks, earning money, and getting things done.</p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn-p" style={{ fontSize:'.95rem', padding:'14px 34px' }} onClick={() => onOpenAuth('register')}>Create Free Account →</button>
          <button className="btn-s" style={{ fontSize:'.95rem', padding:'14px 34px' }} onClick={() => onOpenAuth('login')}>Sign In</button>
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
    <SidebarPage title="How ReLiv Works" subtitle="Product" sections={sections} onNav={onNav}>
      <div id="overview"><h2>Overview</h2><p>ReLiv is a peer-to-peer service marketplace designed exclusively for Rhodes University students. It connects people who need tasks done (Creators) with people who have the skills to do them (Earners).</p><div className="highlight"><p>🎓 ReLiv is a Rhodes-first platform. Linking your university SSO boosts your trust score significantly.</p></div></div>
      <div id="creators"><h2>For Creators</h2><h3>Posting a Task</h3><p>Creating a task takes less than 60 seconds. Provide a title, description, budget, deadline, and skill tags. Once posted, your task is immediately visible and earners with matching skills are notified automatically.</p><h3>Reviewing Bids</h3><p>Earners submit bids with a proposed price and pitch. You can review all bids, message earners directly, and take as long as you need before accepting.</p><h3>Accepting a Bid</h3><p>When you accept a bid, all other bids are automatically declined and the winning earner is notified. You are then prompted to fund the escrow — this secures the payment without charging you yet.</p><h3>Releasing Payment</h3><p>Once the task is complete to your satisfaction, you release the payment. Funds transfer immediately to the earner's account. You are then prompted to leave a review.</p></div>
      <div id="earners"><h2>For Earners</h2><h3>Finding Tasks</h3><p>Browse the task feed by skill, keyword, or campus zone. The Suggestions tab surfaces tasks specifically matched to your skill profile using our Jaccard similarity algorithm.</p><h3>Submitting a Bid</h3><p>Write a pitch explaining why you're the right person for the task and propose your price. You can bid on multiple tasks simultaneously and withdraw a bid at any time before it's accepted.</p><h3>Getting Paid</h3><p>Payments are processed via Stripe Connect and deposited directly to your linked bank account. The platform retains a 10% fee from your payout on each completed task.</p></div>
      <div id="payments"><h2>Payments & Escrow</h2><p>ReLiv uses an escrow model to protect both parties:</p><ul><li>Creator funds escrow → Stripe holds the money (no transfer yet)</li><li>Work is completed → Creator releases payment</li><li>Stripe captures the payment → Transfers to earner minus 10% platform fee</li><li>If disputed → Escrow is frozen until admin resolves it</li></ul><div className="highlight"><p>Your card is authorised but not charged until you release payment. If you raise a dispute before releasing, no charge is made.</p></div></div>
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
      <div id="overview"><h2>All Features</h2><p>ReLiv is built with a focused feature set designed around the realities of campus life. Everything was chosen because it solves a real problem for students.</p></div>
      <div id="matching"><h2>Smart Matching Engine</h2><p>When a task is posted, our matching engine automatically identifies earners whose skill profiles overlap with the task's skill tags using Jaccard similarity scoring. Earners are ranked by skill overlap score, average rating bonus (up to +20% for 5-star earners), and account longevity.</p></div>
      <div id="trust"><h2>Trust Score System</h2><p>Every user has a trust score between 0 and 100, calculated from:</p><ul><li><strong style={{color:'#3b3548'}}>Identity (40pts)</strong> — Rhodes SSO link (30pts) + verified email (10pts)</li><li><strong style={{color:'#3b3548'}}>Track record (40pts)</strong> — completed tasks (up to 20pts) + average rating (up to 20pts)</li><li><strong style={{color:'#3b3548'}}>Longevity (20pts)</strong> — 5 points per month, capped at 20</li><li><strong style={{color:'#3b3548'}}>Dispute penalty</strong> — -10pts per dispute raised against you</li></ul><div className="highlight"><p>Levels: Unverified (0–19) · New (20–49) · Established (50–79) · Verified (80–100)</p></div></div>
      <div id="escrow"><h2>Escrow System</h2><p>Our escrow is built on Stripe's PaymentIntent API with manual capture. Funds are authorised on the creator's card when escrow is funded, but no actual charge occurs until the creator releases payment. The 10% platform fee is deducted from the earner's payout, not added to the creator's charge.</p></div>
      <div id="messaging"><h2>Messaging</h2><p>Built-in real-time messaging via Socket.io. Features include task-scoped threads, pre-bid inquiry messages, read receipts, and message history preserved for dispute evidence.</p></div>
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
      <div id="overview"><h2>Pricing Overview</h2><p>ReLiv uses a simple success-based pricing model. We make money only when transactions succeed — aligning our incentives with yours.</p><div className="highlight"><p>No monthly fees. No posting fees. No signup fees. 10% is deducted from the earner's payout on each completed task.</p></div></div>
      <div id="creators"><h2>For Creators</h2><p>Posting tasks is completely free. You only pay the agreed task price when you release payment after the work is complete. There are no additional fees charged to creators beyond the agreed task price.</p></div>
      <div id="earners"><h2>For Earners</h2><p>Bidding and winning tasks is free. When a task is completed and payment is released, ReLiv retains 10% of the task value as a platform fee. Example: You win a R500 task. When the creator releases payment, you receive R450. ReLiv retains R50.</p></div>
      <div id="fees"><h2>Fee Breakdown</h2>
        <table><thead><tr><th>Action</th><th>Creator</th><th>Earner</th></tr></thead><tbody>
          {[['Post a task','Free','—'],['Submit a bid','—','Free'],['Task completed','Task price','Task price minus 10%'],['Dispute raised','Free','Free'],['Refund (dispute)','Full refund','No payout']].map(([a,c,e]) => (
            <tr key={a}><td>{a}</td><td>{c}</td><td>{e}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div id="faq"><h2>Frequently Asked Questions</h2><h3>What if a dispute is raised?</h3><p>If resolved in the creator's favour, escrow is cancelled and no charge is made. If resolved in the earner's favour, payment is released as normal minus the 10% platform fee.</p><h3>Are there VAT implications?</h3><p>ReLiv is not currently VAT registered. Earners are responsible for declaring their earnings to SARS as individual income.</p><h3>Can prices be negotiated outside the platform?</h3><p>All transactions must go through ReLiv's escrow system. Off-platform payments are not covered by our trust or dispute protection.</p></div>
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
      <div id="overview"><h2>Our Commitment to Safety</h2><p>ReLiv is built on the principle that two students from the same campus should be able to transact with confidence. Every feature exists to make that possible.</p><div className="highlight"><p>🔒 All payments are held in escrow and never leave the platform until both parties are satisfied — or an admin resolves a dispute.</p></div></div>
      <div id="trust-scores"><h2>Trust Scores</h2><p>Every user has a visible trust score calculated from verifiable signals: verified identity, completed transactions, earned ratings, and account history. A high trust score is not a guarantee of quality, but it is a meaningful signal that a user has a real, verified identity and a track record on the platform.</p></div>
      <div id="verification"><h2>Identity Verification</h2><p>To reach the highest trust tier, users must link their Rhodes University account (SSO). This verifies that the user is a current or recent Rhodes student and prevents anonymous bad-faith users from accumulating trust.</p></div>
      <div id="escrow"><h2>Payment Safety</h2><p>ReLiv never holds your money — it is held by Stripe, one of the world's most trusted payment processors (PCI DSS Level 1 certified). Your card details are never stored by ReLiv.</p></div>
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
    { id:'tasks',       label:'Tasks & Bids' },
    { id:'payments',    label:'Payments' },
    { id:'prohibited',  label:'Prohibited Use' },
    { id:'liability',   label:'Liability' },
    { id:'termination', label:'Termination' },
    { id:'governing',   label:'Governing Law' },
  ]
  return (
    <SidebarPage title="Terms of Service" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 1 January 2025</p>
      <div id="intro"><h2>1. Introduction</h2><p>These Terms of Service govern your access to and use of the ReLiv platform, operated by ReLiv (PTY) Ltd, registered in the Republic of South Africa. By creating an account or using the Platform, you agree to be bound by these Terms.</p></div>
      <div id="eligibility"><h2>2. Eligibility</h2><p>To use ReLiv you must be at least 18 years of age (or 16 with parental consent), be a current or recently enrolled student, staff member, or affiliate of Rhodes University, and have the legal capacity to enter into binding agreements under South African law.</p></div>
      <div id="accounts"><h2>3. Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials. You may only create one account per person. You agree to provide accurate, current, and complete information at registration and to keep this information updated.</p></div>
      <div id="tasks"><h2>4. Tasks and Bids</h2><p>ReLiv is a technology platform. We do not employ earners, control the quality of services rendered, or are a party to any agreement between a creator and an earner. All transactions must occur through the Platform's escrow system.</p></div>
      <div id="payments"><h2>5. Payments</h2><p>Payment processing is handled by Stripe. ReLiv charges a 10% platform fee deducted from the earner's payout on each completed transaction. No fees are charged to creators beyond the agreed task price.</p></div>
      <div id="prohibited"><h2>6. Prohibited Use</h2><p>You agree not to use the Platform to post or fulfil services illegal under South African law, facilitate academic dishonesty, harass or threaten any user, create fake reviews, circumvent the escrow system, or impersonate any person.</p></div>
      <div id="liability"><h2>7. Limitation of Liability</h2><p>ReLiv's liability in connection with any transaction or dispute is limited to the platform fees collected on that specific transaction. We are not liable for the quality of services, losses arising from transactions between users, or technical failures.</p></div>
      <div id="termination"><h2>8. Termination</h2><p>You may close your account at any time after resolving pending transactions. We reserve the right to suspend or terminate any account for violations of these Terms.</p></div>
      <div id="governing"><h2>9. Governing Law</h2><p>These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the jurisdiction of the South African courts.</p><div className="highlight"><p>Questions? Email <a href="mailto:legal@reliv.co.za">legal@reliv.co.za</a></p></div></div>
    </SidebarPage>
  )
}

function PrivacyPage({ onNav }) {
  const sections = [
    { id:'intro',     label:'Introduction' },
    { id:'collect',   label:'What We Collect' },
    { id:'use',       label:'How We Use It' },
    { id:'share',     label:'Who We Share With' },
    { id:'retention', label:'Data Retention' },
    { id:'rights',    label:'Your Rights' },
    { id:'security',  label:'Security' },
    { id:'contact',   label:'Contact' },
  ]
  return (
    <SidebarPage title="Privacy Policy" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 1 January 2025</p>
      <div id="intro"><h2>1. Introduction</h2><p>ReLiv (PTY) Ltd is committed to protecting your personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and all other applicable South African law.</p></div>
      <div id="collect"><h2>2. What We Collect</h2><p>We collect: name and email at registration, profile information (bio, skills, portfolio), task descriptions and messages, identity verification documents (for Stripe), IP address and device info, and transaction history.</p></div>
      <div id="use"><h2>3. How We Use It</h2><p>We use your information to operate the Platform, process transactions, calculate trust scores, send transactional notifications, resolve disputes, comply with legal obligations, and detect fraud. We do not use your information for advertising or sell it to third parties.</p></div>
      <div id="share"><h2>4. Who We Share With</h2><p>We share only with: Stripe (payment processing), Neon.tech (database hosting in EU), Vercel (frontend hosting), and law enforcement where required by law. We do not sell or share your data with advertisers.</p></div>
      <div id="retention"><h2>5. Data Retention</h2><p>We retain your personal information for as long as your account is active, plus a further period required by law (typically 5 years for financial records). When you delete your account, we anonymise your personal information within 30 days.</p></div>
      <div id="rights"><h2>6. Your Rights Under POPIA</h2><p>You have the right to access, correct, or delete your personal information, object to processing, and lodge a complaint with the Information Regulator.</p><div className="highlight"><p>Information Regulator: <a href="https://inforeg.org.za">inforeg.org.za</a> · complaints.IR@justice.gov.za</p></div></div>
      <div id="security"><h2>7. Security</h2><p>We implement TLS encryption for all data in transit, AES-256 encryption for sensitive data at rest, JWT-based authentication, rate limiting and DDoS protection, and regular security reviews. In the event of a data breach we will notify you and the Information Regulator within 72 hours.</p></div>
      <div id="contact"><h2>8. Contact</h2><p>Email: <a href="mailto:privacy@reliv.co.za">privacy@reliv.co.za</a><br />Address: Rhodes University, Makhanda, Eastern Cape, 6140</p></div>
    </SidebarPage>
  )
}

function CookiesPage({ onNav }) {
  const sections = [
    { id:'what',    label:'What Are Cookies' },
    { id:'use',     label:'How We Use Them' },
    { id:'types',   label:'Types of Cookies' },
    { id:'control', label:'Your Control' },
  ]
  return (
    <SidebarPage title="Cookie Policy" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 1 January 2025</p>
      <div id="what"><h2>1. What Are Cookies</h2><p>Cookies are small text files stored in your browser when you visit a website. They allow websites to remember information about your visit.</p></div>
      <div id="use"><h2>2. How We Use Cookies</h2><p>ReLiv uses cookies to keep you logged in between sessions, remember your preferences, ensure security by detecting unusual activity, and understand how you use the Platform. We do not use cookies for advertising.</p></div>
      <div id="types"><h2>3. Types of Cookies We Use</h2><h3>Strictly Necessary</h3><p>Required for the Platform to function. Includes your authentication token (JWT). You cannot opt out of these.</p><h3>Functional</h3><p>Remember your preferences such as display settings.</p><h3>Analytics</h3><p>Help us understand how users interact with the Platform. Data is aggregated and anonymised.</p></div>
      <div id="control"><h2>4. Your Control</h2><p>You can control and delete cookies through your browser settings. Disabling strictly necessary cookies will prevent you from logging in.</p><div className="highlight"><p>Questions? Email <a href="mailto:privacy@reliv.co.za">privacy@reliv.co.za</a></p></div></div>
    </SidebarPage>
  )
}

function POPIAPage({ onNav }) {
  const sections = [
    { id:'overview',   label:'POPIA Overview' },
    { id:'lawful',     label:'Lawful Processing' },
    { id:'officer',    label:'Information Officer' },
    { id:'rights',     label:'Data Subject Rights' },
    { id:'breaches',   label:'Data Breaches' },
    { id:'transfers',  label:'Cross-Border Transfers' },
  ]
  return (
    <SidebarPage title="POPIA Compliance" subtitle="Legal" sections={sections} onNav={onNav}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--fm)', fontSize:'.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:24 }}>Last updated: 1 January 2025</p>
      <div id="overview"><h2>POPIA Compliance Statement</h2><p>ReLiv (PTY) Ltd is committed to compliance with the Protection of Personal Information Act 4 of 2013 (POPIA), South Africa's primary data protection legislation.</p><div className="highlight"><p>POPIA came into full effect on 1 July 2021. It gives South Africans rights over their personal information and places obligations on organisations that process it.</p></div></div>
      <div id="lawful"><h2>Lawful Bases for Processing</h2><p>We process personal information on the following lawful bases: contractual necessity (to deliver Platform services), consent (for non-essential communications), legal obligation (financial record-keeping), and legitimate interests (fraud detection and Platform security).</p></div>
      <div id="officer"><h2>Information Officer</h2><p>ReLiv has designated an Information Officer responsible for overseeing POPIA compliance. Contact: <a href="mailto:privacy@reliv.co.za">privacy@reliv.co.za</a> · Rhodes University, Makhanda, Eastern Cape, 6140.</p></div>
      <div id="rights"><h2>Data Subject Rights</h2><p>Under POPIA, you have the right to be notified of processing, access your information, request correction or deletion, object to processing, and lodge a complaint with the Information Regulator.</p><div className="highlight"><p>Information Regulator: <a href="https://inforeg.org.za">inforeg.org.za</a> · +27 10 023 5207 · complaints.IR@justice.gov.za</p></div></div>
      <div id="breaches"><h2>Data Breaches</h2><p>In the event of a security breach, ReLiv will notify the Information Regulator within 72 hours of becoming aware, notify affected data subjects as soon as reasonably possible, document the breach and remedial actions, and cooperate fully with any investigation.</p></div>
      <div id="transfers"><h2>Cross-Border Data Transfers</h2><p>Some personal information is processed outside South Africa: Stripe (United States — PCI DSS Level 1), Neon.tech (EU Frankfurt — GDPR compliant), Vercel (United States — SOC 2). All transfers are governed by appropriate data processing agreements.</p></div>
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
      <div id="getting-started"><h2>Getting Started</h2><h3>How do I create an account?</h3><p>Click "Get Started" on the homepage, fill in your name, email, and password, and choose whether you want to post tasks (Creator) or earn money (Earner). You can explore both roles after signup.</p><h3>Is it free to sign up?</h3><p>Yes. Creating an account is completely free. There are no monthly fees or charges for browsing.</p><h3>Do I need a Rhodes email?</h3><p>Any email works to create an account, but linking your Rhodes University SSO account increases your trust score significantly.</p></div>
      <div id="creators"><h2>For Creators</h2><h3>How do I post a task?</h3><p>Log in, click "Post Task", fill in the details (title, description, budget, deadline, skill tags), review, and submit. It goes live immediately.</p><h3>What if the earner does poor work?</h3><p>Don't release payment. Use in-platform messaging to give specific feedback and request revisions. If the earner refuses, raise a dispute. Do not release payment until you are satisfied.</p></div>
      <div id="earners"><h2>For Earners</h2><h3>How do I write a good pitch?</h3><p>Be specific. Reference the task directly, explain your relevant experience, give a realistic timeline, and be honest about your price. Generic pitches get ignored.</p><h3>How quickly do I get paid?</h3><p>Once the creator releases payment, Stripe processes the transfer. Payout timing is typically 1–3 business days for South African bank accounts.</p></div>
      <div id="payments"><h2>Payments</h2><h3>My payment failed. What do I do?</h3><p>Check your card details are correct and that you have sufficient funds. If the problem persists, try a different card or contact your bank.</p><h3>Can I get a refund if I'm not happy?</h3><p>Refunds are only processed through the dispute resolution system. Do not release payment until you are satisfied — once released we cannot reverse the transfer.</p></div>
      <div id="account"><h2>My Account</h2><h3>How do I change my password?</h3><p>Go to Profile → Security → Change Password. You will need your current password to set a new one.</p><h3>How do I delete my account?</h3><p>Go to Profile → Security → Delete Account. Pending transactions must be resolved before deletion.</p></div>
      <div id="technical"><h2>Technical Issues</h2><h3>The app doesn't work on my phone.</h3><p>ReLiv is designed to work on all modern mobile browsers. Try Chrome on Android or Safari on iOS. If the problem persists, please report it.</p><div className="highlight"><p>Still stuck? Email <a href="mailto:support@reliv.co.za">support@reliv.co.za</a> — we respond within 24 hours.</p></div></div>
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
      <div id="overview"><h2>Our Community Standards</h2><p>ReLiv works because students trust each other. These guidelines exist to protect that trust and ensure the platform remains a safe, fair place for everyone on campus.</p></div>
      <div id="respect"><h2>Respect</h2><p>Every person on ReLiv is a member of the Rhodes community. Treat them accordingly.</p><ul><li>Communicate professionally, even when disagreements arise</li><li>No harassment, threats, hate speech, or discriminatory language</li><li>Respect boundaries — if someone withdraws from a transaction, accept it</li><li>Do not share other users' personal information outside the platform</li></ul></div>
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
  // First 5 = native bottom-tab bar on mobile; the rest stay desktop-only
  creator: [
    { id:'tasks-browse',  label:'Home',      icon:'⌂' },
    { id:'tasks-new',     label:'Post',      icon:'＋' },
    { id:'tasks-mine',    label:'My Tasks',  icon:'▤' },
    { id:'messages',      label:'Messages',  icon:'◎' },
    { id:'profile',       label:'Profile',   icon:'◷' },
    { id:'dashboard',     label:'Stats',     icon:'⊞' },
    { id:'notifications', label:'Alerts',    icon:'◉' },
  ],
  earner: [
    { id:'tasks-browse',  label:'Home',      icon:'⌂' },
    { id:'suggestions',   label:'For You',   icon:'◈' },
    { id:'my-bids',       label:'My Bids',   icon:'▤' },
    { id:'messages',      label:'Messages',  icon:'◎' },
    { id:'profile',       label:'Profile',   icon:'◷' },
    { id:'dashboard',     label:'Stats',     icon:'⊞' },
    { id:'notifications', label:'Alerts',    icon:'◐' },
  ],
  admin: [
    { id:'dashboard',       label:'Dashboard', icon:'⊞' },
    { id:'admin-disputes',  label:'Disputes',  icon:'⚖' },
    { id:'admin-users',     label:'Users',     icon:'◈' },
    { id:'tasks-browse',    label:'All Tasks', icon:'▤' },
    { id:'notifications',   label:'Alerts',    icon:'◐' },
  ],
}

function TopBar({ page, setPage, unreadCount, onGoHome }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const isCreator = user.role === 'creator'
  return (
    <header style={{ position:'sticky', top:0, zIndex:90, background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
      <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', alignItems:'center', gap:14, height:60, padding:'0 20px' }}>
        <Logo onClick={onGoHome} />

        {/* Search — desktop only; tapping it lands on the feed where real search lives */}
        <div className="hide-m" style={{ flex:1, maxWidth:480, margin:'0 12px' }}>
          <button onClick={() => setPage('tasks-browse')}
            style={{ width:'100%', textAlign:'left', padding:'9px 16px', borderRadius:100, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', fontSize:'.875rem', cursor:'pointer' }}>
            ⌕ Search tasks…
          </button>
        </div>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
          {isCreator && (
            <button className="hide-m btn-p" style={{ padding:'9px 18px', fontSize:'.85rem' }} onClick={() => setPage('tasks-new')}>＋ Post a Task</button>
          )}
          <button onClick={() => setPage('messages')} title="Messages"
            style={{ width:38, height:38, borderRadius:'50%', border:'none', background:page==='messages'?'var(--accent-glow)':'transparent', color:page==='messages'?'var(--accent)':'var(--text-secondary)', fontSize:'1.05rem', cursor:'pointer' }}>◎</button>
          <button onClick={() => setPage('notifications')} title="Alerts"
            style={{ position:'relative', width:38, height:38, borderRadius:'50%', border:'none', background:page==='notifications'?'var(--accent-glow)':'transparent', color:page==='notifications'?'var(--accent)':'var(--text-secondary)', fontSize:'1.05rem', cursor:'pointer' }}>
            ◉{unreadCount>0 && <span style={{ position:'absolute', top:4, right:4, background:'var(--danger)', color:'#fff', fontFamily:'var(--font-mono)', fontSize:'.55rem', fontWeight:700, minWidth:15, height:15, lineHeight:'15px', borderRadius:8, textAlign:'center', padding:'0 3px' }}>{unreadCount}</span>}
          </button>

          {/* Avatar menu */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)} style={{ background:'none', border:'none', padding:2, cursor:'pointer', display:'flex' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--accent-dim)' }} />
                : <span style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'.9rem', color:'var(--accent)' }}>{(user.displayName||user.email||'?').charAt(0).toUpperCase()}</span>}
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
                    { label:isCreator?'My Tasks':'My Bids', go:isCreator?'tasks-mine':'my-bids' },
                    { label:'Stats & Activity', go:'dashboard' },
                  ].map(item => (
                    <button key={item.go} onClick={() => { setPage(item.go); setMenuOpen(false) }}
                      style={{ display:'block', width:'100%', textAlign:'left', padding:'11px 16px', background:'none', border:'none', fontSize:'.875rem', color:'var(--text-secondary)', cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>{item.label}</button>
                  ))}
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
  const items = NAV[user.role] || []

  return (
    <aside className="dash-sidebar" style={{ background:'var(--bg-surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'20px 14px', position:'sticky', top:0, height:'100vh', overflowY:'auto', width:220, flexShrink:0 }}>
      <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
        <div onClick={onGoHome} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }}>
          <div style={{ background:'var(--accent)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.85rem', padding:'4px 8px', borderRadius:'var(--radius-sm)', letterSpacing:'0.06em' }}>R</div>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700, letterSpacing:'-0.01em' }}>ReLiv</span>
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
        {user.role==='creator' && <>
          <StatCard label="Tasks Posted" value={myTasks.length} />
          <StatCard label="Open Bids"    value={state.bids.filter(b=>state.tasks.find(t=>t.creator_id==='u1'&&t.task_id===b.task_id)&&b.status==='pending').length} accent />
          <StatCard label="Completed"    value={doneCount} />
          <StatCard label="Total Spent"  value={`R${myTasks.filter(t=>t.status==='completed').reduce((s,t)=>s+parseFloat(t.budget||0),0).toLocaleString()}`} />
        </>}
        {user.role==='earner' && <>
          <StatCard label="Open Tasks"   value={openCount} />
          <StatCard label="Active Bids"  value={myBids.filter(b=>b.status==='pending'||b.status==='accepted').length} accent />
          <StatCard label="Jobs Done"    value={myBids.filter(b=>b.status==='accepted').length} />
          <StatCard label="Suggestions"  value={MOCK_SUGGESTIONS.length} />
        </>}
        {user.role==='admin' && <>
          <StatCard label="Open Disputes" value={state.disputes.filter(d=>d.status==='open').length} accent />
          <StatCard label="Total Tasks"   value={state.tasks.length} />
          <StatCard label="Active Users"  value="24" />
          <StatCard label="Platform Fees" value="R340" />
        </>}
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:28, flexWrap:'wrap' }}>
        {user.role==='creator' && <>
          <Btn onClick={() => setPage('tasks-new')}>+ Post New Task</Btn>
          <Btn variant="secondary" onClick={() => setPage('tasks-mine')}>View My Tasks</Btn>
          <Btn variant="secondary" onClick={() => setPage('messages')}>Messages</Btn>
        </>}
        {user.role==='earner' && <>
          <Btn onClick={() => setPage('tasks-browse')}>Browse Open Tasks</Btn>
          <Btn variant="secondary" onClick={() => setPage('suggestions')}>View Suggestions</Btn>
          <Btn variant="secondary" onClick={() => setPage('my-bids')}>My Bids</Btn>
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
  const [status, setStatus] = useState('all')
  const [sort, setSort]     = useState('newest')

  const filtered = state.tasks
    .filter(t => (status==='all'||t.status===status) && (!cat || categoryFor(t).name===cat) && (!skill||t.skill_tags.some(s=>s.toLowerCase().includes(skill.toLowerCase()))||t.title.toLowerCase().includes(skill.toLowerCase())))
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
          <input placeholder="Search — laundry, python, tutoring…" value={skill} onChange={e => setSkill(e.target.value)}
            style={{ padding:'14px 16px 14px 44px', borderRadius:14, fontSize:'1rem', background:'var(--bg-surface)', boxShadow:'0 1px 4px rgba(33,28,46,.07)' }} />
        </div>
      </div>

      {/* Illustrated category rail */}
      <div className="feed-scroll" style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:18, paddingBottom:4 }}>
        {CATEGORIES.map(c => {
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:14 }}>
        {filtered.map(task => (
          <DCard key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }} style={{ padding:0, overflow:'hidden' }}>
            <CardCover task={task} />
            <div style={{ padding:'14px 16px 16px' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:700, marginBottom:6, lineHeight:1.3 }}>{task.title}</h2>
              <Mono style={{ display:'block', marginBottom:10 }}>📍 {task.campus_zone || 'Rhodes Campus'} · {timeAgo(task.created_at)}</Mono>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>{task.skill_tags.slice(0,3).map(t => <Tag key={t}>{t}</Tag>)}</div>
              <Divider style={{ marginBottom:10 }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
                <Mono>{state.bids.filter(b=>b.task_id===task.task_id&&b.status!=='withdrawn').length} bid{state.bids.filter(b=>b.task_id===task.task_id&&b.status!=='withdrawn').length!==1?'s':''}</Mono>
              </div>
            </div>
          </DCard>
        ))}
        {filtered.length===0 && <div style={{ gridColumn:'1/-1' }}><EmptyState icon="◻" message="No tasks match your filter" action={filtersActive?<Btn variant="secondary" size="sm" onClick={() => { setSkill(''); setCat(null); setStatus('all'); setSort('newest') }}>Clear Filters</Btn>:null} /></div>}
      </div>
    </div>
  )
}

function TaskDetail({ taskId, setPage }) {
  const { user } = useAuth()
  const { state, dispatch } = useStore()
  const toast = useToast()
  const task  = state.tasks.find(t => t.task_id===taskId)
  const bids  = state.bids.filter(b => b.task_id===taskId&&b.status!=='withdrawn')
  const escrow = state.escrows[taskId]

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

  const myBid     = state.bids.find(b=>b.task_id===taskId&&b.bidder_id==='u3')
  const alreadyBid = !!myBid&&myBid.status!=='withdrawn'
  const isCreator = user.role==='creator'
  const isEarner  = user.role==='earner'
  const acceptedBid = bids.find(b=>b.status==='accepted')
  const currentTask = state.tasks.find(t=>t.task_id===taskId)
  const currentStatus = currentTask?.status || task?.status

  if (!task) return <EmptyState message="Task not found" action={<Btn onClick={() => setPage('tasks-browse')}>← Back</Btn>} />

  function submitBid() {
    const errs = {}
    if (!bidAmount||isNaN(bidAmount)||parseFloat(bidAmount)<=0) errs.amount='Enter a valid amount'
    if (!bidPitch.trim()||bidPitch.trim().length<20) errs.pitch='Pitch must be at least 20 characters'
    if (Object.keys(errs).length) { setBidErrors(errs); return }
    setBidErrors({}); setBidLoading(true)
    setTimeout(() => {
      const newBid = { bid_id:`b${Date.now()}`, task_id:taskId, bidder_id:'u3', amount:bidAmount, pitch:bidPitch.trim(), status:'pending', display_name:user.displayName||'You', avg_rating:4.2, created_at:new Date().toISOString() }
      dispatch({ type:'ADD_BID', bid:newBid })
      toast(`Bid of R${bidAmount} submitted!`, 'success')
      setBidLoading(false); setBidAmount(''); setBidPitch('')
    }, 900)
  }

  function confirmAccept() {
    setAcceptLoading(true)
    setTimeout(() => {
      dispatch({ type:'UPDATE_BID', bid_id:acceptModal.bid_id, changes:{status:'accepted'} })
      dispatch({ type:'REJECT_OTHER_BIDS', task_id:taskId, accepted_bid_id:acceptModal.bid_id })
      dispatch({ type:'UPDATE_TASK', task_id:taskId, changes:{status:'in_progress',assigned_to:acceptModal.bidder_id} })
      dispatch({ type:'SET_ESCROW', task_id:taskId, status:'pending_payment' })
      toast('Bid accepted! Fund escrow to begin work.', 'success')
      setAcceptLoading(false); setAcceptModal(null)
    }, 1000)
  }

  function confirmFund() {
    setFundLoading(true)
    setTimeout(() => {
      dispatch({ type:'SET_ESCROW', task_id:taskId, status:'funded' })
      toast('Escrow funded! Earner notified to begin.', 'success')
      setFundLoading(false); setFundModal(false)
    }, 1200)
  }

  function confirmRelease() {
    setReleaseLoading(true)
    setTimeout(() => {
      dispatch({ type:'UPDATE_TASK', task_id:taskId, changes:{status:'completed'} })
      dispatch({ type:'SET_ESCROW', task_id:taskId, status:'released' })
      toast(`R${task.budget} released to earner!`, 'success')
      setReleaseLoading(false); setReleaseModal(false)
      setTimeout(() => setReviewModal(true), 600)
    }, 1100)
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

  function submitReview() {
    if (!reviewRating) { toast('Please select a star rating', 'error'); return }
    setReviewLoading(true)
    setTimeout(() => {
      dispatch({ type:'ADD_REVIEW', review:{ review_id:`r${Date.now()}`, task_id:taskId, reviewer_id:'u1', reviewee_id:acceptedBid?.bidder_id||'u3', rating:reviewRating, comment:reviewComment.trim(), role:'creator', created_at:new Date().toISOString() } })
      toast('Review submitted — thank you!', 'success')
      setReviewLoading(false); setReviewModal(false); setReviewDone(true)
    }, 800)
  }

  return (
    <div className="page-enter" style={{ maxWidth:920 }}>
      <button onClick={() => setPage('tasks-browse')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer', marginBottom:20 }}>← Back to Tasks</button>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
            <Badge variant={currentStatus}>{currentStatus?.replace('_',' ')}</Badge>
            <Mono>Task #{task.task_id}</Mono>
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.9rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.03em', lineHeight:1.1, maxWidth:580 }}>{task.title}</h1>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.6rem', color:'var(--accent)', fontWeight:500 }}>R{task.budget}</div>
          <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
        </div>
      </div>

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

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
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
                        <span style={{ fontWeight:600, fontSize:'0.9rem' }}>{bid.display_name}</span>
                        {bid.bidder_id==='u3'&&<span style={{ marginLeft:8, fontSize:'0.72rem', color:'var(--accent)', fontFamily:'var(--font-mono)' }}>(You)</span>}
                        <div style={{ marginTop:3 }}><Stars rating={bid.avg_rating} /></div>
                      </div>
                      <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'1.05rem', color:'var(--accent)' }}>R{bid.amount}</span>
                        <Badge variant={bid.status}>{bid.status}</Badge>
                      </div>
                    </div>
                    <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:isCreator&&bid.status==='pending'?12:0 }}>{bid.pitch}</p>
                    {isCreator&&bid.status==='pending'&&currentStatus==='open'&&<Btn variant="primary" size="sm" onClick={() => setAcceptModal(bid)}>Accept This Bid</Btn>}
                  </div>
                ))}
              </div>
            )}
          </DCard>

          {isCreator&&currentStatus==='in_progress'&&escrow?.status==='funded'&&(
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="success" onClick={() => setReleaseModal(true)}>✓ Release Payment</Btn>
              <Btn variant="danger" onClick={() => setDisputeModal(true)}>⚠ Raise Dispute</Btn>
            </div>
          )}
          {currentStatus==='completed'&&isCreator&&!reviewDone&&(
            <DCard hover={false} style={{ border:'1px solid var(--accent)', background:'var(--accent-glow)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div><div style={{ fontWeight:600, marginBottom:4 }}>Task complete — leave a review</div><p style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>Help other creators find great earners.</p></div>
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
              <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginTop:6 }}>{escrow?.status==='funded'?'Escrow is funded — work can begin!':'Waiting for creator to fund escrow.'}</p>
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
          <Btn variant="secondary" fullWidth onClick={() => setPage('messages')}>💬 Send a Message</Btn>
        </div>
      </div>

      <ConfirmModal open={!!acceptModal} onClose={() => setAcceptModal(null)} onConfirm={confirmAccept} loading={acceptLoading} title="Accept This Bid" confirmLabel="Accept & Move to Escrow" confirmVariant="primary" message={acceptModal?`Accept ${acceptModal.display_name}'s bid of R${acceptModal.amount}? All other bids will be rejected.`:''} />
      <Modal open={fundModal} onClose={() => setFundModal(false)} title="Fund Escrow" maxWidth={440}>
        <p style={{ color:'var(--text-secondary)', lineHeight:1.65, marginBottom:16 }}>Fund escrow for <strong style={{ color:'var(--text-primary)' }}>{task.title}</strong>.</p>
        <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-md)', padding:'14px 16px', marginBottom:20 }}>
          {[['Task Budget',`R${task.budget}`],['Platform Fee (10%)',`R${(parseFloat(task.budget)*0.1).toFixed(2)}`],['Total',`R${(parseFloat(task.budget)*1.1).toFixed(2)}`]].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
              <Mono>{k}</Mono><span style={{ fontFamily:'var(--font-mono)', color:k==='Total'?'var(--accent)':'var(--text-primary)', fontWeight:k==='Total'?600:400 }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:20, lineHeight:1.5 }}>In demo mode no actual charge occurs. In production this charges via Stripe.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={() => setFundModal(false)} disabled={fundLoading}>Cancel</Btn>
          <Btn variant="primary" onClick={confirmFund} loading={fundLoading}>Confirm & Fund Escrow</Btn>
        </div>
      </Modal>
      <ConfirmModal open={releaseModal} onClose={() => setReleaseModal(false)} onConfirm={confirmRelease} loading={releaseLoading} title="Release Payment" confirmLabel="Release Funds" confirmVariant="success" message={`Release R${task.budget} to the earner? This confirms the work is complete. This action cannot be undone.`} />
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
  const toast = useToast()
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

  function submit() {
    setLoading(true)
    setTimeout(() => {
      const id = `task_${Date.now()}`
      dispatch({ type:'ADD_TASK', task:{ task_id:id, creator_id:'u1', assigned_to:null, status:'open', title:title.trim(), description:desc.trim(), budget, deadline:new Date(deadline).toISOString(), skill_tags:tags.split(',').map(s=>s.trim()).filter(Boolean), created_at:new Date().toISOString() } })
      toast(`Task "${title}" posted successfully!`, 'success')
      setCreatedId(id); setLoading(false)
    }, 1000)
  }

  if (createdId) return (
    <div className="page-enter" style={{ maxWidth:580 }}>
      <DCard hover={false} style={{ textAlign:'center', padding:'48px 32px', border:'1px solid var(--success)' }}>
        <div style={{ fontSize:'3rem', marginBottom:12 }}>✓</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', fontWeight:700, marginBottom:8 }}>Task Posted!</h2>
        <p style={{ color:'var(--text-muted)', marginBottom:24, lineHeight:1.6 }}>Your task is live. Earners with matching skills have been notified.</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Btn onClick={() => { setSelectedTask(createdId); setPage('task-detail') }}>View Task</Btn>
          <Btn variant="secondary" onClick={() => setPage('tasks-mine')}>All My Tasks</Btn>
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

function MyTasks({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const [filter, setFilter] = useState('all')
  const myTasks = state.tasks.filter(t => t.creator_id==='u1')
  const filtered = myTasks.filter(t => filter==='all'||t.status===filter)
  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <PageTitle sub={`${myTasks.length} tasks posted`}>My Tasks</PageTitle>
        <Btn onClick={() => setPage('tasks-new')}>+ New Task</Btn>
      </div>
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
          const taskBids = state.bids.filter(b=>b.task_id===task.task_id&&b.status!=='withdrawn')
          const pendingBids = taskBids.filter(b=>b.status==='pending').length
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
  const toast = useToast()
  const myBids = state.bids.filter(b => b.bidder_id==='u3')
  const [filter, setFilter] = useState('all')
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
          const task = state.tasks.find(t=>t.task_id===bid.task_id)
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
                {bid.status==='pending'&&<Btn variant="danger" size="sm" onClick={() => { dispatch({type:'WITHDRAW_BID',bid_id:bid.bid_id}); toast('Bid withdrawn','info') }}>Withdraw</Btn>}
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

function Messages() {
  const { state, dispatch } = useStore()
  const [activeContact, setActiveContact] = useState('u3')
  const [msg, setMsg]   = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)
  const contact = CONTACTS.find(c => c.id===activeContact)
  const thread = state.messages.filter(m => (m.sender_id==='u1'&&m.receiver_id===activeContact)||(m.sender_id===activeContact&&m.receiver_id==='u1'))
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [thread, typing])
  const REPLIES = ['Got it, I\'ll get started right away.','Understood. I\'ll have an update by end of day.','Sure, let me check and get back to you.','Perfect, noted.','Thanks for the context — much clearer.','Can we jump on a quick call?']
  function send() {
    if (!msg.trim()) return
    dispatch({ type:'ADD_MESSAGE', message:{ message_id:`m${Date.now()}`, sender_id:'u1', receiver_id:activeContact, content:msg.trim(), created_at:new Date().toISOString(), sender_name:'You' } })
    setMsg(''); setTyping(true)
    setTimeout(() => { setTyping(false); dispatch({ type:'ADD_MESSAGE', message:{ message_id:`r${Date.now()}`, sender_id:activeContact, receiver_id:'u1', content:REPLIES[Math.floor(Math.random()*REPLIES.length)], created_at:new Date().toISOString(), sender_name:contact.name } }) }, 1400+Math.random()*600)
  }
  return (
    <div className="page-enter" style={{ maxWidth:900 }}>
      <PageTitle sub="Direct messages">Messages</PageTitle>
      <DCard hover={false} className="msg-shell" style={{ display:'flex', height:580, padding:0, overflow:'hidden' }}>
        <div style={{ width:220, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}><Mono size="0.65rem">Conversations</Mono></div>
          {CONTACTS.map(c => {
            const lastMsg = state.messages.filter(m=>(m.sender_id==='u1'&&m.receiver_id===c.id)||(m.sender_id===c.id&&m.receiver_id==='u1')).slice(-1)[0]
            const isActive = activeContact===c.id
            return (
              <div key={c.id} onClick={() => setActiveContact(c.id)}
                style={{ padding:'12px 14px', cursor:'pointer', background:isActive?'var(--accent-glow)':'transparent', borderLeft:isActive?'2px solid var(--accent)':'2px solid transparent', transition:'all 150ms ease' }}
                onMouseEnter={e => { if(!isActive) e.currentTarget.style.background='var(--bg-hover)' }}
                onMouseLeave={e => { if(!isActive) e.currentTarget.style.background='transparent' }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.78rem', color:'var(--accent)', flexShrink:0 }}>{c.avatar}</div>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    <div style={{ fontWeight:600, fontSize:'0.85rem', marginBottom:2 }}>{c.name}</div>
                    {lastMsg&&<div style={{ fontSize:'0.75rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lastMsg.content.slice(0,30)}…</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, background:'var(--bg-elevated)' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.78rem', color:'var(--accent)', flexShrink:0 }}>{contact.avatar}</div>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{contact.name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', display:'inline-block', animation:'pulse 2s infinite' }} />
                <Mono color="var(--success)" size="0.62rem">Online · {contact.task}</Mono>
              </div>
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>
            {thread.length===0&&<EmptyState icon="◎" message="Start the conversation" />}
            {thread.map(m => {
              const mine = m.sender_id==='u1'
              return (
                <div key={m.message_id} style={{ display:'flex', justifyContent:mine?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'72%', background:mine?'var(--accent-glow)':'var(--bg-elevated)', border:`1px solid ${mine?'var(--accent-dim)':'var(--border)'}`, borderRadius:'var(--radius-md)', ...(mine?{borderBottomRightRadius:4}:{borderBottomLeftRadius:4}), padding:'10px 14px' }}>
                    {!mine&&<Mono size="0.62rem" color="var(--accent)" style={{ display:'block', marginBottom:4 }}>{m.sender_name}</Mono>}
                    <p style={{ fontSize:'0.88rem', lineHeight:1.55 }}>{m.content}</p>
                    <Mono size="0.6rem" style={{ display:'block', textAlign:mine?'right':'left', marginTop:5 }}>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{mine ? '  ✓✓' : ''}</Mono>
                  </div>
                </div>
              )
            })}
            {typing&&<div style={{ display:'flex', justifyContent:'flex-start' }}><div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', gap:4, alignItems:'center' }}>{[0,1,2].map(i=><span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--text-muted)', display:'inline-block', animation:`pulse 1s infinite ${i*0.2}s` }} />)}</div></div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
            <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={`Message ${contact.name}… (Enter to send)`}
              style={{ flex:1, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', padding:'9px 13px', fontSize:'0.9rem', outline:'none' }} />
            <Btn onClick={send} disabled={!msg.trim()}>Send</Btn>
          </div>
        </div>
      </DCard>
    </div>
  )
}

function Notifications({ setPage, setSelectedTask }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const notifs = state.notifications
  const icons = { 'bid.submitted':'⚡','task.matched':'🎯','payment.released':'💰','escrow.funded':'🔒','dispute.resolved':'⚖️','bid.accepted':'🎉','task.created':'✓' }
  function markAll() { dispatch({type:'MARK_ALL_READ'}); toast('All notifications marked as read','info') }
  function handleClick(n) {
    dispatch({type:'MARK_NOTIFICATION_READ',id:n.notification_id})
    if (n.reference_id&&state.tasks.find(t=>t.task_id===n.reference_id)) { setSelectedTask(n.reference_id); setPage('task-detail') }
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

function Profile() {
  const { user } = useAuth()
  const { state } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('profile')
  const [displayName, setName]  = useState(user.displayName || user.email?.split('@')[0] || '')
  const [bio, setBio]           = useState('')
  const [skills, setSkills]     = useState('')
  const [portfolio, setPort]    = useState('')
  const [email, setEmail]       = useState(user.email || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [savingPw, setSavingPw]   = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const myReviews = state.reviews.filter(r=>r.reviewee_id==='u1'||r.reviewer_id==='u1')
  const avgRating = myReviews.length?(myReviews.reduce((s,r)=>s+r.rating,0)/myReviews.length).toFixed(1):null

  const token = () => localStorage.getItem('rl_token')

  // ── Load saved profile from backend on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/profile', { headers: { Authorization: `Bearer ${token()}` } })
        if (!res.ok) throw new Error('not ok')
        const { profile } = await res.json()
        if (cancelled || !profile) return
        setName(profile.display_name || user.displayName || '')
        setBio(profile.bio || '')
        setSkills(Array.isArray(profile.skills) ? profile.skills.join(', ') : (profile.skills || ''))
        setPort(profile.portfolio_url || '')
        setEmail(profile.email || user.email || '')
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
      const res = await fetch('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          displayName,
          bio,
          skills,                       // server splits the comma string into an array
          portfolioUrl: portfolio,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Save failed')
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
      const res = await fetch('/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not change password')
      setCurrentPw(''); setNewPw('')
      toast('Password changed', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth:680 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <PageTitle sub="Manage your account settings">Profile</PageTitle>
        {avgRating&&<div style={{ textAlign:'center' }}><div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', color:'var(--accent)' }}>{avgRating}</div><Stars rating={parseFloat(avgRating)} /><Mono>{myReviews.length} reviews</Mono></div>}
      </div>
      {/* Trust header — avatar, identity, key stats */}
      <DCard hover={false} style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--accent-dim)', flexShrink:0 }} />
          : <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.5rem', color:'var(--accent)', flexShrink:0 }}>{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</div>}
        <div style={{ minWidth:140 }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.25rem', lineHeight:1.2 }}>{user.displayName || user.email?.split('@')[0]}</div>
          <Mono>{user.email}</Mono>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:28 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', color:'#d97706' }}>{avgRating || '—'}</div>
            <Mono>rating</Mono>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem' }}>{state.tasks.filter(t=>t.status==='completed').length}</div>
            <Mono>completed</Mono>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', color:'var(--success)' }}>{user.provider==='google' ? '✓' : '—'}</div>
            <Mono>verified</Mono>
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
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Professional Profile</Mono>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Textarea label="Bio" value={bio} onChange={e=>setBio(e.target.value)} style={{ minHeight:80 }} />
              <Input label="Skills (comma separated)" value={skills} onChange={e=>setSkills(e.target.value)} hint="Used by the matching engine" />
              <Input label="Portfolio URL" value={portfolio} onChange={e=>setPort(e.target.value)} type="url" />
            </div>
          </DCard>
          <div style={{ display:'flex', gap:10 }}>
            <Btn loading={saving} onClick={saveProfile}>Save Changes</Btn>
            <Btn variant="secondary" onClick={() => { setName(user.displayName || user.email?.split('@')[0] || ''); setBio('') }}>Reset</Btn>
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
          <Divider style={{ margin:'24px 0' }} />
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:12 }}>Danger Zone</Mono>
          <Btn variant="danger" size="sm" onClick={() => toast('Account deletion is disabled in demo mode','warning')}>Delete Account</Btn>
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

function AdminDisputes({ setPage, setSelectedDispute }) {
  const { state } = useStore()
  const [filter, setFilter] = useState('open')
  const filtered = state.disputes.filter(d=>filter==='all'||d.status===filter)
  return (
    <div className="page-enter">
      <PageTitle sub="Review and resolve platform disputes">Dispute Queue</PageTitle>
      <div className="feed-scroll" style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg-elevated)', borderRadius:12, padding:3, overflowX:'auto', maxWidth:'fit-content' }}>
        {['all','open','under_review','resolved_creator','resolved_earner'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:'7px 14px', borderRadius:9, fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', transition:'all 150ms ease', border:'none', whiteSpace:'nowrap', background:filter===s?'var(--bg-surface)':'transparent', color:filter===s?'var(--accent)':'var(--text-muted)', boxShadow:filter===s?'0 1px 3px rgba(33,28,46,.14)':'none' }}>
            {s.replace('_',' ')} ({s==='all'?state.disputes.length:state.disputes.filter(d=>d.status===s).length})
          </button>
        ))}
      </div>
      {filtered.length===0?<EmptyState icon="⚖" message="No disputes in this category" />:(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(d => (
            <DCard key={d.dispute_id} onClick={() => { setSelectedDispute(d.dispute_id); setPage('admin-dispute-detail') }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                    <Badge variant={d.status==='open'?'disputed':d.status==='under_review'?'pending':'completed'}>{d.status.replace('_',' ')}</Badge>
                    <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1.05rem' }}>{d.task_title}</span>
                  </div>
                  <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', marginBottom:10, lineHeight:1.5 }}>{d.reason.slice(0,160)}{d.reason.length>160?'…':''}</p>
                  <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                    <Mono>Creator: {d.creator_email}</Mono><Mono>Earner: {d.earner_email}</Mono><Mono>Opened: {new Date(d.opened_at).toLocaleDateString()}</Mono>
                  </div>
                </div>
                <div style={{ textAlign:'right', marginLeft:20, flexShrink:0 }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.2rem', color:'var(--accent)', fontWeight:500 }}>R{(d.amount_cents/100).toFixed(0)}</div>
                  <Mono>in escrow</Mono>
                </div>
              </div>
            </DCard>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminDisputeDetail({ disputeId, setPage }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const dispute = state.disputes.find(d=>d.dispute_id===disputeId)
  const task    = dispute?state.tasks.find(t=>t.task_id===dispute.task_id):null
  const [note, setNote]         = useState('')
  const [noteErr, setNoteErr]   = useState('')
  const [resolveModal, setResolveModal] = useState(null)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [timeline, setTimeline] = useState([
    { action:'opened',   actor:'Creator', note:'Dispute raised by creator', time:dispute?.opened_at||new Date().toISOString() },
    { action:'assigned', actor:'Admin',   note:'Assigned for admin review',  time:new Date(Date.now()-3600000).toISOString() },
  ])
  if (!dispute) return <EmptyState message="Dispute not found" action={<Btn onClick={() => setPage('admin-disputes')}>← Back</Btn>} />
  const isResolved = dispute.status.startsWith('resolved')

  function saveNote() {
    if (!note.trim()||note.trim().length<5) { setNoteErr('Note must be at least 5 characters'); return }
    setNoteErr('')
    setTimeline(t=>[...t,{action:'note_added',actor:'Admin',note:note.trim(),time:new Date().toISOString()}])
    dispatch({type:'UPDATE_DISPUTE',dispute_id:disputeId,changes:{admin_notes:note.trim()}})
    setNote(''); toast('Note saved','success')
  }

  function resolve() {
    setResolveLoading(true)
    setTimeout(() => {
      const status = resolveModal==='refund'?'resolved_creator':'resolved_earner'
      dispatch({type:'UPDATE_DISPUTE',dispute_id:disputeId,changes:{status,resolved_at:new Date().toISOString(),resolution:resolveModal}})
      if (task) dispatch({type:'UPDATE_TASK',task_id:task.task_id,changes:{status:'completed'}})
      dispatch({type:'SET_ESCROW',task_id:dispute.task_id,status:resolveModal==='refund'?'refunded':'released'})
      setTimeline(t=>[...t,{action:'resolved',actor:'Admin',note:resolveModal==='refund'?'Resolved: Refund to creator':'Resolved: Release to earner',time:new Date().toISOString()}])
      toast(`Dispute resolved — ${resolveModal==='refund'?'Creator refunded':'Earner paid'}`, 'success')
      setResolveLoading(false); setResolveModal(null)
    }, 1200)
  }

  return (
    <div className="page-enter" style={{ maxWidth:960 }}>
      <button onClick={() => setPage('admin-disputes')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.78rem', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer', marginBottom:20 }}>← Back to Queue</button>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}><Badge variant={isResolved?'completed':'disputed'}>{dispute.status.replace('_',' ')}</Badge><Mono>Dispute #{dispute.dispute_id}</Mono></div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:700 }}>{dispute.task_title}</h1>
        </div>
        <div style={{ textAlign:'right' }}><div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', color:'var(--accent)', fontWeight:500 }}>R{(dispute.amount_cents/100).toFixed(0)}</div><Mono>{isResolved?'resolved':'held in escrow'}</Mono></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <DCard hover={false}><Mono size="0.68rem" color="var(--danger)" style={{ display:'block', marginBottom:10 }}>Dispute Reason</Mono><p style={{ color:'var(--text-secondary)', lineHeight:1.75 }}>{dispute.reason}</p></DCard>
          <DCard hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Message Log (Task Context)</Mono>
            <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:260, overflowY:'auto' }}>
              {state.messages.slice(0,6).map(m => (
                <div key={m.message_id} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', padding:'10px 12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <Mono color="var(--accent)" size="0.62rem">{m.sender_name}</Mono>
                    <Mono size="0.6rem">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Mono>
                  </div>
                  <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{m.content}</p>
                </div>
              ))}
            </div>
          </DCard>
          {!isResolved&&(
            <>
              <DCard hover={false}>
                <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:12 }}>Internal Notes</Mono>
                <Textarea placeholder="Add investigation notes visible only to admins…" value={note} onChange={e=>{setNote(e.target.value);setNoteErr('')}} error={noteErr} />
                <Btn variant="secondary" size="sm" style={{ marginTop:10 }} onClick={saveNote}>Save Note</Btn>
              </DCard>
              <DCard hover={false} style={{ border:'1px solid var(--border-strong)' }}>
                <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:16 }}>Resolution</Mono>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ background:'rgba(239,68,68,.05)', border:'1px solid rgba(239,68,68,.2)', borderRadius:'var(--radius-md)', padding:16 }}>
                    <Mono color="var(--danger)" size="0.68rem" style={{ display:'block', marginBottom:8 }}>Refund Creator</Mono>
                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:12, lineHeight:1.5 }}>Cancel the PaymentIntent. Held funds return to creator's card.</p>
                    <Btn variant="danger" fullWidth onClick={() => setResolveModal('refund')}>Refund Creator</Btn>
                  </div>
                  <div style={{ background:'rgba(16,185,129,.05)', border:'1px solid rgba(16,185,129,.2)', borderRadius:'var(--radius-md)', padding:16 }}>
                    <Mono color="var(--success)" size="0.68rem" style={{ display:'block', marginBottom:8 }}>Release to Earner</Mono>
                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:12, lineHeight:1.5 }}>Capture the PaymentIntent. Funds transfer to earner's Stripe account.</p>
                    <Btn variant="success" fullWidth onClick={() => setResolveModal('release')}>Release to Earner</Btn>
                  </div>
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
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:14 }}>Parties</Mono>
            {[{label:'Creator',email:dispute.creator_email,role:'creator'},{label:'Earner',email:dispute.earner_email,role:'earner'}].map(p => (
              <div key={p.role} style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', padding:12, marginBottom:8 }}>
                <Badge variant={p.role}>{p.label}</Badge>
                <div style={{ marginTop:6, fontSize:'0.82rem', color:'var(--text-secondary)' }}>{p.email}</div>
              </div>
            ))}
          </DCard>
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
          {task&&(
            <DCard hover={false}>
              <Mono size="0.68rem" color="var(--text-secondary)" style={{ display:'block', marginBottom:10 }}>Task Info</Mono>
              {[['Budget',`R${task.budget}`],['Status',task.status.replace('_',' ')],['Deadline',new Date(task.deadline).toLocaleDateString()]].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                  <Mono>{k}</Mono><span style={{ fontSize:'0.84rem', color:'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </DCard>
          )}
        </div>
      </div>
      <ConfirmModal open={!!resolveModal} onClose={() => setResolveModal(null)} onConfirm={resolve} loading={resolveLoading}
        title={resolveModal==='refund'?'Refund Creator':'Release to Earner'}
        confirmLabel={resolveModal==='refund'?'Confirm Refund':'Confirm Release'}
        confirmVariant={resolveModal==='refund'?'danger':'success'}
        message={resolveModal==='refund'?`This will cancel the PaymentIntent and return R${(dispute.amount_cents/100).toFixed(0)} to the creator. This cannot be undone.`:`This will transfer R${(dispute.amount_cents/100).toFixed(0)} to the earner's Stripe account. This cannot be undone.`} />
    </div>
  )
}

const MOCK_USERS_ADMIN = [
  { user_id:'u1', email:'creator@demo.com',  role:'creator', displayName:'Demo Creator', created_at:'2025-01-15T00:00:00Z', status:'active',    tasks:4, spent:1250 },
  { user_id:'u3', email:'earner@demo.com',   role:'earner',  displayName:'Alex Chen',    created_at:'2025-01-20T00:00:00Z', status:'active',    tasks:3, earned:920 },
  { user_id:'u2', email:'creator2@demo.com', role:'creator', displayName:'James Lee',    created_at:'2025-02-01T00:00:00Z', status:'active',    tasks:2, spent:1600 },
  { user_id:'u5', email:'maria@demo.com',    role:'earner',  displayName:'Maria Santos', created_at:'2025-02-10T00:00:00Z', status:'active',    tasks:5, earned:1800 },
  { user_id:'u6', email:'james@demo.com',    role:'earner',  displayName:'James Kim',    created_at:'2025-03-01T00:00:00Z', status:'suspended', tasks:1, earned:0 },
]

function AdminUsers() {
  const toast = useToast()
  const [users, setUsers] = useState(MOCK_USERS_ADMIN)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [banModal, setBanModal]   = useState(null)
  const filtered = users.filter(u => (roleFilter==='all'||u.role===roleFilter) && (!search||u.email.toLowerCase().includes(search.toLowerCase())||u.displayName.toLowerCase().includes(search.toLowerCase())))
  function toggleBan(u) { setUsers(us=>us.map(x=>x.user_id===u.user_id?{...x,status:x.status==='suspended'?'active':'suspended'}:x)); toast(`${u.displayName} ${u.status==='suspended'?'reinstated':'suspended'}`,'warning'); setBanModal(null) }
  return (
    <div className="page-enter">
      <PageTitle sub={`${users.length} registered users`}>User Management</PageTitle>
      <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'flex-end' }}>
        <Input placeholder="Search by name or email…" value={search} onChange={e=>setSearch(e.target.value)} style={{ width:260 }} />
        <SelectField value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{ minWidth:140 }}>
          <option value="all">All Roles</option><option value="creator">Creators</option><option value="earner">Earners</option>
        </SelectField>
      </div>
      <DCard hover={false} style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
              {['User','Role','Status','Joined','Activity','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u,i) => (
              <tr key={u.user_id} style={{ borderBottom:i<filtered.length-1?'1px solid var(--border)':'none', opacity:u.status==='suspended'?0.6:1 }}>
                <td style={{ padding:'12px 16px' }}><div style={{ fontWeight:600, fontSize:'0.88rem' }}>{u.displayName}</div><div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{u.email}</div></td>
                <td style={{ padding:'12px 16px' }}><Badge variant={u.role}>{u.role}</Badge></td>
                <td style={{ padding:'12px 16px' }}><Badge variant={u.status==='active'?'open':'disputed'}>{u.status}</Badge></td>
                <td style={{ padding:'12px 16px' }}><Mono>{new Date(u.created_at).toLocaleDateString()}</Mono></td>
                <td style={{ padding:'12px 16px' }}><Mono>{u.tasks} tasks · </Mono><Mono color="var(--accent)">{u.spent?`R${u.spent} spent`:`R${u.earned} earned`}</Mono></td>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:8 }}>
                    <Btn variant="ghost" size="sm" onClick={() => toast(`Viewing ${u.displayName}'s profile`,'info')}>View</Btn>
                    <Btn variant={u.status==='suspended'?'success':'danger'} size="sm" onClick={() => setBanModal(u)}>{u.status==='suspended'?'Reinstate':'Suspend'}</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<EmptyState icon="◈" message="No users match your search" />}
      </DCard>
      <ConfirmModal open={!!banModal} onClose={() => setBanModal(null)} onConfirm={() => toggleBan(banModal)}
        title={banModal?.status==='suspended'?'Reinstate User':'Suspend User'}
        confirmLabel={banModal?.status==='suspended'?'Reinstate':'Suspend'}
        confirmVariant={banModal?.status==='suspended'?'success':'danger'}
        message={banModal?(banModal.status==='suspended'?`Reinstate ${banModal.displayName}'s account? They will regain access immediately.`:`Suspend ${banModal.displayName}'s account? They will lose access until reinstated.`):''} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — UNIFIED ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [user, setUser]         = useState(null)
  const [userLoading, setUserLoading] = useState(true) // true while restoring session
  const [view, setView] = useState(() => {
    if (window.location.pathname === '/oauth-callback') return 'oauth-callback'
    return 'landing'
  })
  const [authModal, setAuthModal] = useState(null)
  const [dashPage, setDashPage]   = useState('tasks-browse')
  const [selectedTask,    setSelectedTask]    = useState(null)
  const [selectedDispute, setSelectedDispute] = useState(null)
  const [state, dispatch] = useReducer(appReducer, initialState)

  const unreadCount = state.notifications.filter(n => !n.is_read).length

  // ── Session restore on every page load ──────────────────────────────────────
  // Reads the JWT from localStorage, validates it, and fetches the user's
  // current profile from the backend. If the token is expired or invalid,
  // it clears everything and shows the landing page.
  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem('rl_token')
      if (!token) { setUserLoading(false); return }

      try {
        // Decode token to get userId without a network call
        const payload = JSON.parse(atob(token.split('.')[1]))

        // Check token isn't expired
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('rl_token')
          setUserLoading(false)
          return
        }

        // Fetch fresh user profile from backend
        const res = await fetch('/auth/me', {
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
          })
          // Only restore dashboard view if we were on dashboard before
          const savedView = sessionStorage.getItem('rl_view')
          if (savedView && savedView !== 'landing' && savedView !== 'oauth-callback') {
            setView('dashboard')
          }
        } else {
          // Token rejected by server — clear it
          localStorage.removeItem('rl_token')
        }
      } catch {
        // Token malformed or network error — clear silently
        localStorage.removeItem('rl_token')
      } finally {
        setUserLoading(false)
      }
    }
    restoreSession()
  }, [])

  // Persist current view so refresh restores dashboard
  useEffect(() => {
    if (view !== 'oauth-callback') {
      sessionStorage.setItem('rl_view', view)
    }
  }, [view])

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
    setDashPage('tasks-browse')
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

      if (!token || !userId) return false

      localStorage.setItem('rl_token', token)
      saveUser({ userId, email, role, displayName, avatarUrl, provider: 'google' })
      setView('dashboard')
      setDashPage('tasks-browse')
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
      fetch('/auth/logout', {
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
    setAuthModal(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const authValue = {
    user,
    userLoading,
    handleOAuthCallback,
    handleLogin,
    loginWithGoogle: () => { window.location.href = '/auth/google' },
    logout,
  }
  const storeValue = { state, dispatch }

  // Info/legal/product pages — all routed through setView
  const INFO_PAGES = ['how-it-works-page','features-page','pricing-page','trust-safety','terms','privacy','cookies','popia','help-centre','contact','report','guidelines','about-page','blog','careers']

  function navigate(target) {
    if (target==='home')      { setView('landing'); window.scrollTo({top:0,behavior:'smooth'}); return }
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
      case 'about-page':        return <ComingSoonPage title="About ReLiv" subtitle="Company" onNav={navigate} />
      case 'blog':              return <ComingSoonPage title="Blog"             subtitle="Company" onNav={navigate} />
      case 'careers':           return <ComingSoonPage title="Careers"          subtitle="Company" onNav={navigate} />
      default:                  return null
    }
  }

  function renderDashPage() {
    switch (dashPage) {
      case 'dashboard':            return <Dashboard setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'tasks-browse':         return <TaskBrowse setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'task-detail':          return <TaskDetail taskId={selectedTask} setPage={setDashPage} />
      case 'tasks-new':            return <TaskNew setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'tasks-mine':           return <MyTasks setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'my-bids':              return <MyBids setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'suggestions':          return <Suggestions setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'messages':             return <Messages />
      case 'notifications':        return <Notifications setPage={setDashPage} setSelectedTask={setSelectedTask} />
      case 'profile':              return <Profile />
      case 'admin-disputes':       return <AdminDisputes setPage={setDashPage} setSelectedDispute={setSelectedDispute} />
      case 'admin-dispute-detail': return <AdminDisputeDetail disputeId={selectedDispute} setPage={setDashPage} />
      case 'admin-users':          return <AdminUsers />
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
              <LandingNavbar onOpenAuth={setAuthModal} onNav={navigate} />
              <Hero         onOpenAuth={setAuthModal} />
              <StatsBar />
              <CampusStrip />
              <HowItWorks />
              <Features />
              <LiveTasks    onOpenAuth={setAuthModal} />
              <Pricing      onOpenAuth={setAuthModal} />
              <Testimonials />
              <LandingAbout />
              <LandingCTA   onOpenAuth={setAuthModal} />
              <LandingFooter onNav={navigate} />
            </div>
          )}

          {/* ── INFO / LEGAL / PRODUCT PAGES ─────────────────── */}
          {INFO_PAGES.includes(view) && (
            <div>
              <LandingNavbar onOpenAuth={setAuthModal} onNav={navigate} />
              {renderInfoPage()}
              <LandingFooter onNav={navigate} />
            </div>
          )}

          {/* ── DASHBOARD ────────────────────────────────────── */}
          {view==='dashboard' && user && (
            <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-base)' }}>
              <TopBar page={dashPage} setPage={setDashPage} unreadCount={unreadCount} onGoHome={() => navigate('landing')} />
              {/* DashSidebar is mobile-only now — CSS turns it into the bottom tab bar */}
              <DashSidebar page={dashPage} setPage={setDashPage} unreadCount={unreadCount} onGoHome={() => navigate('landing')} />
              <main className="dash-main" style={{ flex:1, width:'100%', maxWidth:1280, margin:'0 auto', padding:'28px 24px 60px' }}>
                {renderDashPage()}
              </main>
            </div>
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

        </ToastProvider>
      </StoreCtx.Provider>
    </AuthCtx.Provider>
  )
}
