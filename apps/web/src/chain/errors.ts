import { brand } from '../config/brand'

/**
 * Everything that can stop a card or disk action, as one closed set.
 *
 * Two families live here. The Mera family is the library's own stable
 * `error.code`, passed through untouched so a screen can print the exact code
 * a developer can search for. The rest are this app's: configuration that has
 * not been supplied, chain state that is not what the console needs, and
 * lifecycle races. None of them is a message to parse. Branch on `code`.
 */
export type MeraCode =
  | 'PASSKEY_OPERATION_FAILED'
  | 'CRYPTO_UNAVAILABLE'
  | 'PRF_UNAVAILABLE'
  | 'SESSION_ENDED'
  | 'DECRYPT_FAILED'
  | 'INPUT_INVALID'
  | 'VAULT_FORMAT_INVALID'

export type CardErrorCode =
  | 'RP_ID_MISSING'
  | 'RP_ID_INVALID'
  | 'RP_ID_MISMATCH'
  | 'INSECURE_ORIGIN'
  | 'CARD_BUSY'
  | 'CARD_EJECTED'
  | 'CARD_EXPIRED'
  | 'CEREMONY_CANCELLED'
  | 'CARD_MISMATCH'
  | 'REGISTRY_UNCONFIGURED'
  | 'REGISTRY_INVALID'
  | 'REGISTRY_NO_CODE'
  | 'WRONG_CHAIN'
  | 'REGISTRY_READ_FAILED'
  | 'DISK_UNREADABLE'
  | 'DISK_EXISTS'
  | 'WORKER_UNCONFIGURED'
  | 'DRIP_REFUSED'
  | 'NOT_FUNDED'
  | 'SAVE_COST_FAILED'
  | 'SAVE_FAILED'
  | 'SAVE_REVERTED'
  | 'SAVE_UNCONFIRMED'

export class CardError extends Error {
  readonly code: CardErrorCode
  /** Machine-readable extra, e.g. the worker's refusal status. Never a secret. */
  readonly detail: string | undefined

  constructor(code: CardErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail ? `${code}: ${detail}` : code, options)
    this.name = 'CardError'
    this.code = code
    this.detail = detail
  }
}

export function isCardError(error: unknown): error is CardError {
  return error instanceof CardError
}

const MERA_CODES: Record<MeraCode, true> = {
  PASSKEY_OPERATION_FAILED: true,
  CRYPTO_UNAVAILABLE: true,
  PRF_UNAVAILABLE: true,
  SESSION_ENDED: true,
  DECRYPT_FAILED: true,
  INPUT_INVALID: true,
  VAULT_FORMAT_INVALID: true,
}

/**
 * The Mera code of an error, or null.
 *
 * Duck typed on the class name rather than `isMeraError`, on purpose: this
 * file is imported by the screens, and importing `@category-labs/mera` here
 * would pull the WebAuthn package into the server bundle and every route. The
 * name and the code are the library's own stable contract (errors.js sets
 * `name = "MeraError"`), and the code set is closed above.
 */
export function meraCodeOf(error: unknown): MeraCode | null {
  if (!(error instanceof Error) || error.name !== 'MeraError') return null
  const code = (error as Error & { code?: unknown }).code
  return typeof code === 'string' && Object.hasOwn(MERA_CODES, code) ? (code as MeraCode) : null
}

/** Copy for the console. Brand tokens, no em-dashes, none of the S1 forbidden words. */
export interface ErrorCopy {
  /** The stable code, shown small so a failure can be reported precisely. */
  code: MeraCode | CardErrorCode | 'UNKNOWN'
  text: string
}

const CARD_NOT_READ = 'CARD NOT READ. TRY AGAIN.'
const SECURE = 'CARD READER NEEDS A SECURE CONNECTION.'
const EJECTED = 'CARD EJECTED. INSERT CARD AGAIN.'

const MERA_COPY: Record<MeraCode, string> = {
  PRF_UNAVAILABLE:
    "This card reader can't read your card. Try your phone, or save the passkey to Google Password Manager / iCloud.",
  PASSKEY_OPERATION_FAILED: CARD_NOT_READ,
  CRYPTO_UNAVAILABLE: SECURE,
  SESSION_ENDED: EJECTED,
  DECRYPT_FAILED: CARD_NOT_READ,
  INPUT_INVALID: 'CARD DATA NOT VALID. TRY AGAIN.',
  VAULT_FORMAT_INVALID: CARD_NOT_READ,
}

