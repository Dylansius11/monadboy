import { useEffect } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'
import { brand } from '../config/brand'
import { SoundProvider } from '../sound/SoundProvider'
import { registerServiceWorker } from '../pwa/install'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const OG_IMAGE = 'https://monadboy-play.vercel.app/og-image.png'
const OG_DESCRIPTION =
  'Market making, played like a pocket game. Real Kuru orders on Monad TESTNET.'

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { name: 'theme-color', content: '#6e54ff' },
      {
        title: `${brand.CONSOLE_NAME} · ${brand.CARTRIDGE_01}`,
      },
      { name: 'description', content: OG_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: brand.CONSOLE_NAME },
      { property: 'og:title', content: brand.CONSOLE_NAME },
      { property: 'og:description', content: OG_DESCRIPTION },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: brand.CONSOLE_NAME },
      { name: 'twitter:description', content: OG_DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', type: 'image/png', href: '/favicon-32.png', sizes: '32x32' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    ],
  }),
  component: RootApp,
  shellComponent: RootDocument,
})

function RootApp() {
  // production builds only, so a development origin never keeps a worker
  // registered between sessions
  useEffect(() => {
    if (import.meta.env.PROD) registerServiceWorker()
  }, [])
  return <SoundProvider><Outlet /></SoundProvider>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
