import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/store'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            onClick={() => dismiss(t.id)}
            className="card pointer-events-auto flex max-w-xs items-center gap-3 p-3 text-left text-sm"
          >
            <span className="text-2xl">{t.emoji ?? (t.kind === 'badge' ? '🏅' : t.kind === 'chest' ? '🧰' : 'ℹ️')}</span>
            <span>
              {t.kind === 'badge' && <span className="block text-xs uppercase tracking-wider text-gold">Succès débloqué</span>}
              {t.text}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
