// gateway/rateLimits.js
export const limiterConfigs = {
  login: {
    prefix: 'login',
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  register: {
    prefix: 'register',
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many accounts created. Please try again later.',
  },
  payments: {
    prefix: 'payments',
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many payment requests. Please slow down.',
  },
  messaging: {
    prefix: 'messaging',
    windowMs: 60 * 1000,
    max: 60,
    message: 'Sending too many messages. Please wait a moment.',
  },
  standard: {
    prefix: 'standard',
    windowMs: 60 * 1000,
    max: 120,
    message: 'Too many requests. Please slow down.',
  },
}
