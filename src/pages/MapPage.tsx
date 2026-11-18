import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { WORLDS, WORLD_LEVELS, worldBosses, worldStars, isLevelUnlocked, isWorldUnlocked } from '../content'
import type { Level, WorldMeta } from '../content/schema'
import { useProfile, useSettings, useStore } from '../store/store'
import { useLang, useTr } from '../i18n'
import { TYPE_META } from '../lib/levelTypes'
import { chestReward, type Cosmetic } from '../lib/cosmetics'
import { seededRandom } from '../lib/dates'
import { wordleReadiness } from '../lib/progress'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'
import { awardBadges } from '../lib/badges'
import { Stars } from '../components/Stars'

function Node({ level, x, unlocked, current }: { level: Level; x: number; unlocked: boolean; current: boolean }) {
  const p = useProfile()
  const tr = useTr()
  const lang = useLang()
  const lp = p.levels[level.id]
  const boss = level.type === 'boss'
  const bossWon = boss && p.bosses[level.id]?.won
  const meta = TYPE_META[level.type]
  const size = boss ? 'h-20 w-20 text-4xl' : 'h-14 w-14 text-2xl'
  const color = !unlocked ? 'bg-panel2 border-line opacity-60' : lp?.completed || bossWon ? 'bg-ok/20 border-ok' : current ? 'bg-accent/30 border-accent glow' : 'bg-panel border-accent2'
  const label = boss ? (level.type === 'boss' ? { guided: '🛡️', twin: '👯', exam: '🎓' }[level.variant] : '') : ''
  const inner = (
    <div className="flex flex-col items-center" style={{ transform: `translateX(${x}px)` }}>
      <div className={`relative flex items-center justify-center rounded-full border-2 ${size} ${color} shadow-lg transition hover:scale-105`}>
        <span aria-hidden>{unlocked ? (boss ? (bossWon ? '💥' : '👾') : meta.icon) : '🔒'}</span>
        {label && <span className="absolute -right-1 -top-1 text-lg">{label}</span>}
      </div>
      <div className="mt-1 max-w-[150px] text-center text-xs leading-tight">
        <div className={unlocked ? '' : 'text-muted'}>{level.title}</div>
        {!boss && <Stars n={lp?.stars ?? 0} size="text-[11px]" />}
        {boss && p.bosses[level.id]?.bestScore !== undefined && <div className="text-gold">{p.bosses[level.id]!.bestScore!.toFixed(1)}/20</div>}
      </div>
      <span className="sr-only">
        {tr(meta.fr, meta.en)} {lang}
      </span>
    </div>
  )
  return unlocked ? (
    <Link to={`/level/${level.id}`} aria-label={`${level.title} (${tr(meta.fr, meta.en)})`}>
      {inner}
    </Link>
  ) : (
    <div aria-label={`${level.title} — ${tr('verrouillé', 'locked')}`}>{inner}</div>
  )
}

