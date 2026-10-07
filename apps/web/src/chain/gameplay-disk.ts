import type { zDiskPlaintext, zActualExit } from './disk-plaintext'
import type { z } from 'zod'
import type { Address } from 'viem'
import type { RunBasis } from './gameplay'

export type GameplayDisk = z.infer<typeof zDiskPlaintext>
export type ActualExit = z.infer<typeof zActualExit>

export function basisFromDisk(
  plaintext: GameplayDisk,
  market: Address,
): RunBasis | null {
  const basis = plaintext.position
  if (!basis || basis.market.toLowerCase() !== market.toLowerCase()) return null
  return {
    openedAt: basis.openedAt,
    startBlock: BigInt(basis.startBlock),
    deposit: { base0: basis.base0, quote0: basis.quote0 },
    low: basis.low,
    high: basis.high,
    step: basis.step,
  }
}

export function diskWithBasis(
  plaintext: GameplayDisk,
  market: Address,
  basis: RunBasis,
): GameplayDisk {
  return {
    ...plaintext,
    position: {
      market,
      openedAt: basis.openedAt,
      startBlock: basis.startBlock.toString(),
      base0: basis.deposit.base0,
      quote0: basis.deposit.quote0,
      low: basis.low,
      high: basis.high,
      step: basis.step,
    },
  }
}

/** Unknown history gets a sealed unavailable receipt, never an invented numeric run. */
export function appendActualRun(
  plaintext: GameplayDisk,
  result: ActualExit,
): GameplayDisk {
  const rest = { ...plaintext, position: undefined }
  const runs =
    result.complete &&
    result.openedAt !== null &&
    result.score !== null &&
    result.damage !== null &&
    result.net !== null
      ? [
          ...rest.runs,
          {
            market: result.market,
            openedAt: result.openedAt,
            closedAt: result.closedAt,
            score: result.score,
            damage: result.damage,
            net: result.net,
            fills: result.fills,
            receipts: result.receipts,
          },
        ].slice(-10)
      : rest.runs
  return { ...rest, runs, lastExit: result }
}
