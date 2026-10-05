import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BOOTED_KEY, Boot } from '../../../game/screens/Boot'

export const Route = createFileRoute('/_console/play/')({ component: BootRoute })

/**
 * The console's power-on. The full sequence plays once per browser session;
 * after that, and for reduced motion, the screen opens on its last frame.
 * Read on the client after hydration, since the server has neither.
 */
function BootRoute() {
  const navigate = useNavigate()
  const [instant, setInstant] = useState(false)

  useEffect(() => {
    const seen = window.sessionStorage.getItem(BOOTED_KEY) === '1'
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.sessionStorage.setItem(BOOTED_KEY, '1')
    if (seen || still) setInstant(true)
  }, [])

  return <Boot instant={instant} onStart={() => navigate({ to: '/card' })} />
}
