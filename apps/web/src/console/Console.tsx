import { useEffect, useRef, useState } from 'react'
import { ActionButtons, DPad, Speaker, StartSelect } from './Controls'
import { VolumeSlider } from './VolumeSlider'
import { useFitScale } from './useFitScale'
import { ConsoleInputProvider } from './useConsoleInput'
import { useSound } from '../sound/SoundProvider'
import type { ReactNode, RefObject } from 'react'

/**
 * The console.
 *
 * ARCHITECTURE.md section 3, the one boundary that matters:
 *
 *   src/console/ must never know that this application is about money.
 *
 * It renders a shell, scales a screen, and emits input intents. That is all.
 * Enforced by lint, and it is what makes the metaphor honest rather than
 * decoration painted over a DeFi app.
 */

/**
 * The Monad logomark, stamped into the shell.
 *
 * Drawn as one path with an evenodd hole rather than two shapes, so the void
 * is genuinely a void and the plastic reads as moulded around it.
 *
 * The geometry is four cubics between the four extreme points, with the
 * control points pulled 35% of the way toward each corner. That constant is
 * the whole character of the shape: at 55% it becomes a circle and at 0% a
 * hard diamond. Symmetric halves keep the mark balanced at every display size.
 */
function MonadMark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M50 4C66 4 96 34 96 50C96 66 66 96 50 96C34 96 4 66 4 50C4 34 34 4 50 4ZM50 33C56 33 67 44 67 50C67 56 56 67 50 67C44 67 33 56 33 50C33 44 44 33 50 33Z"
          fill="#DDD7FE"
        />
      </svg>
    </span>
  )
}

/**
 * Shouts when a screen overruns its actual viewport.
 *
 * The landscape viewport is 480x320; portrait screens use native dimensions.
 * Both clip at the bezel, so overflow has to be caught on the rendered page,
 * not by jsdom, which performs no layout.
 *
 * Dev only, and deliberately a console warning rather than a rendered banner:
 * a banner would itself take screen height and change the thing it measures.
 */
function useOverflowWarning(viewport: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const el = viewport.current
    if (!el) return

    // After paint and after the webfont swap, because an 8px bitmap face
    // resolving late changes every line box on the screen.
    const check = () => {
      const over = el.scrollHeight - el.clientHeight
      if (over > 0) {
        console.warn(
          `[viewport] screen overruns by ${over}px and is being clipped. ` +
            `The ${el.clientWidth}x${el.clientHeight} screen has to reflow.`,
        )
      }
    }

    const frame = requestAnimationFrame(check)
    void document.fonts.ready.then(check)
    return () => cancelAnimationFrame(frame)
  })
}

/** Landscape on a short viewport makes the console unreadably small. */
function useNeedsRotate(): boolean {
  const [needs, setNeeds] = useState(false)

  useEffect(() => {
    const check = () => {
      const landscape = window.innerWidth > window.innerHeight
      setNeeds(landscape && window.innerHeight < 520)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return needs
}

/**
 * The moulded shell: lid, screen, hinge and controls, with no stage or fit.
 *
 * `Console` places it on the full-viewport desk; the landing page holds one
 * in its hero. One body, so the console a visitor meets is the console they
 * play on.
 */
export function ConsoleBody({
  children,
  wordmark,
  viewportRef,
  powered = true,
  tools,
}: {
  /** Screen contents, landscape or native portrait. */
  children: ReactNode
  wordmark: string
  viewportRef?: RefObject<HTMLDivElement | null>
  /** Power LED. Off only before a boot. */
  powered?: boolean
  /** Context tools supplied by the application; the shell does not interpret them. */
  tools?: ReactNode
}) {
  const { volume, setVolume } = useSound()
  return (
    <>
      <div className="lid">
        <i className="screw tl" />
        <i className="screw tr" />
        <i className="screw bl" />
        <i className="screw br" />
        <div className="bezel">
          {/* The ref is what makes useOverflowWarning able to fire at all.
              Without it the hook bailed on `!el` and the 320px guard was
              dead from the day it was written. */}
          <div className="viewport" ref={viewportRef}>
            {children}
          </div>
        </div>
        <div className="wordmark">{wordmark}</div>
      </div>

      <div className="hinge">
        <i className="cap" />
        <i className="bar" />
        <i className="cap" />
      </div>

      <div className="base">
        <i className="screw bl" />
        <i className="screw br" />

        <div className="toprow">
          <VolumeSlider value={volume} onChange={setVolume} />
          <MonadMark />
          <i className={powered ? 'led' : 'led is-off'} aria-hidden="true" />
          {tools && <div className="console-tools">{tools}</div>}
        </div>

        <div className="deck">
          <DPad />
          <div className="mid">
            <Speaker />
            <StartSelect />
          </div>
          <ActionButtons />
        </div>

      </div>
    </>
  )
}

export function Console({
  children,
  wordmark,
  backdrop,
  tools,
}: {
  /** Screen contents, landscape or native portrait. */
  children: ReactNode
  wordmark: string
  /** Decorative scenery, kept outside the money-agnostic shell. */
  backdrop?: ReactNode
  tools?: ReactNode
}) {
  const stage = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const scale = useFitScale(stage, box)
  const needsRotate = useNeedsRotate()
  useOverflowWarning(viewport)

  if (needsRotate) {
    return <div className="rotate-prompt">Rotate to portrait</div>
  }

  return (
    <ConsoleInputProvider>
      <div className="console-stage" ref={stage}>
        {backdrop}
        {/* translate before scale: the centring has to happen in the scaled
            frame, or a console at 0.6 would be centred on its unscaled size
            and sit off to one side. */}
        <div
          className="console"
          ref={box}
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <ConsoleBody wordmark={wordmark} viewportRef={viewport} tools={tools}>
            {children}
          </ConsoleBody>
        </div>
      </div>
    </ConsoleInputProvider>
  )
}
