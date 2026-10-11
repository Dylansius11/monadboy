// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { installOffer, isIos, promptInstall, useInstallOffer } from './install'

// jsdom has no matchMedia; this is a browser tab, not the installed app
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
})

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

describe('what the page offers', () => {
  const base = { standalone: false, installed: false, canPrompt: false, ios: false }

  it('offers the native dialog when the browser handed one over', () => {
    expect(installOffer({ ...base, canPrompt: true })).toBe('prompt')
  })

  it('offers the Share hint on iOS, which has no dialog', () => {
    expect(installOffer({ ...base, ios: true })).toBe('ios')
  })

  it('offers nothing in the installed app or once installed', () => {
    expect(installOffer({ ...base, canPrompt: true, ios: true, standalone: true })).toBe('none')
    expect(installOffer({ ...base, canPrompt: true, installed: true })).toBe('none')
  })

  it('offers nothing where the browser cannot install', () => {
    expect(installOffer(base)).toBe('none')
  })
})

describe('which devices install through Share', () => {
  it('knows an iPhone and an iPad that reports as a Mac', () => {
    expect(isIos({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true)
    expect(isIos({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true)
  })

  it('leaves a desktop Mac and Android to their own install paths', () => {
    expect(isIos({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe(false)
    expect(isIos({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe(false)
  })
})

describe('the install dialog', () => {
  it('appears when the browser fires the event and goes once it is accepted', async () => {
    const { result } = renderHook(() => useInstallOffer())
    expect(result.current).toBe('none')

    const prompt = vi.fn(() => Promise.resolve())
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(result.current).toBe('prompt')

    await act(() => promptInstall())
    expect(prompt).toHaveBeenCalledOnce()
    expect(result.current).toBe('none')
  })
})
