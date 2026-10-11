/*
  The console's service worker.

  It exists for two things: so the console installs as an app, and so a launch
  with no network shows the console's own NO SIGNAL screen instead of the
  browser's error page.

  It caches nothing. Every page, script, chain read and worker call goes to the
  network exactly as it would without it, so a deploy is live on the next load
  and no stale screen or number can ever be served from here. Only page
  navigations pass through it, and only to catch a failed one.
*/

const OFFLINE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#6e54ff">
<title>MONADBOY · NO SIGNAL</title>
<style>
  @font-face { font-family: 'Departure Mono'; src: url('/fonts/DepartureMono-Regular.woff2') format('woff2'); }
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    background: #0e091c; color: #e4dfff; text-align: center;
    font-family: 'Departure Mono', ui-monospace, monospace; -webkit-font-smoothing: none;
  }
  main { display: grid; justify-items: center; gap: 16px; max-width: 32ch; }
  .mark { font-size: 11px; letter-spacing: 0.32em; color: #9c89ff; }
  h1 { margin: 0; font-size: 33px; font-weight: 400; letter-spacing: 0.04em; color: #f4f1ff; text-shadow: 0 3px 0 #2a1f6a; }
  p { margin: 0; font-size: 16px; line-height: 1.5; color: #c9bfff; }
  button {
    min-height: 48px; margin-top: 8px; padding: 0 24px; border: 0; border-radius: 999px;
    background: #e4dfff; color: #0e091c; font: inherit; font-size: 16px; letter-spacing: 0.12em;
    box-shadow: 0 4px 0 #3a2a9e; cursor: pointer;
  }
  button:active { transform: translateY(3px); box-shadow: 0 1px 0 #3a2a9e; }
</style>
</head>
<body>
<main>
  <span class="mark">MONADBOY</span>
  <h1>NO SIGNAL</h1>
  <p>The console needs the network. Your card, disks and positions live on Monad testnet, so nothing runs offline.</p>
  <button type="button" onclick="location.reload()">RETRY</button>
</main>
</body>
</html>`

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // the page request starts while the worker boots, so passing through
      // costs no extra round trip
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse
        if (preloaded) return preloaded
        return await fetch(event.request)
      } catch {
        return new Response(OFFLINE, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      }
    })(),
  )
})
