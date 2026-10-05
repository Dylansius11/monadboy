import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Difficulty } from '../../../game/screens/Difficulty'
import { useSession } from '../../../state/session'

export const Route = createFileRoute('/_console/play/difficulty')({
  component: DifficultyRoute,
})

/** S4 binds the chosen tier and modifier before opening the tracker. */
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
