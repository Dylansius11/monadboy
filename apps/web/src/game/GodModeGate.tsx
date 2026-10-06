/** Five deliberate letter choices confirm GOD MODE; the sellability check stays on. */
import { useEffect, useMemo, useState } from 'react'
import { useConsoleIntent } from '../console/useConsoleInput'
import { PixelText } from '../ui'

export interface GodModeGateProps {
  onConfirm: () => void
  onCancel: () => void
}


const WORD = ['I', 'K', 'N', 'O', 'W'] as const


const DECOYS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'J',
  'L',
  'M',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'X',
  'Y',
  'Z',
] as const


const PERMUTATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]


function candidatesFor(position: number): readonly [string, string, string] {
  const correct = WORD[position]
  const decoyA = DECOYS[(position * 7) % DECOYS.length]
  const decoyB = DECOYS[(position * 13 + 5) % DECOYS.length]
  const order = PERMUTATIONS[position % PERMUTATIONS.length]
  const items = [correct, decoyA, decoyB]
  return [items[order[0]], items[order[1]], items[order[2]]]
}


export function GodModeGate({ onConfirm, onCancel }: GodModeGateProps) {
  const [word, setWord] = useState<Array<string>>([])
  const [highlight, setHighlight] = useState(0)
  const [rejected, setRejected] = useState(false)

  const position = word.length
  const candidates = useMemo(() => candidatesFor(position), [position])

  // A fresh position always starts on slot 0. Carrying the previous highlight
  // forward would sometimes land on a decoy for free by inheriting whichever
  // slot the last correct pick happened to sit in.
  useEffect(() => setHighlight(0), [position])

  function attempt(letter: string) {
    if (letter !== WORD[position]) {
      // Rejected, not ignored: the position holds and the screen says so,
      // rather than the press quietly doing nothing and leaving the player
      // to guess whether it registered at all.
      setRejected(true)
      return
    }
    setRejected(false)
    const next = [...word, letter]
    if (next.length === WORD.length) {
      // The only thing that fires onConfirm. Five correct picks, never one.
      onConfirm()
      return
    }
    setWord(next)
  }

  useConsoleIntent((intent) => {
    if (intent === 'LEFT') {
      setHighlight((i) => (i + candidates.length - 1) % candidates.length)
      setRejected(false)
      return
    }
    if (intent === 'RIGHT') {
      setHighlight((i) => (i + 1) % candidates.length)
      setRejected(false)
      return
    }
    if (intent === 'A') {
      attempt(candidates[highlight])
      return
    }
    if (intent === 'B') {
      if (word.length === 0) {
        onCancel()
        return
      }
      setWord((w) => w.slice(0, -1))
      setRejected(false)
    }
  })

  const progress = WORD.map((_, i) => word[i] ?? '_').join(' ')

  return (
    
    <div className="godmode-gate bg-alarm flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
      
      <PixelText role="title" upper>
        {'†'}&nbsp;&nbsp;G O D&nbsp;&nbsp;M O D E&nbsp;&nbsp;{'†'}
      </PixelText>

      <div className="flex flex-col gap-1">
        <PixelText role="body">every filter is off.</PixelText>
        <PixelText role="body">no minimum liquidity. no minimum age.</PixelText>
        <PixelText role="body">no safety score. no ranking. no help.</PixelText>
      </div>

      <PixelText role="body">
        the only check left is whether you can sell.
      </PixelText>

      <div className="mt-2 flex flex-col items-center gap-1">
        <PixelText role="micro" upper>
          spell it: I K N O W
        </PixelText>
        <PixelText role="value" className="tabular-nums">
          &gt; {progress}
        </PixelText>

        
        <div className="mt-1 flex gap-2">
          {candidates.map((letter, index) => {
            const isHighlighted = index === highlight
            return (
              <button
                key={`${position}-${index}`}
                type="button"
                aria-pressed={isHighlighted}
                onClick={() => {
                  setHighlight(index)
                  attempt(letter)
                }}
                className={`pressable border-edge flex h-8 w-8 items-center justify-center border ${
                  isHighlighted ? 'bg-ink' : 'bg-loss'
                }`}
              >
                <PixelText role="value" tone="invert">
                  {letter}
                </PixelText>
              </button>
            )
          })}
        </div>

        {rejected ? (
          <PixelText role="micro" upper>
            not that one. try again.
          </PixelText>
        ) : null}
      </div>
    </div>
  )
}
