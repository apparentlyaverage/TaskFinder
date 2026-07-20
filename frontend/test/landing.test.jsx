// Landing render + auth-modal interaction (§7.7 expanded coverage).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../src/App.jsx'

describe('Landing page', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('shows the corporate hero with the search-form centerpiece', () => {
    render(<App />)
    expect(screen.getByText(/help around/i)).toBeInTheDocument()
    // The hero's centerpiece is the What + Where search form (Thumbtack grammar)
    expect(screen.getByPlaceholderText(/laundry pickup/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
  })

  it('opens an accessible auth modal from a sign-up button', () => {
    render(<App />)
    const cta = screen.getAllByRole('button', { name: /sign up|get started/i })[0]
    fireEvent.click(cta)
    // Modal mounts with the Google option (no network needed)
    expect(screen.getByText(/with Google/i)).toBeInTheDocument()
    // a11y: it's a labelled dialog with labelled fields (§7.7). Scope to the auth
    // modal by name — the page also renders the (non-modal) cookie-consent banner,
    // so a bare getByRole('dialog') is ambiguous.
    const dialog = screen.getByRole('dialog', { name: /create your account|sign in/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})
