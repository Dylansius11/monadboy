// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFS,
  clampVolume,
  isMuteShortcut,
  outputGain,
  parsePrefs,
} from './levels'

const press = (key: string, extra: Partial<KeyboardEventInit> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, ...extra })

describe('output gain', () => {
  it('is exactly zero when muted, whatever the slider says', () => {
    expect(outputGain({ volume: 1, muted: true })).toBe(0)
    expect(outputGain({ volume: 0.6, muted: true })).toBe(0)
  })

  it('is exactly zero at slider zero, not a quiet number', () => {
    expect(outputGain({ volume: 0, muted: false })).toBe(0)
  })

  it('is monotonic and never above 1 across the slider', () => {
    let previous = 0
    for (let i = 1; i <= 100; i++) {
      const gain = outputGain({ volume: i / 100, muted: false })
      expect(gain).toBeGreaterThan(previous)
      expect(gain).toBeLessThanOrEqual(1)
      previous = gain
    }
  })

  it('treats a non-finite volume as silence', () => {
    expect(clampVolume(Number.NaN)).toBe(0)
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(0)
    expect(outputGain({ volume: Number.NaN, muted: false })).toBe(0)
  })
})

describe('stored preferences', () => {
  it('round-trips volume and mute', () => {
    expect(parsePrefs(JSON.stringify({ volume: 0.3, muted: true }))).toEqual({
      volume: 0.3,
      muted: true,
    })
  })

  it('falls back to the defaults for anything unreadable', () => {
    for (const raw of [null, '', 'not json', 'null', '7', '"loud"']) {
      expect(parsePrefs(raw)).toEqual(DEFAULT_PREFS)
    }
  })

  it('never lets a hostile stored value exceed the slider range or unmute by accident', () => {
    expect(parsePrefs('{"volume":9,"muted":true}')).toEqual({ volume: 1, muted: true })
    expect(parsePrefs('{"volume":-4,"muted":"no"}')).toEqual({ volume: 0, muted: false })
    expect(parsePrefs('{"volume":"11","muted":1}').volume).toBe(DEFAULT_PREFS.volume)
  })
})

describe('M shortcut', () => {
  it('fires on a bare M of either case on the page', () => {
    expect(isMuteShortcut(press('m'), document.body)).toBe(true)
    expect(isMuteShortcut(press('M'), document.body)).toBe(true)
  })

  it('does not fire while typing into a text field', () => {
    const text = document.createElement('input')
    const area = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const inner = document.createElement('span')
    editable.append(inner)
    for (const target of [text, area, editable, inner]) {
      expect(isMuteShortcut(press('m'), target)).toBe(false)
    }
  })

  it('still fires on controls that take no typed text, such as the volume slider', () => {
    const range = document.createElement('input')
    range.type = 'range'
    const button = document.createElement('button')
    expect(isMuteShortcut(press('m'), range)).toBe(true)
    expect(isMuteShortcut(press('m'), button)).toBe(true)
  })

  it('leaves browser chords, key repeat and IME composition alone', () => {
    expect(isMuteShortcut(press('m', { ctrlKey: true }), document.body)).toBe(false)
    expect(isMuteShortcut(press('m', { metaKey: true }), document.body)).toBe(false)
    expect(isMuteShortcut(press('m', { altKey: true }), document.body)).toBe(false)
    expect(isMuteShortcut(press('m', { repeat: true }), document.body)).toBe(false)
    expect(isMuteShortcut(press('m', { isComposing: true }), document.body)).toBe(false)
  })
})