const DRIP_COPY: Record<string, string> = {
  'ip-limit': 'TESTNET FUNDING LIMIT REACHED. TRY LATER.',
  'daily-limit': 'TESTNET FUNDING LIMIT REACHED. TRY LATER.',
  'supply-unavailable': 'TESTNET FUNDING UNAVAILABLE. TRY LATER.',
  'supply-low': 'TESTNET FUNDING IS EMPTY. TRY LATER.',
  'chain-unavailable': 'TESTNET FUNDING IS OFFLINE. TRY LATER.',
}

const CARD_COPY = (error: CardError): string => {
  const { SAVE_UNIT, WALLET_UNIT } = brand
  switch (error.code) {
    case 'RP_ID_MISSING':
      return `NO CARD DOMAIN SET. THIS BUILD CANNOT READ A ${WALLET_UNIT} YET.`
    case 'RP_ID_INVALID':
      return 'CARD DOMAIN IS NOT VALID. CHECK THE BUILD SETTINGS.'
    case 'RP_ID_MISMATCH':
      return 'THIS ADDRESS CANNOT USE THE CONFIGURED CARD DOMAIN.'
    case 'INSECURE_ORIGIN':
      return SECURE
    case 'CARD_BUSY':
      return `${WALLET_UNIT} IS BEING READ. WAIT.`
    case 'CARD_EJECTED':
      return EJECTED
    case 'CARD_EXPIRED':
      return 'CARD EJECTED AFTER 10 MINUTES AWAY. INSERT CARD AGAIN.'
    case 'CEREMONY_CANCELLED':
      return 'CARD EJECTED BEFORE IT WAS READ.'
    case 'CARD_MISMATCH':
      return 'CARD DATA DID NOT MATCH. TRY AGAIN.'
    case 'REGISTRY_UNCONFIGURED':
      return `${SAVE_UNIT} STORAGE IS NOT DEPLOYED YET. DISKS CANNOT BE READ OR SAVED.`
    case 'REGISTRY_INVALID':
      return `${SAVE_UNIT} STORAGE ADDRESS IS NOT VALID. CHECK THE BUILD SETTINGS.`
    case 'REGISTRY_NO_CODE':
      return `${SAVE_UNIT} STORAGE NOT FOUND ON TESTNET. DISKS CANNOT BE READ OR SAVED.`
    case 'WRONG_CHAIN':
      return 'WRONG NETWORK. THIS CONSOLE NEEDS MONAD TESTNET.'
    case 'REGISTRY_READ_FAILED':
      return `${SAVE_UNIT} COULD NOT BE READ FROM TESTNET. TRY AGAIN.`
    case 'DISK_UNREADABLE':
      return `${SAVE_UNIT} COULD NOT BE OPENED WITH THIS ${WALLET_UNIT}.`
    case 'DISK_EXISTS':
      return `THIS SLOT ALREADY HOLDS A ${SAVE_UNIT}. NOTHING WAS OVERWRITTEN.`
    case 'WORKER_UNCONFIGURED':
      return 'TESTNET FUNDING IS NOT SET UP. A NEW DISK CANNOT BE FUNDED YET.'
    case 'DRIP_REFUSED':
      return (error.detail && DRIP_COPY[error.detail]) || 'TESTNET FUNDING UNAVAILABLE. TRY LATER.'
    case 'NOT_FUNDED':
      return 'THIS DISK HAS NO TESTNET MON. IT CANNOT SAVE YET.'
    case 'SAVE_COST_FAILED':
      return 'SAVE COST COULD NOT BE CHECKED. NOTHING WAS SAVED.'
    case 'SAVE_FAILED':
      return 'SAVE FAILED. NOTHING WAS SAVED.'
    case 'SAVE_REVERTED':
      return 'SAVE WAS REJECTED BY THE CHAIN. NOTHING WAS SAVED.'
    case 'SAVE_UNCONFIRMED':
      return 'SAVE NOT CONFIRMED. CHECK THE TESTNET RECORD BEFORE RETRYING.'
  }
}

/** One mapping for every screen. Mera codes first, this app's codes next, a safe default last. */
export function cardErrorCopy(error: unknown): ErrorCopy {
  const mera = meraCodeOf(error)
  if (mera) return { code: mera, text: MERA_COPY[mera] }
  if (isCardError(error)) return { code: error.code, text: CARD_COPY(error) }
  return { code: 'UNKNOWN', text: CARD_NOT_READ }
}
