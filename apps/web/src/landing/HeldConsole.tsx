import { useLayoutEffect, useRef, useState } from 'react'
import { ConsoleBody } from '../console/Console'
import { ConsoleInputProvider } from '../console/useConsoleInput'
import { brand } from '../config/brand'
import type { CSSProperties, ReactNode } from 'react'

/**
 * The real console, held in the page instead of standing on the desk.
 *
 * It fills its parent's width up to `maxWidth` and reserves exactly its scaled
 * size, so the page flows around it.
 *
 * Its keyboard is off: the page owns the keys. The on-screen buttons still
 * drive whatever screen it holds.
 */
export function HeldConsole({
  children,
  maxWidth = 568,
  powered = true,
  className = '',
  style,
}: {
  children: ReactNode
  /** Widest it may render, CSS px. The desk console is 568 wide. */
  maxWidth?: number
  powered?: boolean
  className?: string
  style?: CSSProperties
}) {
  const frame = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ scale: 0, width: 0, height: 0 })

  useLayoutEffect(() => {
    const outer = frame.current
    const inner = body.current
    if (!outer || !inner) return
    const measure = () => {
      // console.css narrows the shell on phones, so the natural size is read,
      // not assumed; offsetWidth/Height ignore the transform applied below
      const natural = inner.offsetWidth
      const width = Math.min(outer.parentElement?.clientWidth ?? natural, maxWidth)
      const scale = width / natural
      setBox({ scale, width, height: inner.offsetHeight * scale })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (outer.parentElement) observer.observe(outer.parentElement)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [maxWidth])

  return (
    <div
      ref={frame}
      className={`held-console ${className}`}
      style={{ width: box.width, height: box.height, ...style }}
    >
      <div
        ref={body}
        className="console is-held"
        style={{
          transform: `scale(${box.scale})`,
          transformOrigin: 'top left',
          // hidden until measured, so the first frame never shows it full size
          visibility: box.scale ? 'visible' : 'hidden',
        }}
      >
        <ConsoleInputProvider keyboard={false}>
          <ConsoleBody wordmark={brand.CONSOLE_NAME} powered={powered}>
            {children}
          </ConsoleBody>
        </ConsoleInputProvider>
      </div>
    </div>
  )
}
