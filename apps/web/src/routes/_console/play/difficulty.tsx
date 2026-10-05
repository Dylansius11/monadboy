import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Difficulty } from '../../../game/screens/Difficulty'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/difficulty')({
  component: DifficultyRoute,
})

/**
 * S4's route: the only writer of the chosen tier and modifier. Moving the
 * cursor to another tier stores it straight away so the screen re-renders with
 * it; confirming stores the final pair before the tracker opens.
 */
function DifficultyRoute() {
  const navigate = useNavigate()
  const { difficulty, godMode, chooseDifficulty } = useSession()

  return (
    <Difficulty
      difficulty={difficulty}
      godMode={godMode}
      onChange={(next) => chooseDifficulty(next, godMode)}
      onConfirm={(next, nextGodMode) => {
        chooseDifficulty(next, nextGodMode)
        navigate({ to: '/play/tracker' })
      }}
      onBack={() => navigate({ to: '/cartridges' })}
    />
  )
}
