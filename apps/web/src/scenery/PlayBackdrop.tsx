import { useEffect, useRef } from 'react'
import { paintCity } from './paint-city'
import './play-backdrop.css'

/** A quiet city outside the hardware. No game data, fake activity or input. */
export function PlayBackdrop() {
  const root = useRef<HTMLDivElement>(null)
  const city = useRef<HTMLCanvasElement>(null)
  const train = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = root.current
    const canvas = city.current
    const carriage = train.current
    if (!el || !canvas || !carriage) return
    const context = canvas.getContext('2d')
    const trainContext = carriage.getContext('2d')
    if (!context || !trainContext) return
    const draw = () => {
      const scale = el.clientWidth <= 640 ? 2 : 3
      canvas.width = Math.ceil(el.clientWidth / scale)
      canvas.height = Math.ceil(el.clientHeight / scale)
      context.imageSmoothingEnabled = false
      paintCity(context, canvas.width, canvas.height)
      canvas.style.width = `${canvas.width * scale}px`
      canvas.style.height = `${canvas.height * scale}px`
      el.style.setProperty('--art-scale', String(scale))
      el.style.setProperty('--train-travel', `${el.clientWidth + 216}px`)
    }
    carriage.width = 72
    carriage.height = 12
    trainContext.fillStyle = '#1f183b'
    trainContext.fillRect(1, 2, 70, 8)
    trainContext.fillStyle = '#6e5a91'
    trainContext.fillRect(3, 1, 66, 1)
    trainContext.fillRect(0, 8, 72, 1)
    trainContext.fillStyle = '#b3a6ec'
    for (let x = 5; x < 67; x += 7) trainContext.fillRect(x, 4, 4, 2)
    trainContext.fillStyle = '#0e091c'
    for (const x of [14, 38, 62]) trainContext.fillRect(x, 9, 3, 3)
    trainContext.fillStyle = '#85e6ff'
    trainContext.fillRect(70, 4, 2, 2)
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(el)
    const visibility = () => el.classList.toggle('is-paused', document.hidden)
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  return (
    <div ref={root} className="play-backdrop" aria-hidden="true">
      <canvas ref={city} className="play-city" />
      <div className="play-railway">
        <canvas ref={train} className="play-train" />
      </div>
    </div>
  )
}
