import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { Console } from '../console/Console'
import { brand } from '../config/brand'
import { PlayBackdrop } from '../scenery/PlayBackdrop'
import { RuleBook } from '../game/help/RuleBook'
import { useConsoleIntent } from '../console/useConsoleInput'
import { useSound } from '../sound/SoundProvider'

/**
 * The console shell, mounted ONCE for every screen underneath it.
 *
 * Pathless on purpose. `/play/tracker` is still `/play/tracker`; this route
 * only owns the chrome.
 *
 * Why a layout rather than a <Console> per route: a route component unmounts
 * when you navigate away, and <Console> owns ConsoleInputProvider. Per-route
 * shells would tear down the input store, drop held keys, and reset the volume
 * on every screen change. The console is hardware. Hardware does not reboot
 * between screens.
 */
export const Route = createFileRoute('/_console')({ component: Shell })

function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <Console
      wordmark={brand.CONSOLE_NAME}
      backdrop={<PlayBackdrop />}
      tools={<ConsoleTools boot={path === '/play' || path === '/play/'} />}
    >
      <Outlet />
    </Console>
  )
}

/** Hardware feedback only; fill and withdrawal sounds stay with game outcomes. */
function ConsoleTools({ boot }: { boot: boolean }) {
  const { play } = useSound()
  useConsoleIntent((intent) => {
    if (intent === 'A') play('confirm')
    else if (intent === 'B') play('back')
    else if (intent === 'START') play(boot ? 'boot' : 'confirm')
    else play('move')
  })
  return <RuleBook />
}
