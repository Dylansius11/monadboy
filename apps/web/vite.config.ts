import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Start's development style crawler resolves bare dependencies without their
// importer. Pin the SDK-only v2 wordlist export to its owning workspace rather
// than an unrelated ancestor installation of bip39 v1.
const sdkRequire = createRequire(
  new URL('../../packages/sdk/package.json', import.meta.url),
)

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@scure/bip39/wordlists/english.js': sdkRequire.resolve(
        '@scure/bip39/wordlists/english.js',
      ),
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
        server.middlewares.use(
          '/dev/passkey',
          async (_request, response, next) => {
            try {
              const html = await server.transformIndexHtml(
                '/dev/passkey',
                '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>MONADBOY device test</title></head><body><div id="passkey-spike"></div><script type="module" src="/src/dev/passkey.tsx"></script></body></html>',
              )
              response.setHeader('Content-Type', 'text/html')
              response.end(html)
            } catch (error) {
              next(error)
            }
          },
        )
      },
    },
    tailwindcss(),
    tanstackStart(),
    // Every page renders the same HTML for every visitor (card, disks and
    // positions load in the browser), so Vercel keeps each rendered page at
    // the edge until the next deployment instead of rendering it in iad1 on
    // every request.
    ...(process.env.VERCEL === '1'
      ? [nitro({ preset: 'vercel', routeRules: { '/**': { isr: true } } })]
      : []),
    viteReact(),
  ],
  server: {
    // Public hosting uses Nitro on Vercel, not the Vite development server.
    // Keep local preview reachable without accepting arbitrary tunnel hosts.
    allowedHosts: ['localhost', '127.0.0.1', 'monadboy-play.vercel.app'],
  },
})

export default config