function Chest({ world, ready }: { world: WorldMeta; ready: boolean }) {
  const tr = useTr()
  const p = useProfile()
  const update = useStore((s) => s.update)
  const opened = p.chests[String(world.id)]
  const [reveal, setReveal] = useState<{ cosmetic?: Cosmetic; coins: number } | null>(null)
  const open = () => {
    const rnd = seededRandom(Date.now() % 100000)
    const r = chestReward(p.owned, rnd)
    update((q) => {
      q.chests[String(world.id)] = r.cosmetic?.id ?? `coins:${r.coins}`
      q.coins += r.coins
      if (r.cosmetic) q.owned.push(r.cosmetic.id)
    })
    setReveal(r)
    sfx.win()
    celebrate()
    awardBadges()
  }
  return (
    <div className="flex flex-col items-center">
      <button
        disabled={!ready || !!opened}
        onClick={open}
        className={`text-5xl transition ${ready && !opened ? 'floaty hover:scale-110' : opened ? 'opacity-60' : 'opacity-30 grayscale'}`}
        aria-label={tr('Coffre mystère', 'Mystery chest')}
      >
        {opened ? '📭' : '🧰'}
      </button>
      <div className="text-xs text-muted">{opened ? tr('Coffre ouvert', 'Chest opened') : ready ? tr('Coffre mystère : ouvre-moi !', 'Mystery chest: open me!') : tr('Coffre : finis le monde', 'Chest: finish the world')}</div>
      <AnimatePresence>
        {reveal && (
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card mt-2 p-3 text-center text-sm">
            {reveal.cosmetic && (
              <div>
                <span className="text-3xl">{reveal.cosmetic.icon}</span>
                <div>{tr('Nouveau cosmétique', 'New cosmetic')} : {reveal.cosmetic.fr}</div>
              </div>
            )}
            <div className="text-gold">+{reveal.coins} 🪙</div>
            <Link to="/shop" className="text-accent2 underline">
              {tr('Équiper dans la boutique', 'Equip in the shop')}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function WorldSection({ world }: { world: WorldMeta }) {
  const tr = useTr()
  const lang = useLang()
  const p = useProfile()
  const settings = useSettings()
  const unlocked = isWorldUnlocked(p, world, settings.unlockAll)
  const levels = WORLD_LEVELS[String(world.id)] ?? []
  const bosses = worldBosses(world)
  const s = worldStars(p, world)
  const firstOpen = levels.find((l) => !p.levels[l.id]?.completed && isLevelUnlocked(p, l, settings.unlockAll))
  const amp = typeof window !== 'undefined' && window.innerWidth < 640 ? 45 : 110
  const all = [...levels, ...bosses]
  return (
    <section id={`world-${world.id}`} className="card relative mb-8 overflow-hidden p-4 sm:p-6" style={{ borderColor: unlocked ? world.color : undefined }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-4xl">{world.emoji}</div>
        <div className="flex-1">
          <h2 className="font-display text-2xl" style={{ color: unlocked ? world.color : undefined }}>
            {typeof world.id === 'number' ? `${tr('Monde', 'World')} ${world.id} · ` : ''}
            {lang === 'en' && world.title_en ? world.title_en : world.title}
          </h2>
          <div className="text-sm text-muted">{world.subtitle}</div>
        </div>
        <div className="min-w-[180px]">
          <div className="flex justify-between text-xs text-muted">
            <span>
              {s.done}/{s.total} {tr('niveaux', 'levels')}
            </span>
            <span>
              {s.stars}/{s.max} ⭐
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-panel2">
            <div className="h-full transition-all" style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%`, background: world.color }} />
          </div>
        </div>
      </div>
      {!unlocked ? (
        <div className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-muted">🔒 {tr('Termine le monde précédent pour ouvrir celui-ci.', 'Finish the previous world to open this one.')}</div>
      ) : levels.length === 0 && bosses.length === 0 ? (
        <div className="mt-4 text-center text-muted">{tr('Contenu à venir.', 'Coming soon.')}</div>
      ) : (
        <div className="relative mt-6 flex flex-col items-center gap-6">
          {all.map((l, i) => (
            <Node key={l.id} level={l} x={Math.round(Math.sin(i * 0.9) * amp)} unlocked={isLevelUnlocked(p, l, settings.unlockAll)} current={firstOpen?.id === l.id} />
          ))}
          <Chest world={world} ready={s.total > 0 && s.done === s.total} />
        </div>
      )}
    </section>
  )
}

export function MapPage({ only }: { only?: string }) {
  const tr = useTr()
  const p = useProfile()
  const loc = useLocation()
  useEffect(() => {
    const id = loc.hash.replace('#', '')
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [loc.hash])
  const worlds = WORLDS.filter((w) => (only ? String(w.id) === only : w.id !== 'wordle' && (!w.secret || p.secret)))
  const ready = wordleReadiness(p)
  return (
    <div className="mx-auto max-w-3xl px-3 pb-20 pt-6">
      {only === 'wordle' ? (
        <div className="card mb-6 p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl">🟩 {tr('Prêt pour l’évaluation Wordle', 'Ready for the Wordle assessment')}</h1>
            <span className="font-display text-3xl text-ok">{ready} %</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full border border-line bg-panel2">
            <div className="h-full bg-ok transition-all" style={{ width: `${ready}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {tr('Ce parcours ne reprend que ce qu’il faut pour le TP Wordle : chaînes, boucles sur une chaîne, listes, dict de compteurs, fichiers, hasard, boucle d’essais. Il mène au boss Wordle, puis à ses jumeaux et à l’examen blanc noté sur 20.', 'This track only covers what the Wordle project needs, then leads to the Wordle boss, its twins and a mock exam graded /20.')}
          </p>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl">🗺️ {tr('Carte des mondes', 'World map')}</h1>
          <Link to="/wordle" className="btn text-sm">
            🟩 {tr('Parcours express Wordle', 'Wordle fast track')} · {ready} %
          </Link>
        </div>
      )}
      {worlds.map((w) => (
        <WorldSection key={String(w.id)} world={w} />
      ))}
    </div>
  )
}
