import { useEffect } from 'react'
import { Hero } from './sections/Hero'
import { HowItPlays } from './sections/HowItPlays'
import { WhatIsReal } from './sections/WhatIsReal'
import { Cast } from './sections/Cast'
import { Closing } from './sections/Closing'
import { Topbar } from './Topbar'
import { useStart } from './useStart'
import './landing.css'

/**
 * The front door. Enter anywhere on the page is PRESS START, the same key the
 * console uses, unless focus is on something that already owns Enter.
 */
export function LandingPage() {
  const start = useStart()

  useEffect(() => {
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return
      const owner = document.activeElement
      if (owner && owner !== document.body && owner.matches('a, button, input, textarea, select, [tabindex]')) return
      start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start])

  return (
    <main className="landing">
      <Topbar onStart={start} />
      <Hero onStart={start} />
      <HowItPlays />
      <WhatIsReal />
      <Cast />
      <Closing onStart={start} />
    </main>
  )
}
