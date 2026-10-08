// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { SoundProvider, useSound } from './SoundProvider'
import { PREFS_STORAGE_KEY, outputGain, parsePrefs } from './levels'

function VolumeControl() {
  const { volume, muted, setVolume } = useSound()
  return (
    <>
      <input
        aria-label="Volume"
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
      />
      <output aria-label="Sound gain">{outputGain({ volume, muted })}</output>
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    PREFS_STORAGE_KEY,
    JSON.stringify({ volume: 0.6, muted: true }),
  )
})

describe('explicit volume adjustment', () => {
  it('recovers audible gain from a persisted mute and keeps it after remount', () => {
    const view = render(
      <SoundProvider>
        <VolumeControl />
      </SoundProvider>,
    )
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBe(0)
    fireEvent.change(view.getByRole('slider'), { target: { value: '0.8' } })
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBeCloseTo(
      0.8 ** 1.5,
    )
    expect(parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY))).toEqual({
      volume: 0.8,
      muted: false,
    })
    view.unmount()
    const restored = render(
      <SoundProvider>
        <VolumeControl />
      </SoundProvider>,
    )
    expect(
      Number(restored.getByLabelText('Sound gain').textContent),
    ).toBeCloseTo(0.8 ** 1.5)
  })

  it('keeps zero volume silent even when clearing a persisted mute', () => {
    const view = render(
      <SoundProvider>
        <VolumeControl />
      </SoundProvider>,
    )
    fireEvent.change(view.getByRole('slider'), { target: { value: '0' } })
    expect(parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY))).toEqual({
      volume: 0,
      muted: false,
    })
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBe(0)
  })

  it('keeps M reversible without changing the saved volume, even after slider recovery', () => {
    const view = render(
      <SoundProvider>
        <VolumeControl />
      </SoundProvider>,
    )
    fireEvent.keyDown(window, { key: 'm' })
    expect(parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY))).toEqual({
      volume: 0.6,
      muted: false,
    })
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBeCloseTo(
      0.6 ** 1.5,
    )
    fireEvent.keyDown(window, { key: 'm' })
    expect(parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY))).toEqual({
      volume: 0.6,
      muted: true,
    })
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBe(0)

    fireEvent.change(view.getByRole('slider'), { target: { value: '0.8' } })
    fireEvent.keyDown(window, { key: 'm' })
    expect(parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY))).toEqual({
      volume: 0.8,
      muted: true,
    })
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBe(0)
    fireEvent.keyDown(window, { key: 'm' })
    expect(parsePrefs(localStorage.getItem(PREFS_STORAGE_KEY))).toEqual({
      volume: 0.8,
      muted: false,
    })
    expect(Number(view.getByLabelText('Sound gain').textContent)).toBeCloseTo(
      0.8 ** 1.5,
    )
  })
})
