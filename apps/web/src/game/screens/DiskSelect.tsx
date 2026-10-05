import { useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { brand, characters } from '../../config/brand'
import { diskNetUsd } from '../fixtures'
import { PixelText, Value } from '../../ui'
import type { CharacterId } from '../../config/brand'
import type { Difficulty, SaveDisk } from '../../types/domain'

const CHARACTER_BY_DIFFICULTY: Record<Difficulty, CharacterId> = {
  easy: 'molandak',
  normal: 'moyaki',
  hard: 'mouch',
}

const GOD_MODE_MARK = '†'

export interface DiskSelectProps {
  cardAddress: string | null
  disks: Array<SaveDisk>
  maxDisks: number
  onOpen: (diskId: number) => void
  onBack: () => void
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-2)}`
}

export function DiskSelect({
  cardAddress,
  disks,
  maxDisks,
  onOpen,
  onBack,
}: DiskSelectProps) {
  const [index, setIndex] = useState(0)

  useConsoleIntent((intent) => {
    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {
      if (index < disks.length) onOpen(disks[index].diskId)
      return
    }
    if (intent === 'UP' || intent === 'DOWN') {
      const next = intent === 'DOWN' ? index + 1 : index - 1
      if (next >= 0 && next < disks.length) setIndex(next)
    }
  })

  const emptySlots = Math.max(0, maxDisks - disks.length)

  return (
    <div className="bg-screen flex h-full w-full flex-col gap-1 p-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <PixelText role="title" upper>
            Select {brand.SAVE_UNIT}
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            Fixture
          </PixelText>
        </div>
        <PixelText role="micro" tone="dim" upper>
          {cardAddress
            ? `${brand.WALLET_UNIT} ${shortAddress(cardAddress)}`
            : `no ${brand.WALLET_UNIT}`}
        </PixelText>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {disks.map((disk, i) => (
          <DiskRow
            key={disk.diskId}
            disk={disk}
            slot={i + 1}
            focused={i === index}
            onOpen={() => {
              setIndex(i)
              onOpen(disk.diskId)
            }}
          />
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <EmptySlot key={`empty-${i}`} slot={disks.length + i + 1} />
        ))}
        {disks.length === 0 ? (
          <PixelText role="micro" tone="dim">
            this {brand.WALLET_UNIT.toLowerCase()} has no disks yet.
          </PixelText>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <PixelText role="micro" upper>
          Move cursor
        </PixelText>
        <PixelText role="micro" upper>
          A open
        </PixelText>
        <PixelText role="micro" upper>
          B back
        </PixelText>
      </div>
    </div>
  )
}

function DiskRow({
  disk,
  slot,
  focused,
  onOpen,
}: {
  disk: SaveDisk
  slot: number
  focused: boolean
  onOpen: () => void
}) {
  const character = characters[CHARACTER_BY_DIFFICULTY[disk.difficulty]]
  const net = diskNetUsd(disk)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={focused ? 'true' : undefined}
      className={`pressable border-edge flex min-h-0 flex-1 items-center gap-2 border px-1 text-left ${
        focused ? 'bg-sunk' : 'bg-panel'
      }`}
    >
      {focused ? (
        <span aria-hidden="true" className="bg-ink h-8 w-1 shrink-0" />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <PixelText role="micro" tone="dim" upper>
            Disk {slot}
          </PixelText>
          <PixelText role="body" upper className="truncate">
            {disk.name}
          </PixelText>
          <PixelText role="micro" tone="dim" upper className="ml-auto">
            {character.label}
          </PixelText>
        </div>
        <div className="flex items-baseline gap-2">
          {disk.runs === 0 ? (
            <PixelText role="body" tone="dim">
              --
            </PixelText>
          ) : (
            <>
              <Value amount={net} prefix="$" decimals={2} signed role="body" />
              <PixelText role="micro" tone="dim" upper>
                testnet
              </PixelText>
            </>
          )}
          <PixelText role="micro" tone="dim" upper>
            {disk.runs === 0
              ? 'never played'
              : `${disk.runs} run${disk.runs === 1 ? '' : 's'}`}
          </PixelText>
          <PixelText role="micro" tone="dim" className="ml-auto" upper>
            {disk.difficulty}
            {disk.godMode ? ` ${GOD_MODE_MARK} god mode` : ''}
          </PixelText>
        </div>
      </div>
    </button>
  )
}

function EmptySlot({ slot }: { slot: number }) {
  return (
    <div className="border-edge flex min-h-0 flex-1 items-center gap-2 border border-dashed px-1">
      <PixelText role="micro" tone="dim" upper>
        Disk {slot}
      </PixelText>
      <PixelText role="micro" tone="dim" upper>
        empty slot
      </PixelText>
      <PixelText role="micro" tone="dim" className="ml-auto">
        new disks arrive with the registry.
      </PixelText>
    </div>
  )
}
