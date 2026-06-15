// Frontend smoke test (TD-10): proves the app module loads and renders the
// landing page for a logged-out visitor without crashing. A foothold for
// adding component tests as the UI is broken into smaller pieces.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App.jsx'

describe('App smoke test', () => {
  beforeEach(() => {
    localStorage.clear()           // no session → landing view
    window.history.pushState({}, '', '/')
  })

  it('renders the landing hero for a logged-out visitor', () => {
    render(<App />)
    expect(screen.getByText(/stress less/i)).toBeInTheDocument()
    expect(screen.getByText(/Live more/i)).toBeInTheDocument()
  })
})
