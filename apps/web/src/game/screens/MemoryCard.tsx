import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand } from '../../config/brand'
import { PixelText } from '../../ui'

export interface MemoryCardProps {
  cardAddress: string | null
  onInsert: () => void
  onBack: () => void
}

const METHODS = ['INSERT CARD', 'NEW CARD'] as const

const REASSURANCES = ['passkey', 'no extension', 'free'] as const

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-2)}`
}

export function MemoryCard({ cardAddress, onInsert, onBack }: MemoryCardProps) {
  const [index, setIndex] = useState(0)
  const inserted = cardAddress !== null
  const cursor = inserted ? 0 : index

  useConsoleIntent((intent) => {
    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {
      onInsert()
      return
    }
    if (intent === 'UP' || intent === 'DOWN') {
      const next = intent === 'DOWN' ? cursor + 1 : cursor - 1
      if (next >= 0 && next < (inserted ? 1 : METHODS.length)) setIndex(next)
    }
  })

  return (
    <div className="bg-screen flex h-full w-full flex-col gap-1 p-2">
      <CardArt inserted={inserted} />

      <div className="flex flex-col items-center">
        <div className="flex items-baseline gap-2">
          <PixelText role="title" upper>
            {inserted
              ? `${brand.WALLET_UNIT} in`
              : `Insert ${brand.WALLET_UNIT}`}
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>
        <PixelText role="micro" tone="dim">
          {inserted
            ? `saved on card ${shortAddress(cardAddress)}`
            : 'your progress is saved on the card'}
        </PixelText>
      </div>

      <div className="flex flex-col gap-1">
        {METHODS.map((method, i) => (
          <MethodRow
            key={method}
            label={inserted && i === 0 ? 'Continue' : method}
            focused={i === cursor}
            hidden={inserted && i === 1}
            onSelect={() => {
              setIndex(i)
              onInsert()
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        {REASSURANCES.map((fact) => (
          <span key={fact} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="border-edge bg-panel inline-block h-2 w-2 border"
            />
            <PixelText role="micro" tone="dim" upper>
              {fact}
            </PixelText>
          </span>
        ))}
      </div>
    </div>
  )
}

function CardArt({ inserted }: { inserted: boolean }) {
  return (
    <div
      className="border-edge bg-sunk relative flex min-h-0 flex-1 items-center justify-center overflow-hidden border"
      style={{ minHeight: 96 }}
    >
      <div
        className="bg-ink absolute inset-x-0 bottom-0 h-1"
        aria-hidden="true"
      />

      <div className="card-insert">
        <div
          className="border-edge bg-panel shadow-hard flex items-center gap-2 border-2 px-3 py-2"
          role="img"
          aria-label={
            inserted
              ? `${brand.WALLET_UNIT} inserted`
              : `${brand.WALLET_UNIT} ready to insert`
          }
        >
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="bg-accent h-6 w-1" />
            ))}
          </span>
          <div className="flex flex-col">
            <PixelText role="body" upper>
              {brand.WALLET_UNIT}
            </PixelText>
            <PixelText role="micro" tone="dim" upper>
              {brand.CONSOLE_NAME}
            </PixelText>
          </div>
        </div>
      </div>
    </div>
  )
}

function MethodRow({
  label,
  focused,
  hidden,
  onSelect,
}: {
  label: string
  focused: boolean
  hidden: boolean
  onSelect: () => void
}) {
  if (hidden) return null

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={focused ? 'true' : undefined}
      className={`pressable border-edge flex items-center gap-2 border px-2 py-1 ${
        focused ? 'bg-accent' : 'bg-panel'
      }`}
    >
      {focused ? (
        <span aria-hidden="true" className="bg-ink-invert h-4 w-1 shrink-0" />
      ) : null}
      <PixelText role="body" tone={focused ? 'invert' : 'ink'} upper>
        {label}
      </PixelText>
    </button>
  )
}
