// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { press, renderScreen, tick } from '../../test/harness'
import { BOOT_MS, Boot } from './Boot'

function renderBoot(instant = false) {
  const onStart = vi.fn()
  const utils = renderScreen(<Boot instant={instant} onStart={onStart} />)
  return { ...utils, onStart }
}

describe('Boot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('withholds the prompt until the sequence ends, then offers PRESS START', async () => {
    const { queryByText } = renderBoot()
    expect(queryByText(/press start/i)).toBeNull()
    await tick(BOOT_MS, vi)
    expect(queryByText(/press start/i)).toBeInTheDocument()
  })

  it('skips to the last frame on any other key without starting', () => {
    const { queryByText, onStart } = renderBoot()
    press('DOWN')
    expect(queryByText(/press start/i)).toBeInTheDocument()
    expect(onStart).not.toHaveBeenCalled()
  })

  it.each(['START', 'A'] as const)('%s starts at once, even mid-sequence', (key) => {
    const { onStart } = renderBoot()
    press(key)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('shows the last frame straight away when told to skip the sequence', () => {
    const { getByText } = renderBoot(true)
    expect(getByText(/press start/i)).toBeInTheDocument()
  })

  it('labels the network, because nothing here is real money', async () => {
    const { getByText } = renderBoot()
    await tick(BOOT_MS, vi)
    expect(getByText(/testnet/i)).toBeInTheDocument()
  })
})
