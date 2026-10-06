/** Fixtures are opt-in development data, never a production fallback. */
export const USE_FIXTURES = import.meta.env.MODE === 'test'
  || (import.meta.env.DEV && import.meta.env.VITE_USE_FIXTURES === 'true')
