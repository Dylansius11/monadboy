import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Start's development style crawler resolves bare dependencies without their
// importer. Pin the SDK-only v2 wordlist export to its owning workspace rather
// than an unrelated ancestor installation of bip39 v1.
const sdkRequire = createRequire(new URL('../../packages/sdk/package.json', import.meta.url))

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@scure/bip39/wordlists/english.js': sdkRequire.resolve('@scure/bip39/wordlists/english.js'),
    },
  },
  plugins: [
    // Console piping wraps console on both the client and the dev server and
    // rebroadcasts each side's output to the other, so a single warning
    // echoes back as a new warning and floods the browser console. Browser
    // and terminal logs stay where they were emitted.
    devtools({ consolePiping: { enabled: false } }),
    {
      name: 'disposable-passkey-device-spike',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/dev/passkey', async (_request, response, next) => {
          try {
            const html = await server.transformIndexHtml('/dev/passkey',
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>MONADBOY device test</title></head><body><div id="passkey-spike"></div><script type="module" src="/src/dev/passkey.tsx"></script></body></html>')
            response.setHeader('Content-Type', 'text/html')
            response.end(html)
          } catch (error) { next(error) }
        })
      },
    },
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    // Any host. This looks lax and is the correct setting for THIS project on
    // THIS day: the console is demoed through a tunnel, `cloudflared` mints a
    // fresh random hostname on every start, and an allowlist of yesterday's
    // hostnames serves a plain-text "Blocked request" page instead of the game.
    //
    // It is not only the dev server. `vite preview` inherits `server.allowedHosts`
    // and the built `dist/server/server.js` starts no listener of its own, so
    // preview is the only way to serve the production build and it is behind
    // this same setting. There is no third path to a shareable URL.
    //
    // The app holds no secrets and no user funds; the deployer key lives in an
    // environment variable and never reaches the client. Tighten this to the
    // real hostname the moment there is a permanent one.
    allowedHosts: true,
  },
})

export default config
