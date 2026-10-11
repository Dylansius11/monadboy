import { useConsoleControls } from '../console/useConsoleInput'
import type { ConsoleIntent } from '../console/intents'

export type KeyHint = {
  /** The intent this hint fires. Directions are labels only and never dispatch. */
  key: ConsoleIntent | 'DPAD'
  label: string
  disabled?: boolean
}

const GLYPH: Record<KeyHint['key'], string> = {
  A: 'A',
  B: 'B',
  START: 'STA',
  SELECT: 'SEL',
  UP: '▲',
  DOWN: '▼',
  LEFT: '◄',
  RIGHT: '►',
  DPAD: '✚',
}

/**
 * The one control legend every screen uses: a single 20px strip, never a
 * second row of buttons. The handheld's own A/B/SELECT/START are the controls;
 * this only says what they do here. A tapped hint presses the same intent as
 * the hardware button, so a screen keeps exactly one handler per action.
 */
export function KeyHints({ hints, className = '' }: { hints: readonly KeyHint[]; className?: string }) {
  const { press, release } = useConsoleControls()
  return (
    <nav aria-label="Controls" className={`key-hints flex h-5 flex-none items-center gap-3 overflow-hidden whitespace-nowrap ${className}`}>
      {hints.map((hint) => {
        const glyph = <kbd className={`key-hint-glyph font-pixel bg-ink text-ink-invert inline-flex h-4 min-w-4 items-center justify-center px-1 text-[10px] leading-none ${hint.key === 'A' || hint.key === 'B' ? 'rounded-full' : 'rounded-sm'}`}>{GLYPH[hint.key]}</kbd>
        const text = <span className="font-pixel text-micro uppercase">{hint.label}</span>
        if (hint.key === 'DPAD' || hint.key === 'UP' || hint.key === 'DOWN' || hint.key === 'LEFT' || hint.key === 'RIGHT')
          return <span key={`${hint.key}-${hint.label}`} className="key-hint inline-flex items-center gap-1 text-ink-dim">{glyph}{text}</span>
        const intent = hint.key
        return (
          <button key={`${hint.key}-${hint.label}`} type="button" disabled={hint.disabled}
            className="key-hint pressable inline-flex items-center gap-1 text-ink disabled:opacity-40"
            onClick={() => { press(intent); release(intent) }}>
            {glyph}{text}
          </button>
        )
      })}
    </nav>
  )
}
