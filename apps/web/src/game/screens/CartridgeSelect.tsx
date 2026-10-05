import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { PixelText } from '../../ui'
import type { Cartridge } from '../fixtures'
import type { SaveDisk } from '../../types/domain'

export interface CartridgeSelectProps {
  disk: SaveDisk | undefined
  cartridges: Array<Cartridge>
  onInsert: (cartridgeId: string) => void
  onBack: () => void
}

export function CartridgeSelect({
  disk,
  cartridges,
  onInsert,
  onBack,
}: CartridgeSelectProps) {
  const [index, setIndex] = useState(0)
  const current = cartridges[index]

  function activate(i: number) {
    setIndex(i)
    if (i < 0 || i >= cartridges.length) return
    if (!cartridges[i].locked) onInsert(cartridges[i].id)
  }

  useConsoleIntent((intent) => {
    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {
      if (index < cartridges.length && !current.locked) onInsert(current.id)
      return
    }
    if (intent === 'LEFT' || intent === 'RIGHT') {
      const next = intent === 'RIGHT' ? index + 1 : index - 1
      if (next >= 0 && next < cartridges.length) setIndex(next)
    }
  })

  return (
    <div className="bg-screen flex h-full w-full flex-col gap-1 p-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <PixelText role="title" upper>
            Select cartridge
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>
        <PixelText role="micro" tone="dim" upper>
          {disk ? `Disk ${disk.diskId}: ${disk.name}` : 'No disk'}
        </PixelText>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        {cartridges.map((cart, i) => (
          <CartridgeShell
            key={cart.id}
            cartridge={cart}
            index={i}
            selected={i === index}
            onActivate={activate}
          />
        ))}
      </div>

      <div className="border-edge bg-sunk flex h-10 shrink-0 flex-col justify-center border p-1">
        <PixelText role="body">
          {current.tagline ?? 'locked. COMING SOON.'}
        </PixelText>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <PixelText role="micro" upper>
          {'◄►'} Select
        </PixelText>
        <PixelText role="micro" upper>
          A Insert
        </PixelText>
        <PixelText role="micro" upper>
          B Back
        </PixelText>
      </div>
    </div>
  )
}

function CartridgeShell({
  cartridge,
  index,
  selected,
  onActivate,
}: {
  cartridge: Cartridge
  index: number
  selected: boolean
  onActivate: (index: number) => void
}) {
  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      className="pressable flex min-h-0 flex-1 flex-col items-stretch gap-1"
      onClick={() => onActivate(index)}
    >
      <div
        className={`border-edge flex min-h-0 flex-1 flex-col items-center justify-center gap-1 border-2 p-1 ${
          cartridge.locked ? 'bg-panel border-dashed' : 'bg-panel shadow-hard'
        }`}
        style={{ minHeight: 120 }}
      >
        {cartridge.locked ? (
          <>
            <PixelText role="value" tone="dim">
              ???
            </PixelText>
            <PixelText role="micro" tone="dim" upper>
              Locked
            </PixelText>
          </>
        ) : (
          <>
            <span className="bg-ink h-1 w-full" aria-hidden="true" />
            <PixelText role="body" tone="ink" upper className="text-center">
              {cartridge.title}
            </PixelText>
            <span className="bg-ink h-1 w-full" aria-hidden="true" />
          </>
        )}
      </div>
      <div className={`shrink-0 px-1 ${selected ? 'bg-accent' : ''}`}>
        <PixelText role="micro" tone={selected ? 'invert' : 'dim'} upper>
          {`Cart ${String(index + 1).padStart(2, '0')}`}
        </PixelText>
      </div>
    </button>
  )
}
