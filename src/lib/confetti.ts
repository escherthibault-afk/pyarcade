import confetti from 'canvas-confetti'
import { useStore } from '../store/store'

export function reducedMotion() {
  const m = useStore.getState().settings.motion
  if (m === 'reduce') return true
  if (m === 'full') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function celebrate(big = false) {
  if (reducedMotion()) return
  const colors = ['#8b7cff', '#39d0d8', '#3ddc84', '#ffd166', '#ff8fab']
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true })
  if (big) setTimeout(() => confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 }, colors }), 250)
  if (big) setTimeout(() => confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 }, colors }), 400)
}
