// ErrorBoundary.jsx — catches unhandled render errors so an exception shows a
// recoverable screen instead of a blank white page (the "whitescreen bug").
//
// Colours are hard-coded (not design tokens) on purpose: if the crash happened
// before App mounted its <style> block, CSS variables wouldn't resolve — the
// fallback must stand on its own.
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Best-effort breadcrumb for debugging; never throws.
    try { console.error('[ReLivR] Unhandled render error:', error, info?.componentStack) } catch { /* noop */ }
  }

  render() {
    if (!this.state.error) return this.props.children

    const wrap = {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: '#faf8fe',
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    }
    const card = {
      maxWidth: 440, width: '100%', background: '#ffffff', border: '1px solid #e7e0f0',
      borderRadius: 16, padding: '32px 28px', textAlign: 'center',
      boxShadow: '0 16px 40px rgba(19,17,24,.10)',
    }
    const btn = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
      fontWeight: 700, fontSize: '.9rem', fontFamily: 'inherit',
    }
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ width: 52, height: 52, margin: '0 auto 18px', borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#131118', letterSpacing: '-.01em' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 22px', fontSize: '.92rem', lineHeight: 1.6, color: '#575163' }}>
            ReLivR hit an unexpected error and couldn't finish loading this screen. Your data is safe — reloading usually fixes it.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={{ ...btn, background: '#7e22ce', color: '#fff' }} onClick={() => window.location.reload()}>Reload the page</button>
            <button style={{ ...btn, background: 'transparent', color: '#131118', border: '1px solid #d3cae3' }} onClick={() => { window.location.href = '/' }}>Go home</button>
          </div>
        </div>
      </div>
    )
  }
}
