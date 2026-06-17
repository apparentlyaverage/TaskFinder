// Landing render + auth-modal interaction (§7.7 expanded coverage).
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../src/App.jsx'

describe('Landing page', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('shows the hero and primary CTAs', () => {
    render(<App />)
    expect(screen.getByText(/stress less/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Post a Task Free/i).length).toBeGreaterThan(0)
  })

  it('opens an accessible auth modal from a Get Started button', () => {
    render(<App />)
    const cta = screen.getAllByRole('button', { name: /get started/i })[0]
    fireEvent.click(cta)
    // Modal mounts with the Google option (no network needed)
    expect(screen.getByText(/with Google/i)).toBeInTheDocument()
    // a11y: it's a labelled dialog with labelled fields (§7.7)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})
