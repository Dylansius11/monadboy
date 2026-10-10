import { useEffect, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { PixelText, Sprite } from '../../ui'
import type { CharacterId } from '../../config/brand'
import './boot.css'

export interface BootProps {
  /** Jump to the last frame: a returning visit or reduced motion. */
  instant: boolean
  onStart: () => void
}

/**
 * Power on. The one screen with a sequence instead of a state, and it still
 * yields to the player: START or A starts at once, any other key skips to the
 * last frame. A boot that holds a player hostage is the oldest complaint in
 * handheld history.
 *
 * Stages, by time from mount:
 *   dark   0      the panel warms up from black
 *   logo   200    the wordmark steps down, eight discrete frames
 *   flash  840    one white frame as it lands; the street is under it
 *   cast   920    the three Monanimals hop in, 160 ms apart, windows light
 *   ready  1800   PRESS START
 */
const STAGES = ['dark', 'logo', 'flash', 'cast', 'ready'] as const
type Stage = (typeof STAGES)[number]
const AT_MS: Record<Exclude<Stage, 'dark'>, number> = {
  logo: 200,
  flash: 840,
  cast: 920,
  ready: 1800,
}
export const BOOT_MS = AT_MS.ready

/** sessionStorage flag: the boot has played once in this browser session. */
export const BOOTED_KEY = 'monadboy.booted'

const CAST: ReadonlyArray<CharacterId> = ['molandak', 'moyaki', 'mouch']
const HOP_STAGGER_MS = 160
/** Every lit window is on before the last Monanimal lands. */
const LIGHT_SPAN_MS = 640

/**
 * The street the cast stands on. Drawn wider than any screen it lands on and
 * centred, so a narrow portrait panel crops the edges instead of rescaling
 * the art. Every coordinate is an integer at 1:1, so nothing resamples.
 * Landscape shows the bottom 96px; a tall portrait panel also shows the
 * outlined towers behind, which is why the drawing is 176px high.
 */
const SKY_W = 640
const SKY_H = 176

interface Tower {
  x: number
  y: number
  w: number
  h: number
}

interface Pane {
  x: number
  y: number
  /** Lighting order, or -1 for a window that stays dark. */
  order: number
}

/**
 * A fixed seed: the same skyline on every boot and every machine, so the
 * title card is a drawing, not a dice roll.
 */
const SKYLINE = (() => {
  let seed = 20261013
  const pick = (n: number) => {
    seed = (seed * 16807) % 2147483647
    return seed % n
  }

  const haze: Array<Tower> = []
  for (let x = pick(4) * 4; x < SKY_W; ) {
    const w = 24 + pick(4) * 8
    const h = 104 + pick(9) * 8
    haze.push({ x, y: SKY_H - h, w, h })
    x += w + 4 + pick(4) * 4
  }

  const far: Array<Tower> = []
  for (let x = 0; x < SKY_W; ) {
    const w = 16 + pick(7) * 4
    const h = 48 + pick(11) * 4
    far.push({ x, y: SKY_H - h, w, h })
    x += w
  }

  const near: Array<Tower> = []
  const antennas: Array<Tower> = []
  const panes: Array<Pane> = []
  let lit = 0
  for (let x = pick(3) * 4; x < SKY_W; ) {
    const w = 24 + pick(4) * 8
    const h = 32 + pick(8) * 4
    const y = SKY_H - h
    near.push({ x, y, w, h })
    if (pick(3) === 0) antennas.push({ x: x + w / 2, y: y - 8, w: 1, h: 8 })
    for (let py = y + 8; py + 4 <= SKY_H - 8; py += 8) {
      for (let px = x + 6; px + 4 <= x + w - 6; px += 8) {
        panes.push({ x: px, y: py, order: pick(4) === 0 ? lit++ : -1 })
      }
    }
    x += w + 4 + pick(3) * 4
  }

  return { haze, far, near, antennas, panes, lit }
})()

export function Boot({ instant, onStart }: BootProps) {
  const [stage, setStage] = useState<Stage>(instant ? 'ready' : 'dark')

  useEffect(() => {
    // instant can arrive after hydration: the route only learns about a
    // return visit once sessionStorage is readable on the client
    if (instant) {
      setStage('ready')
      return
    }
    const timers = (Object.keys(AT_MS) as Array<keyof typeof AT_MS>).map((s) =>
      window.setTimeout(() => setStage(s), AT_MS[s]),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [instant])

  useConsoleIntent((intent) => {
    if (intent === 'START' || intent === 'A') {
      onStart()
      return
    }
    setStage('ready')
  })

  const reached = (s: Stage) => STAGES.indexOf(stage) >= STAGES.indexOf(s)
  const lighting = stage === 'cast'

  return (
    <div className="screen-boot bg-screen relative flex h-full w-full flex-col overflow-hidden">
      <div className="boot-title flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-3 pt-3">
        <div className={`flex flex-col items-center gap-2 ${reached('logo') ? '' : 'invisible'}`}>
          <PixelText
            role="hero"
            upper
            className={`boot-wordmark ${stage === 'logo' ? 'boot-drop' : ''}`}
          >
            {brand.CONSOLE_NAME}
          </PixelText>
          <PixelText
            role="micro"
            tone="invert"
            upper
            className={`boot-label bg-accent border-ink border ${reached('flash') ? '' : 'invisible'}`}
          >
            {brand.CARTRIDGE_01}
          </PixelText>
        </div>

        <div className="flex h-4 items-center">
          {stage === 'ready' && (
            <PixelText role="body" tone="invert" upper className="boot-label boot-blink bg-ink">
              Press start
            </PixelText>
          )}
        </div>
      </div>

      <div className={`boot-street relative h-24 w-full flex-none overflow-hidden ${reached('flash') ? '' : 'invisible'}`}>
        <svg
          className="boot-skyline"
          width={SKY_W}
          height={SKY_H}
          viewBox={`0 0 ${SKY_W} ${SKY_H}`}
          aria-hidden="true"
        >
          <g className="boot-haze">
            {SKYLINE.haze.map((t) => (
              <g key={`h${t.x}`}>
                <rect className="boot-haze-edge" x={t.x} y={t.y} width={t.w} height={t.h} />
                <rect className="boot-haze-wall" x={t.x + 1} y={t.y + 1} width={t.w - 2} height={t.h - 1} />
              </g>
            ))}
          </g>
          {SKYLINE.far.map((t) => (
            <rect key={`f${t.x}`} className="boot-far" x={t.x} y={t.y} width={t.w} height={t.h} />
          ))}
          {SKYLINE.antennas.map((t) => (
            <rect key={`a${t.x}`} className="boot-edge" x={t.x} y={t.y} width={t.w} height={t.h} />
          ))}
          {SKYLINE.near.map((t) => (
            <g key={`n${t.x}`}>
              <rect className="boot-edge" x={t.x} y={t.y} width={t.w} height={t.h} />
              <rect className="boot-wall" x={t.x + 1} y={t.y + 1} width={t.w - 2} height={t.h - 1} />
            </g>
          ))}
          {SKYLINE.panes.map((p) => {
            const on = p.order >= 0 && reached('cast')
            return (
              <rect
                key={`w${p.x},${p.y}`}
                className={on ? `boot-window-lit ${lighting ? 'boot-unlit' : ''}` : 'boot-window'}
                style={
                  on && lighting
                    ? { animationDuration: `${Math.round((p.order * LIGHT_SPAN_MS) / SKYLINE.lit)}ms` }
                    : undefined
                }
                x={p.x}
                y={p.y}
                width={4}
                height={4}
              />
            )
          })}
        </svg>

        <div
          className={`boot-cast absolute inset-x-0 bottom-0 flex items-end justify-center gap-6 ${
            reached('cast') ? '' : 'invisible'
          }`}
        >
          {CAST.map((character, i) => (
            <span
              key={character}
              className={lighting ? 'boot-hop' : 'inline-block'}
              style={lighting ? { animationDelay: `${i * HOP_STAGGER_MS}ms` } : undefined}
            >
              <Sprite character={character} animation={lighting ? 'jump' : 'idle'} />
            </span>
          ))}
        </div>
      </div>

      <div
        className={`boot-footer border-ink flex flex-none items-center justify-between gap-2 border-t-2 px-3 py-1 ${
          reached('flash') ? '' : 'invisible'
        }`}
      >
        <PixelText role="micro" tone="dim" upper>
          Testnet · no real money
        </PixelText>
        <PixelText role="micro" tone="dim" upper>
          Enter / start
        </PixelText>
      </div>

      {stage === 'dark' && <div className="bg-ink absolute inset-0 boot-warm" aria-hidden="true" />}
      {stage === 'flash' && <div className="absolute inset-0 bg-white" aria-hidden="true" />}
    </div>
  )
}
