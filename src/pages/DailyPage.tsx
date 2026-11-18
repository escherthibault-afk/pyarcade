import { Navigate } from 'react-router'
import { dailyLevel } from '../lib/progress'

export default function DailyPage() {
  const l = dailyLevel()
  return <Navigate to={l ? `/level/${l.id}?daily=1` : '/'} replace />
}
