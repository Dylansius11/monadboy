import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSession } from './session'

beforeEach(() => useSession.setState(useSession.getInitialState(), true))
afterEach(() => useSession.setState(useSession.getInitialState(), true))

describe('session choices', () => {
  it('keeps the selected character bound to difficulty', () => {
    useSession.getState().chooseDifficulty('hard')
    expect(useSession.getState().characterId).toBe('mouch')
    useSession.getState().chooseDifficulty('normal')
    expect(useSession.getState().characterId).toBe('moyaki')
    useSession.getState().chooseDifficulty('easy')
    expect(useSession.getState().characterId).toBe('molandak')
  })

  it('clears GOD MODE on downgrade and refuses it outside HARD', () => {
    useSession.getState().chooseDifficulty('hard', true)
    expect(useSession.getState().godMode).toBe(true)
    useSession.getState().chooseDifficulty('normal', true)
    expect(useSession.getState().godMode).toBe(false)
    useSession.getState().chooseDifficulty('easy', true)
    expect(useSession.getState().godMode).toBe(false)
    useSession.getState().chooseDifficulty('hard')
    expect(useSession.getState().godMode).toBe(false)
  })

  it('drops manual edges when the player selects a width again', () => {
    useSession.getState().setManualRange({ lowerPct: -3, upperPct: 8 })
    useSession.getState().setWidth('wide')
    expect(useSession.getState().manualRange).toBeNull()
    useSession.getState().setManualRange({ lowerPct: -1, upperPct: 2 })
    useSession.getState().setWidth('tight')
    expect(useSession.getState()).toMatchObject({
      width: 'tight',
      manualRange: null,
    })
  })

  it('bounds the amount by zero and the current spending balance', () => {
    useSession.setState({ balance: 75 })
    useSession.getState().setAmount(-10)
    expect(useSession.getState().amount).toBe(0)
    useSession.getState().setAmount(100)
    expect(useSession.getState().amount).toBe(75)
    useSession.getState().setAmount(25)
    expect(useSession.getState().amount).toBe(25)
  })
})
