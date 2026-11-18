import type { Session } from '../pages/LevelPage'
import { CodeGame } from './CodeGame'
import { LessonGame, PredictGame, QuizGame, ColorTilesGame } from './SimpleGames'
import { ParsonsGame, TraceGame, TruthGame, RobotGame, WriteTestGame } from './PuzzleGames'

export function GameFor({ session }: { session: Session }) {
  switch (session.level.type) {
    case 'lesson':
      return <LessonGame session={session} />
    case 'predict_output':
      return <PredictGame session={session} />
    case 'quiz':
      return <QuizGame session={session} />
    case 'parsons':
      return <ParsonsGame session={session} />
    case 'trace':
      return <TraceGame session={session} />
    case 'truth_table':
      return <TruthGame session={session} />
    case 'robot':
      return <RobotGame session={session} />
    case 'write_test':
      return <WriteTestGame session={session} />
    case 'color_tiles':
      return <ColorTilesGame session={session} />
    case 'boss':
      return null
    default:
      return <CodeGame session={session} />
  }
}
