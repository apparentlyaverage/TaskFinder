// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback,
  createContext, useContext, useReducer,
} from 'react'
import {
  MOCK_TASKS, MOCK_BIDS, MOCK_NOTIFICATIONS,
  MOCK_MESSAGES, MOCK_DISPUTES, MOCK_SUGGESTIONS,
} from './api/mock'

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null)
function useAuth() { return useContext(AuthCtx) }

// ─── TOAST CONTEXT ────────────────────────────────────────────────────────────
const ToastCtx = createContext(null)
function useToast() { return useContext(ToastCtx) }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const add = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])
  const remove = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <ToastStack toasts={toasts} onRemove={remove} />
    </ToastCtx.Provider>
  )
}

function ToastStack({ toasts, onRemove }) {
  if (!toasts.length) return null
  const colors = {
    success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', icon: '✓', color: 'var(--success)' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  icon: '✗', color: 'var(--danger)' },
    info:    { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)', icon: 'ℹ', color: 'var(--info)' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', icon: '⚠', color: 'var(--accent)' },
  }
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9999, pointerEvents: 'none' }}>
      {toasts.map(t => {
        const c = colors[t.type] || colors.info
        return (
          <div key={t.id} onClick={() => onRemove(t.id)}
            style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: 360, pointerEvents: 'all', cursor: 'pointer', animation: 'slideUp 0.25s ease both', backdropFilter: 'blur(8px)' }}>
            <span style={{ color: c.color, fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── APP STATE (global reducer for tasks/bids/notifications) ─────────────────
const initialState = {
  tasks:   MOCK_TASKS.map(t => ({ ...t })),
  bids:    MOCK_BIDS.map(b => ({ ...b })),
  notifications: MOCK_NOTIFICATIONS.map(n => ({ ...n })),
  messages: MOCK_MESSAGES.map(m => ({ ...m })),
  disputes: MOCK_DISPUTES.map(d => ({ ...d })),
  reviews:  [],
  escrows:  { '1': { status: 'pending' } }, // taskId → escrow state
}

function appReducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [action.task, ...state.tasks] }
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.task_id === action.task_id ? { ...t, ...action.changes } : t) }
    case 'ADD_BID':
      return { ...state, bids: [...state.bids, action.bid] }
    case 'UPDATE_BID':
      return { ...state, bids: state.bids.map(b => b.bid_id === action.bid_id ? { ...b, ...action.changes } : b) }
    case 'REJECT_OTHER_BIDS':
      return { ...state, bids: state.bids.map(b => b.task_id === action.task_id && b.bid_id !== action.accepted_bid_id ? { ...b, status: 'rejected' } : b) }
    case 'WITHDRAW_BID':
      return { ...state, bids: state.bids.map(b => b.bid_id === action.bid_id ? { ...b, status: 'withdrawn' } : b) }
    case 'SET_ESCROW':
      return { ...state, escrows: { ...state.escrows, [action.task_id]: { status: action.status } } }
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.notification, ...state.notifications] }
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.notification_id === action.id ? { ...n, is_read: true } : n) }
    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, is_read: true })) }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'ADD_DISPUTE':
      return { ...state, disputes: [...state.disputes, action.dispute] }
    case 'UPDATE_DISPUTE':
      return { ...state, disputes: state.disputes.map(d => d.dispute_id === action.dispute_id ? { ...d, ...action.changes } : d) }
    case 'ADD_REVIEW':
      return { ...state, reviews: [...state.reviews, action.review] }
    default:
      return state
  }
}

const StoreCtx = createContext(null)
function useStore() { return useContext(StoreCtx) }

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Btn({ children, variant = 'primary', size = 'md', loading = false, fullWidth = false, style = {}, ...p }) {
  const [hov, setHov] = useState(false)
  const sizes = { sm: { padding: '5px 12px', fontSize: '0.72rem' }, md: { padding: '9px 20px', fontSize: '0.82rem' }, lg: { padding: '13px 28px', fontSize: '0.94rem' } }
  const variants = {
    primary:   { background: hov ? '#fbbf24' : 'var(--accent)', color: '#000', transform: hov ? 'translateY(-1px)' : 'none', boxShadow: hov ? '0 4px 20px var(--accent-glow)' : 'none' },
    secondary: { background: hov ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
    ghost:     { background: hov ? 'var(--bg-hover)' : 'transparent', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)' },
    danger:    { background: hov ? 'rgba(239,68,68,0.12)' : 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' },
    success:   { background: hov ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' },
    warning:   { background: hov ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' },
  }
  const v = variants[variant] || variants.primary
  return (
    <button
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 150ms ease', whiteSpace: 'nowrap', border: 'none', ...(fullWidth ? { width: '100%' } : {}), ...((loading || p.disabled) ? { opacity: 0.45, cursor: 'not-allowed', transform: 'none' } : {}), ...sizes[size], ...v, ...style }}
      disabled={loading || p.disabled} {...p}>
      {loading ? <span style={{ width: 12, height: 12, border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'inline-block' }} /> : children}
    </button>
  )
}

function Input({ label, error, hint, style = {}, ...p }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</label>}
      <input style={{ background: 'var(--bg-surface)', border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '9px 13px', outline: 'none', width: '100%', fontSize: '0.9rem', boxShadow: focused ? '0 0 0 3px var(--accent-glow)' : 'none', transition: 'all 150ms ease', ...style }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...p} />
      {error && <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  )
}

function Textarea({ label, error, style = {}, ...p }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</label>}
      <textarea style={{ background: 'var(--bg-surface)', border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '9px 13px', outline: 'none', width: '100%', resize: 'vertical', minHeight: 100, fontSize: '0.9rem', fontFamily: 'var(--font-body)', boxShadow: focused ? '0 0 0 3px var(--accent-glow)' : 'none', transition: 'all 150ms ease', ...style }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...p} />
      {error && <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

function SelectField({ label, value, onChange, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '9px 13px', fontSize: '0.88rem', outline: 'none', cursor: 'pointer', ...style }}>{children}</select>
    </div>
  )
}

function Badge({ children, variant = 'default' }) {
  const map = {
    default: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' },
    open: { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    in_progress: { background: 'rgba(59,130,246,0.15)', color: 'var(--info)' },
    disputed: { background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
    completed: { background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' },
    expired: { background: 'var(--bg-elevated)', color: 'var(--text-muted)' },
    admin: { background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
    earner: { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    creator: { background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' },
    pending: { background: 'rgba(59,130,246,0.12)', color: 'var(--info)' },
    accepted: { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    rejected: { background: 'var(--bg-elevated)', color: 'var(--text-muted)' },
    withdrawn: { background: 'var(--bg-elevated)', color: 'var(--text-muted)' },
    funded: { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    released: { background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' },
    refunded: { background: 'rgba(59,130,246,0.15)', color: 'var(--info)' },
  }
  const v = map[variant] || map.default
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '0.63rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', ...v }}>{children}</span>
}

function Card({ children, style = {}, onClick, hover = true }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => hover && setHov(true)} onMouseLeave={() => hover && setHov(false)}
      style={{ background: 'var(--bg-surface)', border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: 20, transition: 'all 150ms ease', ...(hover && hov ? { transform: 'translateY(-2px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' } : {}), ...(onClick ? { cursor: 'pointer' } : {}), ...style }}>
      {children}
    </div>
  )
}

function Tag({ children }) {
  return <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>{children}</span>
}

function Mono({ children, color = 'var(--text-muted)', size = '0.72rem', style = {} }) {
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: size, color, letterSpacing: '0.06em', textTransform: 'uppercase', ...style }}>{children}</span>
}

function Stars({ rating, interactive = false, onRate }) {
  const [hover, setHover] = useState(0)
  const r = Number(rating) || 0
  const display = hover || r
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--accent)', cursor: interactive ? 'pointer' : 'default', letterSpacing: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} onMouseEnter={() => interactive && setHover(i)} onMouseLeave={() => interactive && setHover(0)} onClick={() => interactive && onRate && onRate(i)}
          style={{ color: i <= display ? 'var(--accent)' : 'var(--border-strong)', transition: 'color 100ms ease' }}>
          ★
        </span>
      ))}
      {!interactive && <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.75rem' }}>{r.toFixed(1)}</span>}
    </span>
  )
}

function Divider({ style = {} }) {
  return <div style={{ height: 1, background: 'var(--border)', width: '100%', ...style }} />
}

function PageTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{children}</h1>
      {sub && <Mono style={{ marginTop: 6, display: 'block' }}>{sub}</Mono>}
    </div>
  )
}

function EmptyState({ icon = '◻', message, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.25 }}>{icon}</div>
      <Mono style={{ display: 'block', marginBottom: action ? 16 : 0 }}>{message}</Mono>
      {action && action}
    </div>
  )
}

function StatCard({ label, value, accent = false, sub }) {
  return (
    <Card hover={false} style={{ flex: 1, minWidth: 120 }}>
      <Mono style={{ display: 'block', marginBottom: 8 }}>{label}</Mono>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <Mono style={{ display: 'block', marginTop: 4, fontSize: '0.65rem' }}>{sub}</Mono>}
    </Card>
  )
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth, animation: 'slideUp 0.2s ease both', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmVariant = 'primary', loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={400}>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 24 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
        <Btn variant={confirmVariant} onClick={onConfirm} loading={loading}>{confirmLabel}</Btn>
      </div>
    </Modal>
  )
}

