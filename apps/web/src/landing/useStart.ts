import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { BOOTED_KEY } from '../game/screens/Boot'

/**
 * PRESS START from anywhere on the landing page. The hero console carries
 * the `console` view-transition name, so the browser morphs it into the
 * console on /play instead of cutting.
 *
 * The page's scrollbar is dropped before the transition starts: /play has
 * none, and a viewport that changes width mid-transition makes the browser
 * abort it. LandingPage clears the override when it mounts again.
 */
export function useStart(): () => void {
  const navigate = useNavigate()
  return useCallback(() => {
    window.sessionStorage.setItem(BOOTED_KEY, '1')
    document.body.style.overflow = 'hidden'
    void navigate({ to: '/play', viewTransition: true })
  }, [navigate])
}
