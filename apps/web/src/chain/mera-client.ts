import { createClientOnlyFn } from '@tanstack/react-start'
import type { CardBackend } from './card'

/**
 * The client-only boundary for the authenticator.
 *
 * `createClientOnlyFn` makes this function throw on the server, and the
 * dynamic import keeps the Mera, WebAuthn and signing code out of the server
 * bundle and out of every route's static imports. Nothing here evaluates
 * `navigator` or `crypto`; that happens only inside a ceremony, which only a
 * button press starts.
 */
export const loadMeraBackend = createClientOnlyFn(async (): Promise<CardBackend> => {
  const { createMeraBackend } = await import('./mera-backend')
  return createMeraBackend()
})
