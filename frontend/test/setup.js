import '@testing-library/jest-dom'

// jsdom doesn't implement these browser APIs the app touches. Stub them so a
// render is hermetic (no real network, no layout APIs).
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false },
  })
}
window.scrollTo = window.scrollTo || (() => {})
if (!('IntersectionObserver' in window)) {
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
}
// Default fetch → graceful "unavailable" so data hooks fall back to their
// offline defaults instead of hitting the network during tests.
global.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
