import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { recoverMessageAddress, zeroAddress } from 'viem'
import { openDisk, sealDisk } from '@monadboy/sdk'
import { createCardManager } from '../chain/card-session'
import { createCredentialStore } from '../chain/credential-store'
import { assertOrigin } from '../chain/config'
import { cardErrorCopy } from '../chain/errors'
import { newDiskPlaintext } from '../chain/disk-plaintext'
import { createMeraBackend } from '../chain/mera-backend'
import { brand } from '../config/brand'
import type { CardState } from '../chain/card-session'
import type { MetadataStorage } from '../chain/credential-store'

// Served only by Vite's development middleware. This is not part of the application route graph.
const rp = { id: location.hostname, name: `${brand.CONSOLE_NAME} device test` }
const values = new Map<string, string>()
const metadata: MetadataStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => { values.set(key, value) },
  removeItem: (key) => { values.delete(key) },
}
const card = createCardManager({
  backend: async () => createMeraBackend(),
  relyingParty: () => { assertOrigin(rp.id, location); return rp },
  credentials: createCredentialStore(() => metadata),
  user: () => ({ name: 'Disposable device test', displayName: 'Disposable MONADBOY card' }),
  visibility: { hidden: () => document.hidden, subscribe: (listener) => {
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  } },
})

function PasskeySpike() {
  const [state, setState] = useState<CardState>(card.getState())
  const [result, setResult] = useState('No ceremony has run.')
  const [busy, setBusy] = useState(false)
  useEffect(() => card.subscribe(() => setState(card.getState())), [])
  async function ceremony(create: boolean) {
    setBusy(true)
    try {
      if (create) await card.create(); else await card.insert()
      setResult('Card read. Verify signatures and seal next.')
    } catch (error) { setResult(cardErrorCopy(error).text) }
    finally { setBusy(false) }
  }
  async function verify() {
    setBusy(true)
    try {
      const lease = card.lease(1)
      const message = 'MONADBOY disposable device proof. No transaction.'
      const signature = await lease.account.signMessage({ message })
      const signer = await recoverMessageAddress({ message, signature })
      lease.assertLive()
      if (signer.toLowerCase() !== lease.address.toLowerCase()) throw new Error('Signature does not match disk 1')
      const plaintext = newDiskPlaintext(1)
      // No deployment is claimed. AAD here deliberately uses a dev-only zero registry for local crypto proof.
      const aad = { chainId: 10143, registry: zeroAddress, disk: lease.address }
      const sealed = await sealDisk(lease.sealKey, plaintext, aad)
      const opened = await openDisk(lease.sealKey, sealed, aad)
      lease.assertLive()
      if (opened.name !== plaintext.name || lease.sealKey.extractable) throw new Error('Seal round trip failed')
      setResult('VERIFIED: disk 1 signature matches; local authenticated seal/open matches; seal key is non-extractable. No transaction sent.')
    } catch (error) { setResult(error instanceof Error ? error.message : 'Verification failed') }
    finally { setBusy(false) }
  }
  return <main style={{ maxWidth: 640, margin: 'auto', padding: 24, fontFamily: 'monospace', lineHeight: 1.5 }}>
    <h1>{brand.CONSOLE_NAME}: device test</h1>
    <p>DISPOSABLE TESTNET TEST. This hostname is not the production card domain. No funds or chain transactions.</p>
    <p>Relying party: <strong>{rp.id}</strong>. Secure context: {String(isSecureContext)}.</p>
    <p>Create once, verify, note the public disk addresses, eject, clear credential hints, then INSERT on the same hostname. The same three addresses must return.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button style={{ minHeight: 44 }} disabled={busy} onClick={() => void ceremony(true)}>NEW disposable card</button>
      <button style={{ minHeight: 44 }} disabled={busy} onClick={() => void ceremony(false)}>INSERT existing card</button>
      <button style={{ minHeight: 44 }} disabled={busy || state.phase !== 'inserted'} onClick={() => void verify()}>Verify signature + seal</button>
      <button style={{ minHeight: 44 }} onClick={() => { card.eject(); values.clear(); setResult('Ejected; credential hints cleared. INSERT can discover the same passkey.') }}>EJECT + clear hints</button>
    </div>
    <p role="status">{state.phase}: {result}</p>
    {state.disks && <ul>{([1, 2, 3] as const).map((slot) => <li key={slot} style={{ overflowWrap: 'anywhere' }}>Disk {slot}: {state.disks?.[slot]}</li>)}</ul>}
    <p>Record browser, device, authenticator and observed result. Never record PRF bytes, private keys or passkey secrets.</p>
    <a href="/play">Return to the console</a>
  </main>
}

const root = document.getElementById('passkey-spike')
if (root) createRoot(root).render(<PasskeySpike />)