// ─── LOADING SPINNER ─────────────────────────────────────────────────────────
function Spinner({ size = 24 }) {
  return <span style={{ width: size, height: size, border: `2px solid var(--border)`, borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
}

// ─── PROGRESS STEP ───────────────────────────────────────────────────────────
function StepBar({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done   = i < current
        const active = i === current
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-elevated)', color: done || active ? '#000' : 'var(--text-muted)', border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`, transition: 'all 300ms ease' }}>
                {done ? '✓' : i + 1}
              </div>
              <Mono size="0.62rem" color={active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--text-muted)'}>{s}</Mono>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < current ? 'var(--success)' : 'var(--border)', margin: '0 8px', marginBottom: 20, transition: 'background 300ms ease' }} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN / REGISTER SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function AuthScreen({ onLogin }) {
  const [mode, setMode]   = useState('login')
  const [role, setRole]   = useState('creator')
  const [email, setEmail] = useState('creator@demo.com')
  const [pass, setPass]   = useState('demo1234')
  const [name, setName]   = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const presets = [
    { label: 'Creator', role: 'creator', email: 'creator@demo.com' },
    { label: 'Earner',  role: 'earner',  email: 'earner@demo.com' },
    { label: 'Admin',   role: 'admin',   email: 'admin@demo.com' },
  ]

  function validate() {
    const e = {}
    if (!email.includes('@')) e.email = 'Enter a valid email address'
    if (pass.length < 8) e.pass = 'Password must be at least 8 characters'
    if (mode === 'register' && !name.trim()) e.name = 'Display name is required'
    return e
  }

  function submit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setLoading(true)
    setTimeout(() => {
      onLogin({ userId: 'u1', email, role, displayName: name || email.split('@')[0] })
      setLoading(false)
    }, 700)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundImage: 'linear-gradient(#1c1c1c 1px,transparent 1px),linear-gradient(90deg,#1c1c1c 1px,transparent 1px)', backgroundSize: '40px 40px', backgroundColor: 'var(--bg-base)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '44px 40px', width: '100%', maxWidth: 420, animation: 'slideUp 0.35s ease both' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', width: 46, height: 46, borderRadius: 'var(--radius-md)', marginBottom: 16 }}>TF</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{mode === 'login' ? 'Sign In' : 'Create Account'}</h1>
          <Mono style={{ display: 'block', marginTop: 4 }}>Task Finder — Peer Marketplace</Mono>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && <Input label="Display Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" error={errors.name} />}
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" error={errors.email} required />
          <Input label="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" hint={mode === 'register' ? 'Minimum 8 characters' : undefined} error={errors.pass} required />
          {mode === 'register' && (
            <SelectField label="I want to…" value={role} onChange={e => setRole(e.target.value)}>
              <option value="creator">Post tasks and hire — Creator</option>
              <option value="earner">Bid on tasks and earn — Earner</option>
            </SelectField>
          )}

          {mode === 'login' && (
            <div>
              <Mono style={{ display: 'block', marginBottom: 8 }}>Quick demo login</Mono>
              <div style={{ display: 'flex', gap: 6 }}>
                {presets.map(p => (
                  <button key={p.role} type="button" onClick={() => { setRole(p.role); setEmail(p.email); setErrors({}) }}
                    style={{ flex: 1, padding: '6px 8px', background: role === p.role ? 'var(--accent-glow)' : 'var(--bg-elevated)', border: `1px solid ${role === p.role ? 'var(--accent)' : 'var(--border)'}`, color: role === p.role ? 'var(--accent)' : 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 150ms ease' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Btn type="submit" fullWidth loading={loading} size="lg" style={{ marginTop: 6 }}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Btn>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? 'No account? ' : 'Have an account? '}
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErrors({}) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 'inherit', cursor: 'pointer' }}>
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

const NAV = {
  creator: [
    { id: 'dashboard',     label: 'Dashboard', icon: '⊞' },
    { id: 'tasks-new',     label: 'Post Task',  icon: '+' },
    { id: 'tasks-mine',    label: 'My Tasks',   icon: '▤' },
    { id: 'messages',      label: 'Messages',   icon: '◎' },
    { id: 'notifications', label: 'Alerts',     icon: '◉' },
    { id: 'profile',       label: 'Profile',    icon: '◷' },
  ],
  earner: [
    { id: 'dashboard',     label: 'Dashboard',  icon: '⊞' },
    { id: 'tasks-browse',  label: 'Browse',     icon: '◈' },
    { id: 'suggestions',   label: 'For You',    icon: '◎' },
    { id: 'my-bids',       label: 'My Bids',    icon: '▤' },
    { id: 'messages',      label: 'Messages',   icon: '◉' },
    { id: 'notifications', label: 'Alerts',     icon: '◐' },
    { id: 'profile',       label: 'Profile',    icon: '◷' },
  ],
  admin: [
    { id: 'dashboard',        label: 'Dashboard', icon: '⊞' },
    { id: 'admin-disputes',   label: 'Disputes',  icon: '⚖' },
    { id: 'admin-users',      label: 'Users',     icon: '◈' },
    { id: 'tasks-browse',     label: 'All Tasks', icon: '▤' },
    { id: 'notifications',    label: 'Alerts',    icon: '◐' },
  ],
}

function NavItem({ active, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease', border: 'none', color: active ? 'var(--accent)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)', background: active ? 'var(--accent-glow)' : hov ? 'var(--bg-hover)' : 'transparent', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent' }}>
      {children}
    </button>
  )
}

function Sidebar({ page, setPage, unreadCount }) {
  const { user, logout } = useAuth()
  const [signHov, setSignHov] = useState(false)
  const items = NAV[user.role] || []

  return (
    <aside style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', width: 220, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', letterSpacing: '0.06em' }}>TF</div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>TaskFinder</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
        Demo Mode
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map(item => (
          <NavItem key={item.id} active={page === item.id} onClick={() => setPage(item.id)}>
            <span>{item.label}</span>
            {item.id === 'notifications' && unreadCount > 0 && (
              <span style={{ background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{unreadCount}</span>
            )}
          </NavItem>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
        <Badge variant={user.role}>{user.role}</Badge>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '6px 0 4px' }}>{user.displayName || user.email}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 10 }}>{user.email}</div>
        <button onClick={logout} onMouseEnter={() => setSignHov(true)} onMouseLeave={() => setSignHov(false)}
          style={{ background: 'transparent', padding: '6px 12px', width: '100%', border: `1px solid ${signHov ? 'var(--danger)' : 'var(--border)'}`, color: signHov ? 'var(--danger)' : 'var(--text-muted)', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 150ms ease' }}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ setPage, setSelectedTask }) {
  const { user } = useAuth()
  const { state } = useStore()
  const myTasks   = state.tasks.filter(t => t.creator_id === 'u1')
  const openCount = state.tasks.filter(t => t.status === 'open').length
  const doneCount = state.tasks.filter(t => t.status === 'completed').length
  const myBids    = state.bids.filter(b => b.bidder_id === 'u3')
  const activeBids= myBids.filter(b => b.status === 'pending' || b.status === 'accepted')

  return (
    <div className="page-enter">
      <PageTitle sub={`Welcome back — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}>Dashboard</PageTitle>

      <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
        {user.role === 'creator' && <>
          <StatCard label="Tasks Posted"  value={myTasks.length} />
          <StatCard label="Open Bids"     value={state.bids.filter(b => state.tasks.find(t => t.creator_id === 'u1' && t.task_id === b.task_id) && b.status === 'pending').length} accent />
          <StatCard label="Completed"     value={doneCount} />
          <StatCard label="Total Spent"   value={`$${myTasks.filter(t=>t.status==='completed').reduce((s,t)=>s+parseFloat(t.budget||0),0).toLocaleString()}`} />
        </>}
        {user.role === 'earner' && <>
          <StatCard label="Open Tasks"    value={openCount} />
          <StatCard label="Active Bids"   value={activeBids.length} accent />
          <StatCard label="Jobs Done"     value={myBids.filter(b => b.status === 'accepted').length} />
          <StatCard label="Suggestions"   value={MOCK_SUGGESTIONS.length} />
        </>}
        {user.role === 'admin' && <>
          <StatCard label="Open Disputes" value={state.disputes.filter(d => d.status === 'open').length} accent />
          <StatCard label="Total Tasks"   value={state.tasks.length} />
          <StatCard label="Active Users"  value="24" />
          <StatCard label="Platform Fees" value="$340" />
        </>}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        {user.role === 'creator' && <>
          <Btn onClick={() => setPage('tasks-new')}>+ Post New Task</Btn>
          <Btn variant="secondary" onClick={() => setPage('tasks-mine')}>View My Tasks</Btn>
          <Btn variant="secondary" onClick={() => setPage('messages')}>Messages</Btn>
        </>}
        {user.role === 'earner' && <>
          <Btn onClick={() => setPage('tasks-browse')}>Browse Open Tasks</Btn>
          <Btn variant="secondary" onClick={() => setPage('suggestions')}>View Suggestions</Btn>
          <Btn variant="secondary" onClick={() => setPage('my-bids')}>My Bids</Btn>
        </>}
        {user.role === 'admin' && <>
          <Btn onClick={() => setPage('admin-disputes')}>Review Disputes</Btn>
          <Btn variant="secondary" onClick={() => setPage('admin-users')}>Manage Users</Btn>
        </>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Mono size="0.75rem" color="var(--text-secondary)">Recent Activity</Mono>
        <Btn variant="ghost" size="sm" onClick={() => setPage('tasks-browse')}>View All →</Btn>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.tasks.slice(0, 5).map(task => (
          <Card key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem' }}>{task.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{task.skill_tags.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--accent)', fontWeight: 500 }}>${task.budget}</div>
              <Mono>{new Date(task.deadline).toLocaleDateString()}</Mono>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: BROWSE TASKS
// ═══════════════════════════════════════════════════════════════════════════════

function TaskBrowse({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const [skill, setSkill]   = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort]     = useState('newest')

  const filtered = state.tasks
    .filter(t =>
      (status === 'all' || t.status === status) &&
      (!skill || t.skill_tags.some(s => s.toLowerCase().includes(skill.toLowerCase())) || t.title.toLowerCase().includes(skill.toLowerCase()))
    )
    .sort((a, b) => {
      if (sort === 'newest')  return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'budget-hi') return parseFloat(b.budget) - parseFloat(a.budget)
      if (sort === 'budget-lo') return parseFloat(a.budget) - parseFloat(b.budget)
      if (sort === 'deadline') return new Date(a.deadline) - new Date(b.deadline)
      return 0
    })

  const clearFilters = () => { setSkill(''); setStatus('all'); setSort('newest') }
  const filtersActive = skill || status !== 'all' || sort !== 'newest'

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <PageTitle sub={`${filtered.length} tasks found`}>Browse Tasks</PageTitle>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Input placeholder="Search by skill or keyword…" value={skill} onChange={e => setSkill(e.target.value)} style={{ width: 240 }} />
        <SelectField value={status} onChange={e => setStatus(e.target.value)} style={{ minWidth: 150 }}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="disputed">Disputed</option>
        </SelectField>
        <SelectField value={sort} onChange={e => setSort(e.target.value)} style={{ minWidth: 160 }}>
          <option value="newest">Newest First</option>
          <option value="budget-hi">Budget: High → Low</option>
          <option value="budget-lo">Budget: Low → High</option>
          <option value="deadline">Deadline: Soonest</option>
        </SelectField>
        {filtersActive && <Btn variant="ghost" size="sm" onClick={clearFilters}>✕ Clear Filters</Btn>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
        {filtered.map(task => (
          <Card key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--accent)', fontWeight: 500 }}>${task.budget}</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{task.title}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{task.description.slice(0, 110)}…</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>{task.skill_tags.slice(0, 4).map(t => <Tag key={t}>{t}</Tag>)}</div>
            <Divider style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
              <Mono>{state.bids.filter(b => b.task_id === task.task_id && b.status !== 'withdrawn').length} bids</Mono>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState icon="◻" message="No tasks match your filter" action={filtersActive ? <Btn variant="secondary" size="sm" onClick={clearFilters}>Clear Filters</Btn> : null} />
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: TASK DETAIL — fully interactive
// ═══════════════════════════════════════════════════════════════════════════════

function TaskDetail({ taskId, setPage, setSelectedTask }) {
  const { user } = useAuth()
  const { state, dispatch } = useStore()
  const toast = useToast()

  const task = state.tasks.find(t => t.task_id === taskId)
  const bids = state.bids.filter(b => b.task_id === taskId && b.status !== 'withdrawn')
  const escrow = state.escrows[taskId]

  // Bid form
  const [bidAmount, setBidAmount]   = useState('')
  const [bidPitch, setBidPitch]     = useState('')
  const [bidErrors, setBidErrors]   = useState({})
  const [bidLoading, setBidLoading] = useState(false)

  // Modals
  const [acceptModal, setAcceptModal]   = useState(null) // bid object
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [releaseModal, setReleaseModal] = useState(false)
  const [releaseLoading, setReleaseLoading] = useState(false)
  const [fundModal, setFundModal]       = useState(false)
  const [fundLoading, setFundLoading]   = useState(false)
  const [disputeModal, setDisputeModal] = useState(false)
  const [disputeText, setDisputeText]   = useState('')
  const [disputeEv, setDisputeEv]       = useState([])
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [reviewModal, setReviewModal]   = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewDone, setReviewDone]     = useState(!!state.reviews.find(r => r.task_id === taskId))

  // My bid (earner)
  const myBid = state.bids.find(b => b.task_id === taskId && b.bidder_id === 'u3')
  const alreadyBid = !!myBid && myBid.status !== 'withdrawn'

  if (!task) return (
    <div className="page-enter">
      <EmptyState message="Task not found" action={<Btn onClick={() => setPage('tasks-browse')}>← Back to Tasks</Btn>} />
    </div>
  )

  const isCreator = user.role === 'creator'
  const isEarner  = user.role === 'earner'
  const acceptedBid = bids.find(b => b.status === 'accepted')

  // ── Validate & submit bid ──────────────────────────────────────────────────
  function submitBid() {
    const errs = {}
    if (!bidAmount || isNaN(bidAmount) || parseFloat(bidAmount) <= 0) errs.amount = 'Enter a valid amount greater than 0'
    if (parseFloat(bidAmount) > parseFloat(task.budget) * 2) errs.amount = 'Bid exceeds double the task budget'
    if (!bidPitch.trim() || bidPitch.trim().length < 20) errs.pitch = 'Pitch must be at least 20 characters'
    if (Object.keys(errs).length) { setBidErrors(errs); return }
    setBidErrors({})
    setBidLoading(true)
    setTimeout(() => {
      const newBid = { bid_id: `b${Date.now()}`, task_id: taskId, bidder_id: 'u3', amount: bidAmount, pitch: bidPitch.trim(), status: 'pending', display_name: user.displayName || 'You', avg_rating: 4.2, created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_BID', bid: newBid })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'bid.submitted', title: 'Bid submitted!', body: `Your bid of $${bidAmount} on "${task.title}" is now live.`, is_read: false, created_at: new Date().toISOString(), reference_id: taskId } })
      toast(`Bid of $${bidAmount} submitted successfully!`, 'success')
      setBidLoading(false)
      setBidAmount('')
      setBidPitch('')
    }, 900)
  }

  // ── Withdraw bid (earner) ─────────────────────────────────────────────────
  function withdrawBid() {
    dispatch({ type: 'WITHDRAW_BID', bid_id: myBid.bid_id })
    toast('Bid withdrawn successfully', 'info')
  }

  // ── Accept bid (creator) ──────────────────────────────────────────────────
  function confirmAccept() {
    setAcceptLoading(true)
    setTimeout(() => {
      dispatch({ type: 'UPDATE_BID', bid_id: acceptModal.bid_id, changes: { status: 'accepted' } })
      dispatch({ type: 'REJECT_OTHER_BIDS', task_id: taskId, accepted_bid_id: acceptModal.bid_id })
      dispatch({ type: 'UPDATE_TASK', task_id: taskId, changes: { status: 'in_progress', assigned_to: acceptModal.bidder_id } })
      dispatch({ type: 'SET_ESCROW', task_id: taskId, status: 'pending_payment' })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'bid.accepted', title: 'Bid accepted — fund escrow', body: `You accepted ${acceptModal.display_name}'s bid. Please fund the escrow to begin work.`, is_read: false, created_at: new Date().toISOString(), reference_id: taskId } })
      toast(`Bid accepted! Fund escrow to begin work.`, 'success')
      setAcceptLoading(false)
      setAcceptModal(null)
    }, 1000)
  }

  // ── Fund escrow (creator) ─────────────────────────────────────────────────
  function confirmFund() {
    setFundLoading(true)
    setTimeout(() => {
      dispatch({ type: 'SET_ESCROW', task_id: taskId, status: 'funded' })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'escrow.funded', title: 'Escrow funded — work can begin!', body: `Funds for "${task.title}" are secured. The earner has been notified to begin work.`, is_read: false, created_at: new Date().toISOString(), reference_id: taskId } })
      toast('Escrow funded! Earner has been notified to begin.', 'success')
      setFundLoading(false)
      setFundModal(false)
    }, 1200)
  }

  // ── Release payment (creator) ─────────────────────────────────────────────
  function confirmRelease() {
    setReleaseLoading(true)
    setTimeout(() => {
      dispatch({ type: 'UPDATE_TASK', task_id: taskId, changes: { status: 'completed' } })
      dispatch({ type: 'SET_ESCROW', task_id: taskId, status: 'released' })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'payment.released', title: 'Payment released!', body: `$${task.budget} has been released to the earner for "${task.title}".`, is_read: false, created_at: new Date().toISOString(), reference_id: taskId } })
      toast(`$${task.budget} released to earner. Task complete!`, 'success')
      setReleaseLoading(false)
      setReleaseModal(false)
      setTimeout(() => setReviewModal(true), 600)
    }, 1100)
  }

  // ── Submit dispute (creator) ──────────────────────────────────────────────
  function confirmDispute() {
    if (!disputeText.trim() || disputeText.trim().length < 20) {
      toast('Please provide at least 20 characters describing the issue', 'error')
      return
    }
    setDisputeLoading(true)
    setTimeout(() => {
      dispatch({ type: 'UPDATE_TASK', task_id: taskId, changes: { status: 'disputed' } })
      dispatch({ type: 'SET_ESCROW', task_id: taskId, status: 'disputed' })
      dispatch({ type: 'ADD_DISPUTE', dispute: { dispute_id: `d${Date.now()}`, task_id: taskId, task_title: task.title, creator_email: user.email, earner_email: 'earner@demo.com', reason: disputeText.trim(), status: 'open', opened_at: new Date().toISOString(), amount_cents: parseFloat(task.budget) * 100, evidence_urls: [] } })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'dispute.opened', title: 'Dispute raised', body: `A dispute has been raised for "${task.title}". An admin will review it shortly.`, is_read: false, created_at: new Date().toISOString(), reference_id: taskId } })
      toast('Dispute raised. An admin will review within 24 hours.', 'warning')
      setDisputeLoading(false)
      setDisputeModal(false)
      setDisputeText('')
    }, 1000)
  }

  // ── Submit review ─────────────────────────────────────────────────────────
  function submitReview() {
    if (!reviewRating) { toast('Please select a star rating', 'error'); return }
    setReviewLoading(true)
    setTimeout(() => {
      dispatch({ type: 'ADD_REVIEW', review: { review_id: `r${Date.now()}`, task_id: taskId, reviewer_id: 'u1', reviewee_id: acceptedBid?.bidder_id || 'u3', rating: reviewRating, comment: reviewComment.trim(), role: 'creator', created_at: new Date().toISOString() } })
      toast('Review submitted — thank you!', 'success')
      setReviewLoading(false)
      setReviewModal(false)
      setReviewDone(true)
    }, 800)
  }

  const currentStatus = state.tasks.find(t => t.task_id === taskId)?.status || task.status
  const currentEscrow = state.escrows[taskId]

  return (
    <div className="page-enter" style={{ maxWidth: 920 }}>
      <button onClick={() => setPage('tasks-browse')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', marginBottom: 20 }}>← Back to Tasks</button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <Badge variant={currentStatus}>{currentStatus.replace('_', ' ')}</Badge>
            <Mono>Task #{task.task_id}</Mono>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.1, maxWidth: 580 }}>{task.title}</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', color: 'var(--accent)', fontWeight: 500 }}>${task.budget}</div>
          <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
        </div>
      </div>

      {/* Escrow status banner */}
      {currentEscrow && isCreator && (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', ...(currentEscrow.status === 'funded' ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' } : currentEscrow.status === 'released' ? { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' } : currentEscrow.status === 'disputed' ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' } : { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }) }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '1.1rem' }}>{ currentEscrow.status === 'funded' ? '🔒' : currentEscrow.status === 'released' ? '✓' : currentEscrow.status === 'disputed' ? '⚠' : '💳' }</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {currentEscrow.status === 'pending_payment' ? 'Escrow awaiting payment' : currentEscrow.status === 'funded' ? 'Escrow funded — work in progress' : currentEscrow.status === 'released' ? 'Payment released to earner' : currentEscrow.status === 'disputed' ? 'Disputed — under admin review' : 'Escrow status'}
              </div>
              <Mono size="0.65rem">{currentEscrow.status === 'funded' ? `$${task.budget} held securely` : currentEscrow.status === 'released' ? `$${task.budget} transferred` : ''}</Mono>
            </div>
          </div>
          {currentEscrow.status === 'pending_payment' && (
            <Btn variant="primary" size="sm" onClick={() => setFundModal(true)}>Fund Escrow — ${task.budget}</Btn>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 10 }}>Description</Mono>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>{task.description}</p>
          </Card>

          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 10 }}>Required Skills</Mono>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{task.skill_tags.map(t => <Tag key={t}>{t}</Tag>)}</div>
          </Card>

          {/* Bids panel */}
          <Card hover={false}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Mono size="0.68rem" color="var(--text-secondary)">Bids ({bids.length})</Mono>
              {bids.length > 1 && <Mono size="0.65rem">sorted by amount</Mono>}
            </div>
            {bids.length === 0 ? (
              <EmptyState icon="◻" message="No bids yet — be the first!" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...bids].sort((a,b) => parseFloat(a.amount) - parseFloat(b.amount)).map(bid => (
                  <div key={bid.bid_id} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', border: `1px solid ${bid.status === 'accepted' ? 'var(--accent)' : bid.status === 'rejected' ? 'var(--border)' : 'var(--border)'}`, opacity: bid.status === 'rejected' ? 0.55 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bid.display_name}</span>
                        {bid.bidder_id === 'u3' && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>(You)</span>}
                        <div style={{ marginTop: 3 }}><Stars rating={bid.avg_rating} /></div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--accent)' }}>${bid.amount}</span>
                        <Badge variant={bid.status}>{bid.status}</Badge>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: isCreator && bid.status === 'pending' ? 12 : 0 }}>{bid.pitch}</p>
                    {isCreator && bid.status === 'pending' && currentStatus === 'open' && (
                      <Btn variant="primary" size="sm" onClick={() => setAcceptModal(bid)}>Accept This Bid</Btn>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Creator: post-acceptance actions */}
          {isCreator && currentStatus === 'in_progress' && currentEscrow?.status === 'funded' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="success" onClick={() => setReleaseModal(true)}>✓ Release Payment</Btn>
              <Btn variant="danger" onClick={() => setDisputeModal(true)}>⚠ Raise Dispute</Btn>
            </div>
          )}

          {/* Completed + review prompt */}
          {currentStatus === 'completed' && isCreator && !reviewDone && (
            <Card hover={false} style={{ border: '1px solid var(--accent)', background: 'var(--accent-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Task complete — leave a review</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Help other creators find great earners by rating the work.</p>
                </div>
                <Btn onClick={() => setReviewModal(true)}>Leave Review</Btn>
              </div>
            </Card>
          )}

          {currentStatus === 'completed' && reviewDone && (
            <Card hover={false} style={{ border: '1px solid var(--success)', textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>✓</div>
              <Mono color="var(--success)" size="0.8rem">Review submitted — thank you!</Mono>
            </Card>
          )}
        </div>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Earner bid form */}
          {isEarner && currentStatus === 'open' && !alreadyBid && (
            <Card hover={false}>
              <Mono size="0.68rem" color="var(--accent)" style={{ display: 'block', marginBottom: 14 }}>Submit Your Bid</Mono>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Input label={`Your Price ($) — Budget: $${task.budget}`} type="number" min="1" placeholder="e.g. 750" value={bidAmount} onChange={e => { setBidAmount(e.target.value); setBidErrors(v => ({ ...v, amount: null })) }} error={bidErrors.amount} />
                <Textarea label="Pitch (min 20 characters)" placeholder="Why are you the best fit? Mention relevant experience and your timeline…" value={bidPitch} onChange={e => { setBidPitch(e.target.value); setBidErrors(v => ({ ...v, pitch: null })) }} style={{ minHeight: 120 }} error={bidErrors.pitch} />
                <Btn fullWidth loading={bidLoading} onClick={submitBid}>Submit Bid</Btn>
              </div>
            </Card>
          )}

          {isEarner && alreadyBid && myBid.status === 'pending' && (
            <Card hover={false} style={{ border: '1px solid var(--info)' }}>
              <Mono size="0.68rem" color="var(--info)" style={{ display: 'block', marginBottom: 10 }}>Your Bid</Mono>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', color: 'var(--accent)', marginBottom: 6 }}>${myBid.amount}</div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>{myBid.pitch}</p>
              <Btn variant="danger" size="sm" fullWidth onClick={withdrawBid}>Withdraw Bid</Btn>
            </Card>
          )}

          {isEarner && alreadyBid && myBid.status === 'accepted' && (
            <Card hover={false} style={{ border: '1px solid var(--success)', textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🎉</div>
              <Mono color="var(--success)" size="0.8rem">Your bid was accepted!</Mono>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>{currentEscrow?.status === 'funded' ? 'Escrow is funded — work can begin!' : 'Waiting for creator to fund escrow.'}</p>
            </Card>
          )}

          {/* Task meta */}
          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 14 }}>Task Details</Mono>
            {[
              ['Budget',    `$${task.budget}`],
              ['Deadline',  new Date(task.deadline).toLocaleDateString()],
              ['Status',    currentStatus.replace('_', ' ')],
              ['Posted',    new Date(task.created_at).toLocaleDateString()],
              ['Bids',      `${bids.length} bid${bids.length !== 1 ? 's' : ''}`],
              ['Task ID',   `#${task.task_id}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <Mono>{k}</Mono>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </Card>

          {/* Message the creator/earner button */}
          <Btn variant="secondary" fullWidth onClick={() => setPage('messages')}>💬 Send a Message</Btn>
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      <ConfirmModal open={!!acceptModal} onClose={() => setAcceptModal(null)} onConfirm={confirmAccept} loading={acceptLoading}
        title="Accept This Bid" confirmLabel="Accept & Move to Escrow" confirmVariant="primary"
        message={acceptModal ? `Accept ${acceptModal.display_name}'s bid of $${acceptModal.amount}? All other bids will be rejected, and funds will move to escrow pending payment.` : ''} />

      <Modal open={fundModal} onClose={() => setFundModal(false)} title="Fund Escrow" maxWidth={440}>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>
          You're about to fund escrow for <strong style={{ color: 'var(--text-primary)' }}>{task.title}</strong>.
        </p>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20 }}>
          {[['Task Budget', `$${task.budget}`], ['Platform Fee (10%)', `$${(parseFloat(task.budget) * 0.1).toFixed(2)}`], ['Total Charged', `$${(parseFloat(task.budget) * 1.1).toFixed(2)}`]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <Mono>{k}</Mono>
              <span style={{ fontFamily: 'var(--font-mono)', color: k.includes('Total') ? 'var(--accent)' : 'var(--text-primary)', fontWeight: k.includes('Total') ? 600 : 400 }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          In demo mode no actual charge occurs. In production this would charge your saved payment method via Stripe.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setFundModal(false)} disabled={fundLoading}>Cancel</Btn>
          <Btn variant="primary" onClick={confirmFund} loading={fundLoading}>Confirm & Fund Escrow</Btn>
        </div>
      </Modal>

      <ConfirmModal open={releaseModal} onClose={() => setReleaseModal(false)} onConfirm={confirmRelease} loading={releaseLoading}
        title="Release Payment" confirmLabel="Release Funds" confirmVariant="success"
        message={`Release $${task.budget} to the earner? This confirms the work is complete and satisfactory. This action cannot be undone.`} />

      <Modal open={disputeModal} onClose={() => setDisputeModal(false)} title="Raise a Dispute" maxWidth={500}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 16, lineHeight: 1.6 }}>
          Raising a dispute freezes the escrow and notifies our admin team. Be specific — include what was agreed vs. what was delivered.
        </p>
        <Textarea label="Reason for dispute (min 20 characters)" value={disputeText} onChange={e => setDisputeText(e.target.value)} placeholder="Describe the issue clearly. The more detail you provide, the faster it can be resolved." style={{ minHeight: 140 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setDisputeModal(false)} disabled={disputeLoading}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmDispute} loading={disputeLoading}>Submit Dispute</Btn>
        </div>
      </Modal>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Leave a Review" maxWidth={440}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20, lineHeight: 1.6 }}>
          Rate your experience with {acceptedBid?.display_name || 'the earner'} on this task.
        </p>
        <div style={{ marginBottom: 20 }}>
          <Mono style={{ display: 'block', marginBottom: 10 }}>Rating</Mono>
          <Stars rating={reviewRating} interactive onRate={setReviewRating} />
          {reviewRating > 0 && <Mono color="var(--accent)" size="0.7rem" style={{ marginTop: 6, display: 'block' }}>{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}</Mono>}
        </div>
        <Textarea label="Comment (optional)" value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share details of your experience…" style={{ minHeight: 90 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setReviewModal(false)} disabled={reviewLoading}>Skip</Btn>
          <Btn variant="primary" onClick={submitReview} loading={reviewLoading} disabled={!reviewRating}>Submit Review</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: POST TASK
// ═══════════════════════════════════════════════════════════════════════════════

function TaskNew({ setPage, setSelectedTask }) {
  const { user } = useAuth()
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

  const STEPS = ['Details', 'Budget & Date', 'Skills', 'Review']

  function validateStep() {
    const e = {}
    if (step === 0) {
      if (!title.trim() || title.trim().length < 5) e.title = 'Title must be at least 5 characters'
      if (!desc.trim() || desc.trim().length < 20) e.desc = 'Description must be at least 20 characters'
    }
    if (step === 1) {
      if (!budget || isNaN(budget) || parseFloat(budget) <= 0) e.budget = 'Enter a valid budget greater than 0'
      if (!deadline) e.deadline = 'Deadline is required'
      else if (new Date(deadline) <= new Date()) e.deadline = 'Deadline must be in the future'
    }
    if (step === 2) {
      if (!tags.trim()) e.tags = 'Add at least one skill tag'
    }
    return e
  }

  function next() {
    const e = validateStep()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setStep(s => s + 1)
  }

  function back() { setErrors({}); setStep(s => s - 1) }

  function submit() {
    setLoading(true)
    setTimeout(() => {
      const id = `task_${Date.now()}`
      const newTask = {
        task_id: id, creator_id: 'u1', assigned_to: null, status: 'open',
        title: title.trim(), description: desc.trim(),
        budget, deadline: new Date(deadline).toISOString(),
        skill_tags: tags.split(',').map(s => s.trim()).filter(Boolean),
        created_at: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_TASK', task: newTask })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'task.created', title: 'Task posted!', body: `"${title}" is now live. Earners with matching skills have been notified.`, is_read: false, created_at: new Date().toISOString(), reference_id: id } })
      toast(`Task "${title}" posted successfully!`, 'success')
      setCreatedId(id)
      setLoading(false)
    }, 1000)
  }

  if (createdId) return (
    <div className="page-enter" style={{ maxWidth: 580 }}>
      <Card hover={false} style={{ textAlign: 'center', padding: '48px 32px', border: '1px solid var(--success)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✓</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Task Posted!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>Your task is live. Earners with matching skills have been notified.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 28 }}>Bids typically arrive within a few hours.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={() => { setSelectedTask(createdId); setPage('task-detail') }}>View Task</Btn>
          <Btn variant="secondary" onClick={() => setPage('tasks-mine')}>All My Tasks</Btn>
          <Btn variant="ghost" onClick={() => { setTitle(''); setDesc(''); setBudget(''); setDead(''); setTags(''); setCreatedId(null); setStep(0) }}>Post Another</Btn>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="page-enter" style={{ maxWidth: 640 }}>
      <PageTitle sub="Earners are matched and notified by skill tags automatically">Post a New Task</PageTitle>
      <StepBar steps={STEPS} current={step} />

      <Card hover={false}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Input label="Task Title" placeholder="e.g. Build a REST API for my startup" value={title} onChange={e => { setTitle(e.target.value); setErrors(v => ({ ...v, title: null })) }} error={errors.title} />
            <Textarea label="Description" placeholder="Describe what you need done. Be specific — better descriptions attract better bids." value={desc} onChange={e => { setDesc(e.target.value); setErrors(v => ({ ...v, desc: null })) }} style={{ minHeight: 160 }} error={errors.desc} />
          </div>
        )}
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Input label="Budget ($)" type="number" min="1" placeholder="e.g. 500" value={budget} onChange={e => { setBudget(e.target.value); setErrors(v => ({ ...v, budget: null })) }} error={errors.budget} hint="What you're willing to pay" />
            <Input label="Deadline" type="date" value={deadline} onChange={e => { setDead(e.target.value); setErrors(v => ({ ...v, deadline: null })) }} error={errors.deadline} hint="When you need it done" />
          </div>
        )}
        {step === 2 && (
          <Input label="Skill Tags (comma separated)" placeholder="e.g. react, node.js, postgres, UI/UX" value={tags} onChange={e => { setTags(e.target.value); setErrors(v => ({ ...v, tags: null })) }} hint="These are used to automatically match and notify earners with relevant skills. Use specific terms." error={errors.tags} />
        )}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Mono style={{ display: 'block', marginBottom: 4 }}>Review your task</Mono>
            {[['Title', title], ['Budget', `$${budget}`], ['Deadline', deadline ? new Date(deadline).toLocaleDateString() : '—'], ['Skills', tags || '—']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <Mono>{k}</Mono>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', maxWidth: 320, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginTop: 4 }}>
              <Mono size="0.65rem" style={{ display: 'block', marginBottom: 6 }}>Description preview</Mono>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && <Btn variant="secondary" onClick={back}>← Back</Btn>}
          <Btn variant="ghost" onClick={() => setPage('dashboard')}>Cancel</Btn>
        </div>
        {step < STEPS.length - 1
          ? <Btn onClick={next}>Next →</Btn>
          : <Btn loading={loading} onClick={submit}>Post Task</Btn>
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MY TASKS (creator)
// ═══════════════════════════════════════════════════════════════════════════════

function MyTasks({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const [filter, setFilter] = useState('all')
  const myTasks = state.tasks.filter(t => t.creator_id === 'u1')
  const filtered = myTasks.filter(t => filter === 'all' || t.status === filter)

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <PageTitle sub={`${myTasks.length} tasks posted`}>My Tasks</PageTitle>
        <Btn onClick={() => setPage('tasks-new')}>+ New Task</Btn>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'open', 'in_progress', 'completed', 'disputed', 'expired'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 150ms ease', border: `1px solid ${filter === s ? 'var(--accent)' : 'var(--border)'}`, background: filter === s ? 'var(--accent-glow)' : 'transparent', color: filter === s ? 'var(--accent)' : 'var(--text-muted)' }}>
            {s.replace('_', ' ')} {s !== 'all' ? `(${myTasks.filter(t => t.status === s).length})` : `(${myTasks.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(task => {
          const taskBids = state.bids.filter(b => b.task_id === task.task_id && b.status !== 'withdrawn')
          const pendingBids = taskBids.filter(b => b.status === 'pending').length
          return (
            <Card key={task.task_id} onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{task.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>{task.skill_tags.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>)}</div>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0 }}>
                {pendingBids > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 500, color: 'var(--accent)' }}>{pendingBids}</div>
                    <Mono>new bids</Mono>
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 500 }}>${task.budget}</div>
                  <Mono>Due {new Date(task.deadline).toLocaleDateString()}</Mono>
                </div>
              </div>
            </Card>
          )
        })}
        {filtered.length === 0 && <EmptyState icon="▤" message={`No ${filter === 'all' ? '' : filter.replace('_', ' ')} tasks`} action={<Btn size="sm" onClick={() => setPage('tasks-new')}>Post a Task</Btn>} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MY BIDS (earner)
// ═══════════════════════════════════════════════════════════════════════════════

function MyBids({ setPage, setSelectedTask }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const myBids = state.bids.filter(b => b.bidder_id === 'u3')
  const [filter, setFilter] = useState('all')

  const filtered = myBids.filter(b => filter === 'all' || b.status === filter)

  function withdraw(bid) {
    dispatch({ type: 'WITHDRAW_BID', bid_id: bid.bid_id })
    toast('Bid withdrawn', 'info')
  }

  return (
    <div className="page-enter">
      <PageTitle sub={`${myBids.length} bids placed`}>My Bids</PageTitle>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'pending', 'accepted', 'rejected', 'withdrawn'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 150ms ease', border: `1px solid ${filter === s ? 'var(--accent)' : 'var(--border)'}`, background: filter === s ? 'var(--accent-glow)' : 'transparent', color: filter === s ? 'var(--accent)' : 'var(--text-muted)' }}>
            {s} ({s === 'all' ? myBids.length : myBids.filter(b => b.status === s).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(bid => {
          const task = state.tasks.find(t => t.task_id === bid.task_id)
          return (
            <Card key={bid.bid_id} hover={bid.status !== 'withdrawn'} style={{ opacity: bid.status === 'withdrawn' ? 0.55 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <Badge variant={bid.status}>{bid.status}</Badge>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }} onClick={() => { if (task) { setSelectedTask(task.task_id); setPage('task-detail') } }}>{task?.title || 'Task removed'}</span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{bid.pitch.slice(0, 120)}…</p>
                  <Mono>{new Date(bid.created_at).toLocaleDateString()}</Mono>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--accent)', fontWeight: 500 }}>${bid.amount}</div>
                  {task && <Mono>Budget: ${task.budget}</Mono>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {task && <Btn variant="secondary" size="sm" onClick={() => { setSelectedTask(task.task_id); setPage('task-detail') }}>View Task</Btn>}
                {bid.status === 'pending' && <Btn variant="danger" size="sm" onClick={() => withdraw(bid)}>Withdraw</Btn>}
              </div>
            </Card>
          )
        })}
        {filtered.length === 0 && <EmptyState icon="◻" message="No bids in this category" action={<Btn size="sm" onClick={() => setPage('tasks-browse')}>Browse Tasks</Btn>} />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function Suggestions({ setPage, setSelectedTask }) {
  const { state } = useStore()
  const toast = useToast()
  const [dismissed, setDismissed] = useState(new Set())

  const suggestions = MOCK_SUGGESTIONS.filter(s => !dismissed.has(s.task_id))
    .map(s => {
      const live = state.tasks.find(t => t.task_id === s.task_id)
      return live ? { ...s, status: live.status } : s
    })

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <PageTitle sub="Ranked by Jaccard similarity score against your skill profile">For You</PageTitle>
        <Mono size="0.72rem" color="var(--text-secondary)">{suggestions.length} matches</Mono>
      </div>

      {suggestions.length === 0 && <EmptyState icon="🎯" message="No more suggestions — check back soon" action={<Btn onClick={() => setDismissed(new Set())}>Reset</Btn>} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {suggestions.map(s => (
          <Card key={s.task_id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <Badge variant={s.status}>{s.status.replace('_', ' ')}</Badge>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem' }}>{s.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>{s.skill_tags.map(t => <Tag key={t}>{t}</Tag>)}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                  <Mono>Budget: <span style={{ color: 'var(--accent)' }}>${s.budget}</span></Mono>
                  <Mono>Due: {new Date(s.deadline).toLocaleDateString()}</Mono>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn size="sm" onClick={() => { setSelectedTask(s.task_id); setPage('task-detail') }}>View Task</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => { setDismissed(d => new Set([...d, s.task_id])); toast('Suggestion dismissed', 'info') }}>Dismiss</Btn>
                </div>
              </div>
              {/* Match score ring */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `conic-gradient(var(--accent) ${s.match_score * 360}deg, var(--bg-elevated) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>{Math.round(s.match_score * 100)}%</span>
                  </div>
                </div>
                <Mono style={{ display: 'block', marginTop: 5 }}>match</Mono>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: MESSAGES — multi-thread
// ═══════════════════════════════════════════════════════════════════════════════

const CONTACTS = [
  { id: 'u3', name: 'Alex Chen',    avatar: 'AC', role: 'Earner',   task: 'REST API Task #1' },
  { id: 'u5', name: 'Maria Santos', avatar: 'MS', role: 'Earner',   task: 'REST API Task #1' },
  { id: 'u2', name: 'James Lee',    avatar: 'JL', role: 'Creator',  task: 'Mobile App Task #2' },
]

function Messages() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [activeContact, setActiveContact] = useState('u3')
  const [msg, setMsg]     = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  const contact = CONTACTS.find(c => c.id === activeContact)
  const thread  = state.messages.filter(m => (m.sender_id === 'u1' && m.receiver_id === activeContact) || (m.sender_id === activeContact && m.receiver_id === 'u1'))

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread, typing])

  const REPLIES = [
    'Got it, I'll get started on that right away.',
    'Understood. I'll have an update for you by end of day.',
    'Sure, that makes sense. Let me check and get back to you.',
    'Perfect. I've noted that requirement.',
    'Thanks for the context — makes things much clearer.',
    'Can we jump on a quick call to align on the details?',
  ]

  function send() {
    if (!msg.trim()) return
    dispatch({ type: 'ADD_MESSAGE', message: { message_id: `m${Date.now()}`, sender_id: 'u1', receiver_id: activeContact, content: msg.trim(), created_at: new Date().toISOString(), sender_name: 'You' } })
    setMsg('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      dispatch({ type: 'ADD_MESSAGE', message: { message_id: `r${Date.now()}`, sender_id: activeContact, receiver_id: 'u1', content: REPLIES[Math.floor(Math.random() * REPLIES.length)], created_at: new Date().toISOString(), sender_name: contact.name } })
    }, 1400 + Math.random() * 600)
  }

  return (
    <div className="page-enter" style={{ maxWidth: 900 }}>
      <PageTitle sub="Direct messages">Messages</PageTitle>
      <Card hover={false} style={{ display: 'flex', height: 580, padding: 0, overflow: 'hidden' }}>
        {/* Contact list */}
        <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <Mono size="0.65rem">Conversations</Mono>
          </div>
          {CONTACTS.map(c => {
            const lastMsg = state.messages.filter(m => (m.sender_id === 'u1' && m.receiver_id === c.id) || (m.sender_id === c.id && m.receiver_id === 'u1')).slice(-1)[0]
            const isActive = activeContact === c.id
            return (
              <div key={c.id} onClick={() => setActiveContact(c.id)}
                style={{ padding: '12px 14px', cursor: 'pointer', background: isActive ? 'var(--accent-glow)' : 'transparent', borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 150ms ease' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent)', flexShrink: 0 }}>{c.avatar}</div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{c.name}</div>
                    {lastMsg && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastMsg.content.slice(0, 32)}…</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-elevated)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent)', flexShrink: 0 }}>{contact.avatar}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{contact.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <Mono color="var(--success)" size="0.62rem">Online · {contact.task}</Mono>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {thread.length === 0 && <EmptyState icon="◎" message="Start the conversation" />}
            {thread.map(m => {
              const mine = m.sender_id === 'u1'
              return (
                <div key={m.message_id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '72%', background: mine ? 'var(--accent-glow)' : 'var(--bg-elevated)', border: `1px solid ${mine ? 'var(--accent-dim)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                    {!mine && <Mono size="0.62rem" color="var(--accent)" style={{ display: 'block', marginBottom: 4 }}>{m.sender_name}</Mono>}
                    <p style={{ fontSize: '0.88rem', lineHeight: 1.55 }}>{m.content}</p>
                    <Mono size="0.6rem" style={{ display: 'block', textAlign: mine ? 'right' : 'left', marginTop: 5 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Mono>
                  </div>
                </div>
              )
            })}
            {typing && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: `pulse 1s infinite ${i * 0.2}s` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={`Message ${contact.name}… (Enter to send)`}
              style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '9px 13px', fontSize: '0.9rem', outline: 'none' }} />
            <Btn onClick={send} disabled={!msg.trim()}>Send</Btn>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function Notifications({ setPage, setSelectedTask }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const notifs = state.notifications
  const icons = { 'bid.submitted': '⚡', 'task.matched': '🎯', 'payment.released': '💰', 'escrow.funded': '🔒', 'dispute.resolved': '⚖️', 'dispute.opened': '⚠️', 'bid.accepted': '🎉', 'task.created': '✓' }

  function markAll() {
    dispatch({ type: 'MARK_ALL_READ' })
    toast('All notifications marked as read', 'info')
  }

  function handleClick(n) {
    dispatch({ type: 'MARK_NOTIFICATION_READ', id: n.notification_id })
    if (n.reference_id && state.tasks.find(t => t.task_id === n.reference_id)) {
      setSelectedTask(n.reference_id)
      setPage('task-detail')
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <PageTitle sub={`${notifs.filter(n => !n.is_read).length} unread`}>Notifications</PageTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          {notifs.some(n => !n.is_read) && <Btn variant="ghost" size="sm" onClick={markAll}>Mark all read</Btn>}
        </div>
      </div>

      {notifs.length === 0 && <EmptyState icon="◐" message="No notifications yet" />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifs.map(n => (
          <div key={n.notification_id} onClick={() => handleClick(n)}
            style={{ background: n.is_read ? 'var(--bg-surface)' : 'var(--bg-elevated)', border: `1px solid ${n.is_read ? 'var(--border)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', gap: 14, cursor: 'pointer', transition: 'all 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = n.is_read ? 'var(--border)' : 'var(--border-strong)'}>
            <div style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: 2 }}>{icons[n.type] || '🔔'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                <span style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '0.9rem' }}>{n.title}</span>
                <Mono style={{ flexShrink: 0, marginLeft: 10 }}>{new Date(n.created_at).toLocaleDateString()}</Mono>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>
              {state.tasks.find(t => t.task_id === n.reference_id) && <Mono color="var(--accent)" size="0.65rem" style={{ display: 'block', marginTop: 6 }}>Click to view →</Mono>}
            </div>
            {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function Profile() {
  const { user } = useAuth()
  const { state } = useStore()
  const toast = useToast()

  const [displayName, setName]   = useState(user.displayName || 'Demo User')
  const [bio, setBio]            = useState('Passionate developer with experience across full-stack web and mobile.')
  const [skills, setSkills]      = useState('node.js, react, postgres, python')
  const [portfolio, setPort]     = useState('https://github.com/demouser')
  const [email, setEmail]        = useState(user.email)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [pwErrors, setPwErrors]   = useState({})
  const [saving, setSaving]       = useState(false)
  const [savingPw, setSavingPw]   = useState(false)
  const [tab, setTab]             = useState('profile')

  const myReviews = state.reviews.filter(r => r.reviewee_id === 'u1' || r.reviewer_id === 'u1')
  const avgRating = myReviews.length ? (myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length).toFixed(1) : null

  function saveProfile() {
    setSaving(true)
    setTimeout(() => { setSaving(false); toast('Profile saved successfully', 'success') }, 700)
  }

  function changePassword() {
    const e = {}
    if (!currentPw) e.current = 'Enter your current password'
    if (newPw.length < 8) e.new = 'New password must be at least 8 characters'
    if (Object.keys(e).length) { setPwErrors(e); return }
    setPwErrors({})
    setSavingPw(true)
    setTimeout(() => { setSavingPw(false); setCurrentPw(''); setNewPw(''); toast('Password changed successfully', 'success') }, 800)
  }

  const tabs = ['profile', 'security', 'reviews']

  return (
    <div className="page-enter" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <PageTitle sub="Manage your account settings">Profile</PageTitle>
        {avgRating && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--accent)' }}>{avgRating}</div>
            <Stars rating={parseFloat(avgRating)} />
            <Mono>{myReviews.length} reviews</Mono>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 150ms ease', marginBottom: -1 }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 16 }}>Account Info</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Display Name" value={displayName} onChange={e => setName(e.target.value)} />
              <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              <div><Badge variant={user.role}>{user.role}</Badge></div>
            </div>
          </Card>
          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 16 }}>Professional Profile</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Textarea label="Bio" value={bio} onChange={e => setBio(e.target.value)} style={{ minHeight: 80 }} />
              <Input label="Skills (comma separated)" value={skills} onChange={e => setSkills(e.target.value)} hint="Used by the matching engine to suggest tasks to you" />
              <Input label="Portfolio / GitHub URL" value={portfolio} onChange={e => setPort(e.target.value)} type="url" />
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn loading={saving} onClick={saveProfile}>Save Changes</Btn>
            <Btn variant="secondary" onClick={() => { setName(user.displayName || 'Demo User'); setBio('Passionate developer with experience across full-stack web and mobile.') }}>Reset</Btn>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <Card hover={false}>
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 16 }}>Change Password</Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Current Password" type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwErrors(v => ({ ...v, current: null })) }} error={pwErrors.current} />
            <Input label="New Password" type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwErrors(v => ({ ...v, new: null })) }} hint="Minimum 8 characters" error={pwErrors.new} />
            <Btn loading={savingPw} onClick={changePassword} style={{ alignSelf: 'flex-start' }}>Update Password</Btn>
          </div>
          <Divider style={{ margin: '24px 0' }} />
          <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 12 }}>Danger Zone</Mono>
          <Btn variant="danger" size="sm" onClick={() => toast('Account deletion is disabled in demo mode', 'warning')}>Delete Account</Btn>
        </Card>
      )}

      {tab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {myReviews.length === 0 && <EmptyState icon="★" message="No reviews yet — complete a task to receive your first review" />}
          {myReviews.map(r => (
            <Card key={r.review_id} hover={false}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Stars rating={r.rating} />
                <Mono>{new Date(r.created_at).toLocaleDateString()}</Mono>
              </div>
              {r.comment && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.comment}</p>}
              <Mono style={{ display: 'block', marginTop: 8 }}>Task #{r.task_id}</Mono>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: ADMIN — DISPUTE QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

function AdminDisputes({ setPage, setSelectedDispute }) {
  const { state } = useStore()
  const [filter, setFilter] = useState('open')
  const filtered = state.disputes.filter(d => filter === 'all' || d.status === filter)

  return (
    <div className="page-enter">
      <PageTitle sub="Review and resolve platform disputes">Dispute Queue</PageTitle>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'open', 'under_review', 'resolved_creator', 'resolved_earner'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 150ms ease', border: `1px solid ${filter === s ? 'var(--accent)' : 'var(--border)'}`, background: filter === s ? 'var(--accent-glow)' : 'transparent', color: filter === s ? 'var(--accent)' : 'var(--text-muted)' }}>
            {s.replace('_', ' ')} ({s === 'all' ? state.disputes.length : state.disputes.filter(d => d.status === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? <EmptyState icon="⚖" message="No disputes in this category" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(d => (
            <Card key={d.dispute_id} onClick={() => { setSelectedDispute(d.dispute_id); setPage('admin-dispute-detail') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <Badge variant={d.status === 'open' ? 'disputed' : d.status === 'under_review' ? 'pending' : 'completed'}>{d.status.replace('_', ' ')}</Badge>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem' }}>{d.task_title}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{d.reason.slice(0, 160)}{d.reason.length > 160 ? '…' : ''}</p>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <Mono>Creator: {d.creator_email}</Mono>
                    <Mono>Earner: {d.earner_email}</Mono>
                    <Mono>Opened: {new Date(d.opened_at).toLocaleDateString()}</Mono>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: 20, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: 'var(--accent)', fontWeight: 500 }}>${(d.amount_cents / 100).toFixed(0)}</div>
                  <Mono>in escrow</Mono>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: ADMIN — DISPUTE DETAIL
// ═══════════════════════════════════════════════════════════════════════════════

function AdminDisputeDetail({ disputeId, setPage }) {
  const { state, dispatch } = useStore()
  const toast = useToast()

  const dispute = state.disputes.find(d => d.dispute_id === disputeId)
  const task    = dispute ? state.tasks.find(t => t.task_id === dispute.task_id) : null
  const taskMessages = state.messages.filter(m => task && m.task_id === task.task_id)

  const [note, setNote]             = useState('')
  const [noteErr, setNoteErr]       = useState('')
  const [resolveModal, setResolveModal] = useState(null) // 'refund' | 'release'
  const [resolveLoading, setResolveLoading] = useState(false)
  const [timeline, setTimeline]     = useState([
    { action: 'opened',   actor: 'Creator', note: 'Dispute raised by creator', time: dispute?.opened_at || new Date().toISOString() },
    { action: 'assigned', actor: 'Admin',   note: 'Assigned for admin review',  time: new Date(Date.now() - 3600000).toISOString() },
  ])

  if (!dispute) return (
    <div className="page-enter">
      <EmptyState message="Dispute not found" action={<Btn onClick={() => setPage('admin-disputes')}>← Back</Btn>} />
    </div>
  )

  const isResolved = dispute.status.startsWith('resolved')

  function saveNote() {
    if (!note.trim() || note.trim().length < 5) { setNoteErr('Note must be at least 5 characters'); return }
    setNoteErr('')
    setTimeline(t => [...t, { action: 'note_added', actor: 'Admin', note: note.trim(), time: new Date().toISOString() }])
    dispatch({ type: 'UPDATE_DISPUTE', dispute_id: disputeId, changes: { admin_notes: note.trim() } })
    setNote('')
    toast('Note saved to dispute record', 'success')
  }

  function resolve() {
    setResolveLoading(true)
    setTimeout(() => {
      const status = resolveModal === 'refund' ? 'resolved_creator' : 'resolved_earner'
      dispatch({ type: 'UPDATE_DISPUTE', dispute_id: disputeId, changes: { status, resolved_at: new Date().toISOString(), resolution: resolveModal } })
      if (task) dispatch({ type: 'UPDATE_TASK', task_id: task.task_id, changes: { status: 'completed' } })
      dispatch({ type: 'SET_ESCROW', task_id: dispute.task_id, status: resolveModal === 'refund' ? 'refunded' : 'released' })
      dispatch({ type: 'ADD_NOTIFICATION', notification: { notification_id: `n${Date.now()}`, type: 'dispute.resolved', title: 'Dispute resolved', body: resolveModal === 'refund' ? 'The dispute was resolved in your favour — your funds have been returned.' : 'The dispute was resolved — payment has been released to the earner.', is_read: false, created_at: new Date().toISOString(), reference_id: dispute.task_id } })
      setTimeline(t => [...t, { action: 'resolved', actor: 'Admin', note: resolveModal === 'refund' ? 'Resolved: Refund to creator' : 'Resolved: Release to earner', time: new Date().toISOString() }])
      toast(`Dispute resolved — ${resolveModal === 'refund' ? 'Creator refunded' : 'Earner paid'}`, 'success')
      setResolveLoading(false)
      setResolveModal(null)
    }, 1200)
  }

  return (
    <div className="page-enter" style={{ maxWidth: 960 }}>
      <button onClick={() => setPage('admin-disputes')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', marginBottom: 20 }}>← Back to Queue</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <Badge variant={isResolved ? 'completed' : 'disputed'}>{dispute.status.replace('_', ' ')}</Badge>
            <Mono>Dispute #{dispute.dispute_id}</Mono>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, textTransform: 'uppercase' }}>{dispute.task_title}</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--accent)', fontWeight: 500 }}>${(dispute.amount_cents / 100).toFixed(0)}</div>
          <Mono>{isResolved ? 'resolved' : 'held in escrow'}</Mono>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card hover={false}>
            <Mono size="0.68rem" color="var(--danger)" style={{ display: 'block', marginBottom: 10 }}>Dispute Reason</Mono>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>{dispute.reason}</p>
          </Card>

          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 14 }}>Message Log (Task Context)</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
              {state.messages.slice(0, 6).map(m => (
                <div key={m.message_id} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Mono color="var(--accent)" size="0.62rem">{m.sender_name}</Mono>
                    <Mono size="0.6rem">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Mono>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{m.content}</p>
                </div>
              ))}
              {state.messages.length === 0 && <Mono>No messages found for this task</Mono>}
            </div>
          </Card>

          {!isResolved && (
            <>
              <Card hover={false}>
                <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 12 }}>Internal Notes</Mono>
                <Textarea placeholder="Add investigation notes visible only to admins… (min 5 characters)" value={note} onChange={e => { setNote(e.target.value); setNoteErr('') }} error={noteErr} />
                <Btn variant="secondary" size="sm" style={{ marginTop: 10 }} onClick={saveNote}>Save Note</Btn>
              </Card>

              <Card hover={false} style={{ border: '1px solid var(--border-strong)' }}>
                <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 16 }}>Resolution</Mono>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <Mono color="var(--danger)" size="0.68rem" style={{ display: 'block', marginBottom: 8 }}>Refund Creator</Mono>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Cancel the PaymentIntent. Held funds return to creator. No charge made.</p>
                    <Btn variant="danger" fullWidth onClick={() => setResolveModal('refund')}>Refund Creator</Btn>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <Mono color="var(--success)" size="0.68rem" style={{ display: 'block', marginBottom: 8 }}>Release to Earner</Mono>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Capture the PaymentIntent. Funds transfer to earner's Stripe account.</p>
                    <Btn variant="success" fullWidth onClick={() => setResolveModal('release')}>Release to Earner</Btn>
                  </div>
                </div>
              </Card>
            </>
          )}

          {isResolved && (
            <Card hover={false} style={{ textAlign: 'center', padding: 28, border: `1px solid ${dispute.resolution === 'refund' ? 'var(--info)' : 'var(--success)'}` }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{dispute.resolution === 'refund' ? '↩' : '✓'}</div>
              <Mono color={dispute.resolution === 'refund' ? 'var(--info)' : 'var(--success)'} size="0.8rem">
                {dispute.resolution === 'refund' ? 'Resolved: Creator refunded' : 'Resolved: Earner paid'}
              </Mono>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Resolved on {new Date(dispute.resolved_at).toLocaleDateString()}</p>
            </Card>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 14 }}>Parties</Mono>
            {[{ label: 'Creator', email: dispute.creator_email, role: 'creator' }, { label: 'Earner', email: dispute.earner_email, role: 'earner' }].map(p => (
              <div key={p.role} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 8 }}>
                <Badge variant={p.role}>{p.label}</Badge>
                <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.email}</div>
              </div>
            ))}
          </Card>

          <Card hover={false}>
            <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 14 }}>Audit Timeline</Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timeline.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 10, borderBottom: i < timeline.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <Mono color="var(--accent)" size="0.62rem">{e.action.replace('_', ' ')}</Mono>
                      <Mono size="0.6rem">{e.actor}</Mono>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.note}</p>
                    <Mono size="0.6rem" style={{ marginTop: 2 }}>{new Date(e.time).toLocaleString()}</Mono>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {task && (
            <Card hover={false}>
              <Mono size="0.68rem" color="var(--text-secondary)" style={{ display: 'block', marginBottom: 10 }}>Task Info</Mono>
              {[['Budget', `$${task.budget}`], ['Status', task.status.replace('_', ' ')], ['Deadline', new Date(task.deadline).toLocaleDateString()]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <Mono>{k}</Mono>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal open={!!resolveModal} onClose={() => setResolveModal(null)} onConfirm={resolve} loading={resolveLoading}
        title={resolveModal === 'refund' ? 'Refund Creator' : 'Release to Earner'}
        confirmLabel={resolveModal === 'refund' ? 'Confirm Refund' : 'Confirm Release'}
        confirmVariant={resolveModal === 'refund' ? 'danger' : 'success'}
        message={resolveModal === 'refund'
          ? `This will cancel the PaymentIntent and return $${(dispute.amount_cents / 100).toFixed(0)} to the creator. This action cannot be undone.`
          : `This will capture the PaymentIntent and transfer $${(dispute.amount_cents / 100).toFixed(0)} to the earner's Stripe account. This action cannot be undone.`}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: ADMIN — USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_USERS = [
  { user_id: 'u1', email: 'creator@demo.com',  role: 'creator', displayName: 'Demo Creator', created_at: '2025-01-15T00:00:00Z', status: 'active', tasks: 4, spent: 1250 },
  { user_id: 'u3', email: 'earner@demo.com',   role: 'earner',  displayName: 'Alex Chen',    created_at: '2025-01-20T00:00:00Z', status: 'active', tasks: 3, earned: 920 },
  { user_id: 'u2', email: 'creator2@demo.com', role: 'creator', displayName: 'James Lee',    created_at: '2025-02-01T00:00:00Z', status: 'active', tasks: 2, spent: 1600 },
  { user_id: 'u5', email: 'maria@demo.com',    role: 'earner',  displayName: 'Maria Santos', created_at: '2025-02-10T00:00:00Z', status: 'active', tasks: 5, earned: 1800 },
  { user_id: 'u6', email: 'james@demo.com',    role: 'earner',  displayName: 'James Kim',    created_at: '2025-03-01T00:00:00Z', status: 'suspended', tasks: 1, earned: 0 },
]

function AdminUsers() {
  const toast = useToast()
  const [users, setUsers] = useState(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [banModal, setBanModal] = useState(null)

  const filtered = users.filter(u =>
    (roleFilter === 'all' || u.role === roleFilter) &&
    (!search || u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase()))
  )

  function toggleBan(u) {
    setUsers(us => us.map(x => x.user_id === u.user_id ? { ...x, status: x.status === 'suspended' ? 'active' : 'suspended' } : x))
    toast(`${u.displayName} has been ${u.status === 'suspended' ? 'reinstated' : 'suspended'}`, u.status === 'suspended' ? 'success' : 'warning')
    setBanModal(null)
  }

  return (
    <div className="page-enter">
      <PageTitle sub={`${users.length} registered users`}>User Management</PageTitle>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
        <SelectField value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ minWidth: 140 }}>
          <option value="all">All Roles</option>
          <option value="creator">Creators</option>
          <option value="earner">Earners</option>
          <option value="admin">Admins</option>
        </SelectField>
      </div>

      <Card hover={false} style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              {['User', 'Role', 'Status', 'Joined', 'Activity', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.user_id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: u.status === 'suspended' ? 0.6 : 1 }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{u.displayName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                </td>
                <td style={{ padding: '12px 16px' }}><Badge variant={u.role}>{u.role}</Badge></td>
                <td style={{ padding: '12px 16px' }}><Badge variant={u.status === 'active' ? 'open' : 'disputed'}>{u.status}</Badge></td>
                <td style={{ padding: '12px 16px' }}><Mono>{new Date(u.created_at).toLocaleDateString()}</Mono></td>
                <td style={{ padding: '12px 16px' }}>
                  <Mono>{u.tasks} tasks · </Mono>
                  <Mono color="var(--accent)">{u.spent ? `$${u.spent} spent` : `$${u.earned} earned`}</Mono>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="ghost" size="sm" onClick={() => toast(`Viewing ${u.displayName}'s profile`, 'info')}>View</Btn>
                    <Btn variant={u.status === 'suspended' ? 'success' : 'danger'} size="sm" onClick={() => setBanModal(u)}>
                      {u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon="◈" message="No users match your search" />}
      </Card>

      <ConfirmModal open={!!banModal} onClose={() => setBanModal(null)} onConfirm={() => toggleBan(banModal)}
        title={banModal?.status === 'suspended' ? 'Reinstate User' : 'Suspend User'}
        confirmLabel={banModal?.status === 'suspended' ? 'Reinstate' : 'Suspend'}
        confirmVariant={banModal?.status === 'suspended' ? 'success' : 'danger'}
        message={banModal ? (banModal.status === 'suspended' ? `Reinstate ${banModal.displayName}'s account? They will regain access to the platform immediately.` : `Suspend ${banModal.displayName}'s account? They will lose access to the platform until reinstated.`) : ''} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: EARNER ONBOARDING (Stripe Connect)
// ═══════════════════════════════════════════════════════════════════════════════

function Onboarding({ setPage }) {
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ country: 'ZA', bank: '', accountNumber: '', routingNumber: '', ssn: '' })
  const [errors, setErrors] = useState({})

  const STEPS = ['Personal Info', 'Bank Account', 'Verification', 'Complete']

  function next() {
    const e = {}
    if (step === 1) {
      if (!form.bank.trim()) e.bank = 'Bank name is required'
      if (!form.accountNumber.trim()) e.accountNumber = 'Account number is required'
    }
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    if (step === 2) {
      setLoading(true)
      setTimeout(() => { setLoading(false); setStep(3) }, 1500)
    } else {
      setStep(s => s + 1)
    }
  }

  if (step === 3) return (
    <div className="page-enter" style={{ maxWidth: 560 }}>
      <Card hover={false} style={{ textAlign: 'center', padding: '48px 32px', border: '1px solid var(--success)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✓</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Stripe Connected!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>Your payout account is set up. You can now accept payments on tasks you complete.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Btn onClick={() => setPage('tasks-browse')}>Browse Tasks</Btn>
          <Btn variant="secondary" onClick={() => setPage('dashboard')}>Dashboard</Btn>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="page-enter" style={{ maxWidth: 560 }}>
      <PageTitle sub="Set up your payout account to receive earnings">Payout Setup</PageTitle>
      <StepBar steps={STEPS} current={step} />
      <Card hover={false}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 4 }}>
              <Mono size="0.7rem" color="var(--accent)" style={{ display: 'block', marginBottom: 8 }}>Powered by Stripe Connect</Mono>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>TaskFinder uses Stripe to securely process payouts. Your banking details are stored encrypted by Stripe — we never see your full account numbers.</p>
            </div>
            <SelectField label="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
              <option value="ZA">South Africa</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="NG">Nigeria</option>
              <option value="KE">Kenya</option>
            </SelectField>
            <Input label="Legal Full Name" placeholder="As it appears on your ID" />
            <Input label="Date of Birth" type="date" />
          </div>
        )}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="Bank Name" placeholder="e.g. First National Bank" value={form.bank} onChange={e => { setForm(f => ({ ...f, bank: e.target.value })); setErrors(v => ({ ...v, bank: null })) }} error={errors.bank} />
            <Input label="Account Number" placeholder="Your bank account number" value={form.accountNumber} onChange={e => { setForm(f => ({ ...f, accountNumber: e.target.value })); setErrors(v => ({ ...v, accountNumber: null })) }} error={errors.accountNumber} />
            <Input label="Branch Code / Routing Number" placeholder="6-digit branch code" value={form.routingNumber} onChange={e => setForm(f => ({ ...f, routingNumber: e.target.value }))} />
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <Mono color="var(--accent)" size="0.68rem" style={{ display: 'block', marginBottom: 6 }}>Identity Verification</Mono>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Stripe requires identity verification to comply with financial regulations. This is a one-time process.</p>
            </div>
            <Input label="ID / Passport Number" placeholder="Your government ID number" value={form.ssn} onChange={e => setForm(f => ({ ...f, ssn: e.target.value }))} />
            <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center' }}>
              <Mono style={{ display: 'block', marginBottom: 8 }}>Upload ID Document</Mono>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>Passport, national ID, or driver's licence</p>
              <Btn variant="secondary" size="sm" onClick={() => toast('File upload disabled in demo mode', 'info')}>Choose File</Btn>
            </div>
          </div>
        )}
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && <Btn variant="secondary" onClick={() => { setErrors({}); setStep(s => s - 1) }}>← Back</Btn>}
          <Btn variant="ghost" onClick={() => setPage('dashboard')}>Skip for Now</Btn>
        </div>
        <Btn loading={loading} onClick={next}>
          {step === 2 ? 'Submit for Verification' : 'Next →'}
        </Btn>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [user, setUser]   = useState(null)
  const [page, setPage]   = useState('dashboard')
  const [selectedTask,    setSelectedTask]    = useState(null)
  const [selectedDispute, setSelectedDispute] = useState(null)
  const [state, dispatch] = useReducer(appReducer, initialState)

  const unreadCount = state.notifications.filter(n => !n.is_read).length
  const authValue   = { user, logout: () => { setUser(null); setPage('dashboard') } }
  const storeValue  = { state, dispatch }

  if (!user) {
    return (
      <ToastProvider>
        <AuthCtx.Provider value={authValue}>
          <AuthScreen onLogin={u => setUser(u)} />
        </AuthCtx.Provider>
      </ToastProvider>
    )
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':            return <Dashboard setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'tasks-browse':         return <TaskBrowse setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'task-detail':          return <TaskDetail taskId={selectedTask} setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'tasks-new':            return <TaskNew setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'tasks-mine':           return <MyTasks setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'my-bids':              return <MyBids setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'suggestions':          return <Suggestions setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'messages':             return <Messages />
      case 'notifications':        return <Notifications setPage={setPage} setSelectedTask={setSelectedTask} />
      case 'profile':              return <Profile />
      case 'onboarding':           return <Onboarding setPage={setPage} />
      case 'admin-disputes':       return <AdminDisputes setPage={setPage} setSelectedDispute={setSelectedDispute} />
      case 'admin-dispute-detail': return <AdminDisputeDetail disputeId={selectedDispute} setPage={setPage} />
      case 'admin-users':          return <AdminUsers />
      default:                     return <Dashboard setPage={setPage} setSelectedTask={setSelectedTask} />
    }
  }

  return (
    <AuthCtx.Provider value={authValue}>
      <StoreCtx.Provider value={storeValue}>
        <ToastProvider>
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
            <Sidebar page={page} setPage={setPage} unreadCount={unreadCount} />
            <main style={{ overflowY: 'auto', padding: '40px 48px', minHeight: '100vh', background: 'var(--bg-base)' }}>
              {renderPage()}
            </main>
          </div>
        </ToastProvider>
      </StoreCtx.Provider>
    </AuthCtx.Provider>
  )
}
