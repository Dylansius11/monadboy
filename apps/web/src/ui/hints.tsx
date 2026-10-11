import { useConsoleControls } from '../console/useConsoleInput'
import type { ConsoleIntent } from '../console/intents'

export type KeyHint = {
  /** The intent this hint fires. Directions are labels only and never dispatch. */
  key: ConsoleIntent | 'DPAD'
  label: string
  disabled?: boolean
}

/** Every glyph here is in the shipped Departure Mono file; the D-pad is drawn. */
const GLYPH: Record<Exclude<KeyHint['key'], 'DPAD'>, string> = {
  A: 'A',
  B: 'B',
  START: 'STA',
  SELECT: 'SEL',
  UP: '▲',
  DOWN: '▼',
  LEFT: '◄',
  RIGHT: '►',
}

const LABEL_ONLY: Partial<Record<KeyHint['key'], true>> = { DPAD: true, UP: true, DOWN: true, LEFT: true, RIGHT: true }

/** A stepped plus: the font has no cross glyph, and a tofu box is not a D-pad. */
function DpadGlyph() {
  return (
    <svg viewBox="0 0 9 9" width={9} height={9} aria-hidden="true" shapeRendering="crispEdges">
      <path d="M3 0h3v3h3v3H6v3H3V6H0V3h3z" fill="currentColor" />
    </svg>
  )
}

/**
 * The one control legend every screen uses: a single 20px strip, never a
 * second row of buttons. The handheld's own A/B/SELECT/START are the controls;
 * this only says what they do here. A tapped hint presses the same intent as
 * the hardware button, so a screen keeps exactly one handler per action.
 *
 * The strip draws 20px; each tappable hint reaches 8px above and below it
 * through a transparent pseudo-element, so a thumb still finds it.
 */
export function KeyHints({ hints, className = '' }: { hints: readonly KeyHint[]; className?: string }) {
  const { press, release } = useConsoleControls()
  return (
    <nav aria-label="Controls" className={`key-hints flex h-5 min-w-0 flex-none items-center justify-between gap-2 whitespace-nowrap ${className}`}>
      {hints.map((hint) => {
        const glyph = (
          <kbd aria-hidden="true" className={`key-hint-glyph font-pixel text-micro bg-ink text-ink-invert inline-flex h-4 min-w-4 items-center justify-center px-1 leading-none ${hint.key === 'A' || hint.key === 'B' ? 'rounded-full' : 'rounded-sm'}`}>
            {hint.key === 'DPAD' ? <DpadGlyph /> : GLYPH[hint.key]}
          </kbd>
        )
        const text = <span className="font-pixel text-micro uppercase">{hint.label}</span>
        if (LABEL_ONLY[hint.key])
          return <span key={`${hint.key}-${hint.label}`} className="key-hint inline-flex items-center gap-1 text-ink-dim">{glyph}{text}</span>
        const intent = hint.key as ConsoleIntent
        return (
          <button key={`${hint.key}-${hint.label}`} type="button" disabled={hint.disabled} aria-label={`${intent} ${hint.label}`}
            className="key-hint pressable relative inline-flex items-center gap-1 text-ink before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] disabled:opacity-40"
            // The console listens on window; a focused hint must not also fire
            // the keyboard's own intent for Enter or Space.
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
            onClick={() => { press(intent); release(intent) }}>
            {glyph}{text}
          </button>
        )
      })}
    </nav>
  )
}
