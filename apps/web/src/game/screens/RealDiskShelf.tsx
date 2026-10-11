import { useEffect, useRef, useState } from 'react'
import { formatEther } from 'viem'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { getCardManager, useCardState } from '../../chain/card-store'
import { getShelfController } from '../../chain/shelf-store'
import { DISK_SLOTS } from '../../chain/card'
import { explorerAddressUrl } from '../../chain/config'
import { KeyHints, Panel, PixelText, Sprite, Value } from '../../ui'
import type { DiskSlot } from '../../chain/card'
import type { SaveDisk } from '../../types/domain'

/** Registry reads, not fixture rows. A failed slot can never be overwritten as an empty disk. */
export function RealDiskShelf({ onOpen, onBack }: {
  onOpen: (disk: SaveDisk) => void
  onBack: () => void
}) {
  const card = useCardState()
  const shelf = getShelfController()
  const state = shelf.useShelf()
  const [selected, setSelected] = useState<DiskSlot>(1)
  const [proof, setProof] = useState(false)
  const selectedRow = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected, proof, state.status])
  useEffect(() => { if (card.phase === 'inserted') void shelf.refresh() }, [card.serial, card.phase, shelf])
  const slot = state.shelf?.slots[selected]
  const held = card.phase === 'inserted'
  function activate() {
    // The card screen is where a card goes in, so A takes the player there.
    if (!held) { onBack(); return }
    if (state.working) return
    if (slot?.kind === 'disk') onOpen(slot.disk)
    else if (slot?.kind === 'empty') void shelf.createDisk(selected)
    else void shelf.refresh()
  }
  function eject() {
    getCardManager().eject()
    onBack()
  }
  useConsoleIntent((intent) => {
    if (intent === 'B') { if (proof) setProof(false); else onBack() }
    else if (intent === 'START' && slot) setProof((current) => !current)
    else if (intent === 'SELECT' && held) eject()
    else if (intent === 'UP' && !proof) setSelected((current) => Math.max(1, current - 1) as DiskSlot)
    else if (intent === 'DOWN' && !proof) setSelected((current) => Math.min(3, current + 1) as DiskSlot)
    else if (intent === 'A' && !proof) activate()
  })
  return (
    <div className="screen-real-shelf bg-screen flex h-full w-full flex-col gap-2 p-2">
      <header className="flex items-baseline justify-between gap-2">
        <PixelText role="title" upper>Save disks</PixelText><PixelText role="micro" upper>Testnet</PixelText>
      </header>
      <div className="real-shelf-body flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {!held ? <Panel className="flex flex-col gap-1"><PixelText role="body" upper>No card in the slot</PixelText><PixelText as="p" role="micro">Insert your memory card to read your three disks.</PixelText></Panel>
          : proof && slot ? (
            <Panel className="flex flex-col gap-2">
              <PixelText role="title" upper>Disk {selected} {slot.kind === 'disk' ? 'proof' : 'account'}</PixelText>
              {slot.kind === 'disk' ? <>
                <PixelText as="p" role="body">The hash proves the saved ciphertext. Private disk fields are decrypted only on this device.</PixelText>
                <code className="break-all text-micro">{slot.proof.sealedHash}</code>
                <PixelText role="micro">Updated {new Date(slot.proof.updatedAt * 1000).toISOString()}</PixelText>
              </> : <PixelText as="p" role="body">{slot.kind === 'empty' ? 'Nothing is sealed in this slot yet. Its account holds the TESTNET MON shown on the shelf.' : slot.error.text}</PixelText>}
              <PixelText role="micro" className="break-all">TESTNET MON {slot.balance === null ? 'not read' : formatEther(slot.balance)} in {slot.address}</PixelText>
              <a className="pressable min-h-11 text-body underline" href={slot.kind === 'disk' ? slot.proof.explorerUrl : explorerAddressUrl(slot.address)} target="_blank" rel="noreferrer">Open disk account on explorer</a>
            </Panel>
          ) : state.status === 'ready' ? DISK_SLOTS.map((id) => {
            const entry = state.shelf?.slots[id]
            if (!entry) return null
            const on = selected === id
            return <button key={id} type="button" className={`pressable real-shelf-row border-edge flex items-center gap-2 border text-left ${on ? 'bg-accent text-ink-invert' : 'bg-panel'}`}
              ref={on ? selectedRow : null}
              onClick={() => setSelected(id)} aria-pressed={on}>
              {entry.kind === 'disk' && <Sprite character={entry.disk.difficulty === 'hard' ? 'mouch' : entry.disk.difficulty === 'normal' ? 'moyaki' : 'molandak'} animation="idle" size={32} />}
              <div className="real-shelf-information flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <PixelText role="body" tone={on ? 'invert' : 'ink'} upper className="break-words">Disk {id}: {entry.kind === 'disk' ? entry.disk.name : entry.kind === 'empty' ? 'Empty slot' : 'Unreadable'}</PixelText>
                  {entry.kind === 'disk' && <PixelText role="micro" tone={on ? 'invert' : 'dim'}>{entry.disk.runs} saved runs</PixelText>}
                </div>
                {entry.kind === 'error' && <PixelText role="micro" tone={on ? 'invert' : 'ink'} className="break-words">{entry.error.text}</PixelText>}
                <div className="font-pixel flex flex-wrap gap-x-1 text-micro">
                  <span>TESTNET MON</span><span className="break-all">{entry.balance === null ? 'not read' : formatEther(entry.balance)}</span>
                </div>
                {entry.kind === 'disk' && <div className="real-shelf-stats flex flex-wrap gap-x-3">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1"><PixelText role="micro" tone={on ? 'invert' : 'ink'}>SCORE</PixelText><Value amount={entry.disk.bestScore} decimals={2} role="body" tone={on ? 'invert' : 'ink'} className="break-all" /></span>
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1"><PixelText role="micro" tone={on ? 'invert' : 'ink'}>DAMAGE</PixelText><Value amount={entry.disk.bestDamage} decimals={2} role="body" tone={on ? 'invert' : 'loss'} className="break-all" /></span>
                </div>}
              </div>
            </button>
          }) : <Panel>{state.error?.text ?? 'Reading three disk accounts from testnet.'}</Panel>}
        {state.working && <PixelText role="body">{state.working.step === 'funding' ? 'Requesting testnet supply' : 'Sealing and saving'} disk {state.working.slot}.</PixelText>}
        {state.createError && <PixelText role="body" tone="loss">{state.createError.text}</PixelText>}
        {state.saved && <a className="text-body underline" href={state.saved.explorerUrl} target="_blank" rel="noreferrer">SAVED TO CARD. Open confirmed transaction.</a>}
      </div>
      <KeyHints hints={proof ? [
        { key: 'B', label: 'Close' },
        { key: 'START', label: 'Shelf' },
      ] : [
        { key: 'A', label: !held ? 'Insert card' : slot?.kind === 'disk' ? 'Open' : slot?.kind === 'empty' ? 'Create' : 'Retry', disabled: held && !!state.working },
        { key: 'B', label: 'Back' },
        ...(held ? [{ key: 'SELECT' as const, label: 'Eject' }] : []),
        ...(slot ? [{ key: 'START' as const, label: slot.kind === 'disk' ? 'Proof' : 'Account' }] : []),
      ]} />
    </div>
  )
}
