import { useEffect, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { PixelText, Sprite } from '../../ui'
import type { CharacterId } from '../../config/brand'

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
 *   logo   240    the wordmark steps down, eight discrete frames
 *   flash  1240   one white frame as it lands
 *   cast   1320   the three Monanimals hop in, 120 ms apart
 *   ready  2200   PRESS START
 */
const STAGES = ['dark', 'logo', 'flash', 'cast', 'ready'] as const
type Stage = (typeof STAGES)[number]
const AT_MS: Record<Exclude<Stage, 'dark'>, number> = {
  logo: 240,
  flash: 1240,
  cast: 1320,
  ready: 2200,
}
export const BOOT_MS = AT_MS.ready

/** sessionStorage flag: the boot has played once in this browser session. */
export const BOOTED_KEY = 'monadboy.booted'

const CAST: ReadonlyArray<CharacterId> = ['molandak', 'moyaki', 'mouch']

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

  return (
    <div className="screen-boot bg-screen relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden">
      <div className={`flex flex-col items-center gap-1 ${reached('logo') ? '' : 'invisible'}`}>
        <PixelText
          role="hero"
          upper
          className={`boot-wordmark tracking-[0.2em] ${stage === 'logo' ? 'boot-drop' : ''}`}
        >
          {brand.CONSOLE_NAME}
        </PixelText>
        <PixelText
          role="micro"
          tone="dim"
          upper
          className={`tracking-[0.3em] ${reached('flash') ? '' : 'invisible'}`}
        >
          {brand.CARTRIDGE_01}
        </PixelText>
      </div>

      <div className={`boot-cast flex gap-6 ${reached('cast') ? '' : 'invisible'}`}>
        {CAST.map((character, i) => (
          <span
            key={character}
            className={stage === 'cast' ? 'boot-pop' : ''}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <Sprite character={character} animation={stage === 'cast' ? 'jump' : 'idle'} />
          </span>
        ))}
      </div>

      {stage === 'ready' && (
        <PixelText role="body" tone="invert" upper className="boot-blink bg-ink px-2 tracking-[0.2em]">
          Press start
        </PixelText>
      )}

      {stage === 'ready' && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-3 pb-2">
          <PixelText role="micro" tone="dim" upper>
            Testnet · no real money
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            Enter / start
          </PixelText>
        </div>
      )}

      {stage === 'dark' && <div className="bg-ink absolute inset-0 boot-warm" aria-hidden="true" />}
      {stage === 'flash' && <div className="absolute inset-0 bg-white" aria-hidden="true" />}
    </div>
  )
}
