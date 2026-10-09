import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Fit the complete desktop shell to the available viewport, including fractional
 * enlargement between integer sizes. The game keeps its 480x320 logical grid;
 * native portrait CSS overrides the transform and never scales the phone UI.
 */

export function useFitScale(
  stageRef: RefObject<HTMLElement | null>,
  boxRef: RefObject<HTMLElement | null>,
): number {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const stage = stageRef.current
    const box = boxRef.current
    if (!stage || !box) return

    const measure = () => {
      // offsetWidth and offsetHeight ignore transforms, so measuring the box
      // does not feed the scale we just applied back into the calculation.
      const bw = box.offsetWidth
      const bh = box.offsetHeight
      if (bw === 0 || bh === 0) return

      const available = stage.getBoundingClientRect()
      // A phone has no room to spend on a margin. 8px of breathing room on a
      // 412px screen is already 2% of the console's width, and the console
      // being as large as it can be is the entire point on the device most
      // people will open this on.
      const padding = available.width < 520 ? 8 : 32
      const sw = available.width - padding
      const sh = available.height - padding

      setScale(Math.min(sw / bw, sh / bh))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(box)

    // The pixel font arrives after first paint and it sets the wordmark's line
    // box, so the first measurement is of a console that is not yet its final
    // height. ResizeObserver does fire on the reflow, but only if the swap
    // actually changes the box by a whole pixel; asking fonts.ready directly
    // is the guarantee rather than the hope.
    if ('fonts' in document) void document.fonts.ready.then(measure)

    // A mobile URL bar sliding away resizes the VISUAL viewport without
    // necessarily resizing any element the observer is watching. This is the
    // event that always fires for it.
    const vv = window.visualViewport
    vv?.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)

    return () => {
      observer.disconnect()
      vv?.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [stageRef, boxRef])

  return scale
}
