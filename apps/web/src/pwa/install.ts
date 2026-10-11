/** Registers the worker that makes the console installable; it caches nothing (public/sw.js). */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.warn('Service worker not registered; the console still runs, without the offline screen.', error)
  })
}
