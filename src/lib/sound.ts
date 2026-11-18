/** Tiny Web Audio synth: short generated sounds, no audio files. */
import { useStore } from '../store/store'

let ctx: AudioContext | null = null
function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.12) {
  const s = useStore.getState().settings
  if (!s.sound) return
  const a = ac()
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime + start)
  g.gain.setValueAtTime(0.0001, a.currentTime + start)
  g.gain.exponentialRampToValueAtTime(gain * s.volume * 2, a.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.02)
}

export const sfx = {
  click: () => tone(660, 0, 0.05, 'square', 0.05),
  ok: () => {
    tone(523, 0, 0.09)
    tone(659, 0.08, 0.09)
    tone(784, 0.16, 0.16)
  },
  ko: () => {
    tone(220, 0, 0.12, 'sawtooth', 0.08)
    tone(165, 0.1, 0.2, 'sawtooth', 0.08)
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.18, 'square', 0.1)),
  coin: () => {
    tone(988, 0, 0.06, 'square', 0.08)
    tone(1319, 0.06, 0.14, 'square', 0.08)
  },
  hit: () => {
    tone(140, 0, 0.08, 'triangle', 0.2)
    tone(90, 0.05, 0.15, 'triangle', 0.15)
  },
  /** Rising pitch for combos. */
  combo: (n: number) => tone(440 * Math.pow(1.12, Math.min(n, 12)), 0, 0.1, 'square', 0.08),
  tick: () => tone(1200, 0, 0.03, 'square', 0.03),
  flip: () => tone(700, 0, 0.04, 'triangle', 0.05),
}
