import { useEffect, useState } from 'react'
import { brand } from '../config/brand'

/**
 * The page's header. At the very top it is part of the night; as soon as the
 * page moves it turns solid so nothing scrolls under its letters, and once the
 * hero's console is gone it grows a small START key, so the way in is never
 * more than one press away.
 */
export function Topbar({ onStart }: { onStart: () => void }) {
  const [solid, setSolid] = useState(false)
  const [docked, setDocked] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const hero = document.getElementById('top')
    if (!hero) return
    // the START key appears once the hero's lower half has left, with the
    // hero's own START key
    const observer = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting), {
      rootMargin: '0px 0px -50% 0px',
    })
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  return (
    <header className={`topbar${solid ? ' is-solid' : ''}${docked ? ' is-docked' : ''}`}>
      <a className="topbar-mark" href="#top">
        {brand.CONSOLE_NAME}
      </a>
      <nav className="topbar-nav" aria-label="Page">
        <a href="#how">How it plays</a>
        <a href="#real">What is real</a>
        <a href="#cast">The cast</a>
        <span className="tag">Testnet</span>
        <button type="button" className="topbar-start" onClick={onStart} tabIndex={docked ? 0 : -1} aria-hidden={!docked}>
          <span className="start-pill" aria-hidden="true" />
          Start
        </button>
      </nav>
    </header>
  )
}
