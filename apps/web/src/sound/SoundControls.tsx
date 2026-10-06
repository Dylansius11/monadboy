import { useConsoleIntent } from '../console/useConsoleInput'
import { useSound } from './SoundProvider'

/** Hardware feedback only. Fill and withdrawal sounds come from game outcomes. */
export function SoundControls({ boot = false }: { boot?: boolean }) {
  const { play, muted, toggleMute, status, music } = useSound()
  useConsoleIntent((intent) => {
    if (intent === 'A') play('confirm')
    else if (intent === 'B') play('back')
    else if (intent === 'START') play(boot ? 'boot' : 'confirm')
    else play('move')
  })
  const unavailable = status === 'unsupported'
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-label={unavailable ? 'Sound unavailable' : muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
      disabled={unavailable}
      title={music === 'failed' ? 'Music unavailable; effects still work' : 'M: mute sound'}
      onClick={toggleMute}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
      }}
    >
      {unavailable || muted ? 'OFF' : 'M'}
    </button>
  )
}
