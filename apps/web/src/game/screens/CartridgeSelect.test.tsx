// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { press, renderScreen } from '../../test/harness'
import { CartridgeSelect } from './CartridgeSelect'
import { cartridges, saveDisks } from '../fixtures'
import { brand } from '../../config/brand'
import type { CartridgeSelectProps } from './CartridgeSelect'

const CARTS = cartridges()
const DISK = saveDisks()[0]

function renderCartridgeSelect(overrides: Partial<CartridgeSelectProps> = {}) {
  const onInsert = vi.fn()
  const onBack = vi.fn()
  const onLeaderboard = vi.fn()
  const utils = renderScreen(
    <CartridgeSelect
      disk={DISK}
      cartridges={CARTS}
      onInsert={onInsert}
      onLeaderboard={onLeaderboard}
      onBack={onBack}
      {...overrides}
    />,
  )
  return { ...utils, onInsert, onBack, onLeaderboard }
}

describe('the shelf', () => {
  it('renders all three cartridges, and the one real title comes from brand.ts', () => {
    const { getByText } = renderCartridgeSelect()
    expect(getByText(brand.CARTRIDGE_01)).toBeInTheDocument()
    expect(getByText('CART 01', { exact: false })).toBeInTheDocument()
    expect(getByText('CART 02', { exact: false })).toBeInTheDocument()
    expect(getByText('CART 03', { exact: false })).toBeInTheDocument()
  })

  it('shows an honest placeholder, never a throw or a spinner, when no disk is open', () => {
    const { getByText, queryByText } = renderCartridgeSelect({
      disk: undefined,
    })
    expect(getByText(/no disk/i)).toBeInTheDocument()
    expect(queryByText(/disk 1/i)).not.toBeInTheDocument()
  })
})

describe('moving the cursor', () => {
  it('RIGHT moves toward CART 02, and does not wrap past CART 03', () => {
    const { onInsert } = renderCartridgeSelect()
    press('RIGHT')
    press('RIGHT')
    press('RIGHT')
    press('A')

    expect(onInsert).not.toHaveBeenCalled()
  })

  it('LEFT at the first slot does not wrap', () => {
    const { onInsert } = renderCartridgeSelect()
    press('LEFT')
    press('A')

    expect(onInsert).toHaveBeenCalledExactlyOnceWith(CARTS[0].id)
  })
})

describe('pressing A', () => {
  it('on the unlocked cartridge calls onInsert with its id', () => {
    const { onInsert } = renderCartridgeSelect()
    press('A')
    expect(onInsert).toHaveBeenCalledExactlyOnceWith('cart-01')
  })

  it('on a locked cartridge does not call onInsert', () => {
    const { onInsert } = renderCartridgeSelect()
    press('RIGHT')
    press('A')
    expect(onInsert).not.toHaveBeenCalled()
  })
})

describe('pressing B', () => {
  it('calls onBack', () => {
    const { onBack } = renderCartridgeSelect()
    press('B')
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('clicking with a mouse', () => {
  it('inserts the unlocked cartridge on click', () => {
    const { onInsert, getByText } = renderCartridgeSelect()
    const button = getByText(brand.CARTRIDGE_01).closest('button')
    if (!button) throw new Error('cartridge title is not inside a button')
    fireEvent.click(button)
    expect(onInsert).toHaveBeenCalledExactlyOnceWith('cart-01')
  })

  it('moves the cursor to a locked cartridge on click without inserting', () => {
    const { onInsert, getAllByText } = renderCartridgeSelect()

    const lockedLabel = getAllByText(/^locked$/i)[0]
    const button = lockedLabel.closest('button')
    if (!button) throw new Error('locked cartridge is not inside a button')
    fireEvent.click(button)
    expect(onInsert).not.toHaveBeenCalled()
  })
})

describe('fixture and locked states', () => {
  it('marks the fixture disk identity visibly', () => {
    const { getByText } = renderCartridgeSelect()
    expect(getByText(/^fixture$/i)).toBeInTheDocument()
  })

  it('keeps both locked cartridges COMING SOON and returns to the playable title', () => {
    const { getByText, onInsert } = renderCartridgeSelect()
    for (let i = 0; i < 2; i += 1) {
      press('RIGHT', 'A')
      expect(getByText(/coming soon/i)).toBeInTheDocument()
      expect(onInsert).not.toHaveBeenCalled()
    }
    press('LEFT', 'LEFT', 'A')
    expect(getByText(CARTS[0].tagline ?? '')).toBeInTheDocument()
    expect(onInsert).toHaveBeenCalledExactlyOnceWith('cart-01')
  })
})

describe('the leaderboard', () => {
  it('opens from START on any slot, without inserting a cartridge', () => {
    const { onLeaderboard, onInsert } = renderCartridgeSelect()
    press('RIGHT', 'START')
    expect(onLeaderboard).toHaveBeenCalledOnce()
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('opens from a tap on its control hint', () => {
    const { onLeaderboard, getByRole } = renderCartridgeSelect()
    fireEvent.click(getByRole('button', { name: 'START Ranks' }))
    expect(onLeaderboard).toHaveBeenCalledOnce()
  })

  it('drops the FIXTURE label when the caller says the list is not a fixture', () => {
    const { queryByText } = renderCartridgeSelect({ fixture: false })
    expect(queryByText(/^fixture$/i)).not.toBeInTheDocument()
  })
})
