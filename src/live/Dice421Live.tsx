import { useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'

const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
type Info = { dice: [number, number, number]; name: string; chips: number }
const TARGET = 21

function Die({ v, kept, onClick, rolling }: { v: number; kept?: boolean; onClick?: () => void; rolling?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-6xl leading-none transition sm:text-7xl ${rolling ? 'shake' : ''} ${kept ? 'rounded-xl bg-accent/25 ring-2 ring-accent' : ''}`}
      aria-label={`dé ${v}${kept ? ' gardé' : ''}`}
    >
      {FACES[v]}
    </button>
  )
}

/** Player vs computer, powered by the student's throw_dice / play_turn_phase1 / combination_* / best_player. */
export default function Dice421Live({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const [me, setMe] = useState<Info | null>(null)
  const [cpu, setCpu] = useState<Info | null>(null)
  const [keep, setKeep] = useState([false, false, false])
  const [rerolls, setRerolls] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'me' | 'done'>('idle')
  const [winner, setWinner] = useState<number | null>(null)
  const [score, setScore] = useState([0, 0])
  const [err, setErr] = useState<PyError | null>(null)
  const [rolling, setRolling] = useState(false)

  const info = async (expr: string, exec: string) => {
    const r = await pyCall<Info>(`{'dice': ${expr}, 'name': combination_name(${expr}), 'chips': combination_chips(${expr})}`, { ns, exec })
    if (!r.ok) {
      setErr(r.error ?? null)
      return null
    }
    return r.value!
  }

  const roll = async () => {
    setErr(null)
    setWinner(null)
    setCpu(null)
    setRolling(true)
    sfx.flip()
    const r = await info('__P', '__P = throw_dice()')
    setRolling(false)
    if (!r) return
    setMe(r)
    setKeep([false, false, false])
    setRerolls(0)
    setPhase('me')
  }

  const reroll = async () => {
    setRolling(true)
    sfx.flip()
    const k = `(${keep.map((x) => (x ? 'True' : 'False')).join(', ')})`
    const r = await info('__P', `__P = play_turn_phase1(__P, ${k})`)
    setRolling(false)
    if (!r) return
    setMe(r)
    setKeep([false, false, false])
    setRerolls((n) => n + 1)
  }

  const stand = async () => {
    // computer: up to two re-rolls, keeps pairs or the 4/2/1 dice
    let c = await info('__C', '__C = throw_dice()')
    for (let i = 0; c && i < 2 && c.chips < 3; i++) {
      const d = c.dice
      const k = d.map((v, j) => d.filter((x) => x === v).length >= 2 || (!d.some((x, m) => m !== j && x === v) && [4, 2, 1].includes(v) && d.filter((x) => [4, 2, 1].includes(x)).length >= 2))
      c = await info('__C', `__C = play_turn_phase1(__C, (${k.map((x) => (x ? 'True' : 'False')).join(', ')}))`)
    }
    if (!c) return
    setCpu(c)
    const w = await pyCall<number>('best_player(__P, __C)', { ns })
    if (!w.ok) return setErr(w.error ?? null)
    const win = w.value!
    setWinner(win)
    setPhase('done')
    if (win === 1) {
      sfx.win()
      setScore(([a, b]) => {
        const na = a + (me?.chips ?? 0)
        if (na >= TARGET) celebrate(true)
        return [na, b]
      })
    } else if (win === 2) {
      sfx.ko()
      setScore(([a, b]) => [a, b + c!.chips])
    }
  }

  const over = score[0] >= TARGET || score[1] >= TARGET
  return (
    <div className="mx-auto max-w-xl space-y-4 text-center">
      <div className="flex justify-center gap-6 font-display text-2xl">
        <span>🧑 {score[0]}</span>
        <span className="text-muted">/ {TARGET}</span>
        <span>🤖 {score[1]}</span>
      </div>
      {err && <ErrorCard error={err} />}
      <div className="card p-4">
        <div className="text-xs uppercase tracking-wider text-muted">{tr('Toi', 'You')}</div>
        {me ? (
          <>
            <div className="mt-2 flex justify-center gap-3">
              {me.dice.map((v, i) => (
                <Die key={i} v={v} kept={keep[i]} rolling={rolling && !keep[i]} onClick={phase === 'me' && rerolls < 2 ? () => setKeep(keep.map((k, j) => (j === i ? !k : k))) : undefined} />
              ))}
            </div>
            <div className="mt-2 font-semibold">
              {me.name} · {me.chips} {tr('jeton(s)', 'chip(s)')}
            </div>
          </>
        ) : (
          <div className="mt-2 text-muted">{tr('Lance les dés !', 'Roll the dice!')}</div>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {phase !== 'me' && !over && (
            <button className="btn btn-primary" onClick={roll}>
              🎲 {tr('Lancer', 'Roll')}
            </button>
          )}
          {phase === 'me' && (
            <>
              <button className="btn" onClick={reroll} disabled={rerolls >= 2 || keep.every(Boolean)}>
                🔁 {tr('Relancer les dés non gardés', 'Re-roll unkept dice')} ({2 - rerolls})
              </button>
              <button className="btn btn-primary" onClick={stand}>
                ✋ {tr('Je garde', 'Stand')}
              </button>
            </>
          )}
        </div>
        {phase === 'me' && rerolls < 2 && <div className="mt-1 text-xs text-muted">{tr('Clique sur les dés à garder.', 'Click the dice to keep.')}</div>}
      </div>
      {cpu && (
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted">🤖 {tr('Ordinateur', 'Computer')}</div>
          <div className="mt-2 flex justify-center gap-3">
            {cpu.dice.map((v, i) => (
              <Die key={i} v={v} />
            ))}
          </div>
          <div className="mt-2 font-semibold">
            {cpu.name} · {cpu.chips} {tr('jeton(s)', 'chip(s)')}
          </div>
        </div>
      )}
      {winner !== null && (
        <div className="font-display text-2xl">{winner === 1 ? '🏆 ' + tr('Manche gagnée !', 'Round won!') : winner === 2 ? '😈 ' + tr('L’ordinateur gagne', 'Computer wins') : '🤝 ' + tr('Égalité', 'Tie')}</div>
      )}
      {over && (
        <div className="card p-4">
          <div className="font-display text-3xl">{score[0] >= TARGET ? '🎉 ' + tr('Partie gagnée !', 'Match won!') : '💀 ' + tr('Partie perdue', 'Match lost')}</div>
          <button className="btn btn-primary mt-3" onClick={() => { setScore([0, 0]); setPhase('idle'); setMe(null); setCpu(null); setWinner(null) }}>
            ↺ {tr('Nouvelle partie', 'New match')}
          </button>
        </div>
      )}
      <p className="text-xs text-muted">{tr('Le vainqueur de chaque manche marque les jetons de sa combinaison. Premier à 21.', 'The round winner scores the chips of their combination. First to 21.')}</p>
    </div>
  )
}
