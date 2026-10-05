import { Link, createFileRoute } from '@tanstack/react-router'
import { brand } from '../config/brand'
import { daylight } from '../design/palette'

export const Route = createFileRoute('/')({ component: Home })

/** Entry to the console at its logical screen size and Daylight palette. */
function Home() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div
        className="border-edge bg-screen text-ink font-pixel grid border"
        style={{ width: 'var(--screen-w)', height: 'var(--screen-h)' }}
      >
        <div className="place-self-center text-center">
          <p className="text-title tracking-widest uppercase">
            {brand.CONSOLE_NAME}
          </p>
          <p className="text-body text-ink-dim mt-4 uppercase">
            {brand.CARTRIDGE_01}
          </p>
          <Link to="/card" className="text-body mt-8 block uppercase underline">
            Press to start
          </Link>
          <p className="text-micro text-ink-dim mt-4">
            480 x 320 · daylight · {Object.keys(daylight).length} tokens
          </p>
        </div>
      </div>
    </main>
  )
}
