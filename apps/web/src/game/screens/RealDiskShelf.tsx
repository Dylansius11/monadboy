import { useEffect, useRef, useState } from 'react'
import { formatEther } from 'viem'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { getCardManager, useCardState } from '../../chain/card-store'
import { getShelfController } from '../../chain/shelf-store'
import { DISK_SLOTS } from '../../chain/card'
import { explorerAddressUrl } from '../../chain/config'
import { Panel, PixelText, Sprite, Value } from '../../ui'
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
  useConsoleIntent((intent) => {
    if (intent === 'B') { if (proof) setProof(false); else onBack() }
    else if (intent === 'START' && slot?.kind === 'disk') setProof((current) => !current)
    else if (intent === 'UP') setSelected((current) => Math.max(1, current - 1) as DiskSlot)
    else if (intent === 'DOWN') setSelected((current) => Math.min(3, current + 1) as DiskSlot)
    else if (intent === 'A' && !proof) activate()
  })
  return (
    <div className="screen-real-shelf bg-screen flex h-full w-full flex-col gap-2 p-2">
      <header className="flex items-baseline justify-between gap-2">
        <PixelText role="title" upper>Save disks</PixelText><PixelText role="micro" upper>Testnet</PixelText>
      </header>
      <div className="real-shelf-body flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {!held ? <Panel className="flex flex-col gap-1"><PixelText role="body" upper>No card in the slot</PixelText><PixelText as="p" role="micro">A: insert your memory card to read your three disks.</PixelText></Panel>
          : proof && slot?.kind === 'disk' ? (
            <Panel className="flex flex-col gap-2">
              <PixelText role="title">Onchain sealed disk</PixelText>
              <PixelText as="p" role="body">The hash proves the saved ciphertext. Private disk fields are decrypted only on this device.</PixelText>
              <code className="break-all text-micro">{slot.proof.sealedHash}</code>
              <a className="pressable min-h-11 text-body underline" href={slot.proof.explorerUrl} target="_blank" rel="noreferrer">Open disk account on explorer</a>
              <PixelText role="micro">Updated {new Date(slot.proof.updatedAt * 1000).toISOString()}</PixelText>
            </Panel>
          ) : state.status === 'ready' ? DISK_SLOTS.map((id) => {
            const entry = state.shelf?.slots[id]
            if (!entry) return null
            return <button key={id} type="button" className={`pressable real-shelf-row border-edge flex items-center gap-2 border text-left ${selected === id ? 'bg-accent text-ink-invert' : 'bg-panel'}`}
              ref={selected === id ? selectedRow : null}
              onClick={() => setSelected(id)} aria-pressed={selected === id}>
              {entry.kind === 'disk' && <Sprite character={entry.disk.difficulty === 'hard' ? 'mouch' : entry.disk.difficulty === 'normal' ? 'moyaki' : 'molandak'} animation="idle" size={32} />}
              <div className="real-shelf-information flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <PixelText role="body" tone={selected === id ? 'invert' : 'ink'} upper className="break-words">Disk {id}: {entry.kind === 'disk' ? entry.disk.name : entry.kind === 'empty' ? 'Empty slot' : 'Unreadable'}</PixelText>
                  {entry.kind === 'disk' && <PixelText role="micro" tone={selected === id ? 'invert' : 'dim'}>{entry.disk.runs} saved runs</PixelText>}
                </div>
                {entry.kind !== 'disk' && <PixelText role="micro" tone={selected === id ? 'invert' : 'ink'} className="break-words">{entry.kind === 'error' ? entry.error.text : 'A: create and save'}</PixelText>}
                <div className="font-pixel flex flex-wrap gap-x-1 text-micro">
                  <span>TESTNET MON</span><span className="break-all">{entry.balance === null ? 'not read' : formatEther(entry.balance)}</span>
                </div>
                {entry.kind === 'disk' && <div className="real-shelf-stats flex flex-wrap gap-x-3">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1"><PixelText role="micro" tone={selected === id ? 'invert' : 'ink'}>SCORE</PixelText><Value amount={entry.disk.bestScore} decimals={2} role="body" tone={selected === id ? 'invert' : 'ink'} className="break-all" /></span>
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1"><PixelText role="micro" tone={selected === id ? 'invert' : 'ink'}>DAMAGE</PixelText><Value amount={entry.disk.bestDamage} decimals={2} role="body" tone={selected === id ? 'invert' : 'loss'} className="break-all" /></span>
                </div>}
              </div>
            </button>
          }) : <Panel>{state.error?.text ?? 'Reading three disk accounts from testnet.'}</Panel>}
        {state.working && <PixelText role="body">{state.working.step === 'funding' ? 'Requesting testnet supply' : 'Sealing and saving'} disk {state.working.slot}.</PixelText>}
        {state.createError && <PixelText role="body" tone="loss">{state.createError.text}</PixelText>}
        {state.saved && <a className="text-body underline" href={state.saved.explorerUrl} target="_blank" rel="noreferrer">SAVED TO CARD. Open confirmed transaction.</a>}
      </div>
      {slot?.kind === 'disk' && !proof && <button type="button" className="pressable text-micro underline" onClick={() => setProof(true)}>START: OPEN proof</button>}
      {slot && !proof && <a className="text-micro underline" href={explorerAddressUrl(slot.address)} target="_blank" rel="noreferrer">Disk account {slot.address.slice(0, 6)}..{slot.address.slice(-4)}</a>}
      <footer className="screen-footer flex items-center justify-between gap-2">
        <button className="pressable min-h-11 text-micro" type="button" onClick={activate} disabled={held && !!state.working}>A {!held ? 'Insert card' : slot?.kind === 'disk' ? 'Open' : slot?.kind === 'empty' ? 'Create' : 'Retry'}</button>
        <button className="pressable min-h-11 text-micro" type="button" onClick={onBack}>B Back</button>
        {held && <button className="pressable min-h-11 text-micro" type="button" onClick={() => { getCardManager().eject(); onBack() }}>Eject</button>}
      </footer>
    </div>
  )
}
