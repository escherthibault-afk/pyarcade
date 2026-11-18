import { useRef, useState } from 'react'
import { useProfile, useSettings, useStore } from '../store/store'
import { localRepository, downloadText } from '../store/repository'
import { useTr } from '../i18n'
import { sfx } from '../lib/sound'

export default function SettingsPage() {
  const tr = useTr()
  const s = useSettings()
  const set = useStore((st) => st.setSettings)
  const p = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const Row = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
  const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full border border-line transition ${on ? 'bg-accent' : 'bg-panel2'}`}>
      <span className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-0.5'}`} style={{ width: 22, height: 22 }} />
    </button>
  )
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <h1 className="mb-4 font-display text-3xl">⚙️ {tr('Réglages', 'Settings')}</h1>
      <div className="card px-4">
        <Row label={tr('Son', 'Sound')}>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={1} step={0.1} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} aria-label="volume" disabled={!s.sound} />
            <Toggle on={s.sound} onChange={(v) => { set({ sound: v }); if (v) setTimeout(sfx.ok, 50) }} label={tr('Son', 'Sound')} />
          </div>
        </Row>
        <Row label={tr('Animations', 'Animations')} hint={tr('« Auto » suit le réglage de ton système (prefers-reduced-motion).', '“Auto” follows your system setting.')}>
          <select className="rounded-lg border border-line bg-bg2 px-2 py-1" value={s.motion} onChange={(e) => set({ motion: e.target.value as typeof s.motion })}>
            <option value="auto">Auto</option>
            <option value="reduce">{tr('Réduites', 'Reduced')}</option>
            <option value="full">{tr('Complètes', 'Full')}</option>
          </select>
        </Row>
        <Row label={tr('Thème', 'Theme')}>
          <div className="flex gap-1">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} className={`pill ${s.theme === t ? 'border-accent text-accent' : ''}`} onClick={() => set({ theme: t })}>
                {t === 'dark' ? '🌙 ' + tr('Sombre', 'Dark') : '☀️ ' + tr('Clair', 'Light')}
              </button>
            ))}
          </div>
        </Row>
        <Row label={tr('Langue de l’interface', 'Interface language')} hint={tr('Le code et les docstrings restent en anglais, comme au cours.', 'Code and docstrings stay in English, like in class.')}>
          <div className="flex gap-1">
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} className={`pill ${s.lang === l ? 'border-accent text-accent' : ''}`} onClick={() => set({ lang: l })}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </Row>
        <Row label={tr('Taille de police', 'Font size')}>
          <div className="flex items-center gap-2">
            <button className="btn px-2 py-1" onClick={() => set({ fontSize: Math.max(12, s.fontSize - 1) })} aria-label="-">
              A−
            </button>
            <span className="w-8 text-center font-mono">{s.fontSize}</span>
            <button className="btn px-2 py-1" onClick={() => set({ fontSize: Math.min(22, s.fontSize + 1) })} aria-label="+">
              A+
            </button>
          </div>
        </Row>
        <Row label={tr('Mode daltonien', 'Colour-blind mode')} hint={tr('Pastilles bleu/orange au lieu de vert/rouge (et icônes ✓ ✗).', 'Blue/orange instead of green/red (plus ✓ ✗ icons).')}>
          <Toggle on={s.colorblind} onChange={(v) => set({ colorblind: v })} label="colorblind" />
        </Row>
        <Row label={tr('Niveau suivant automatique', 'Auto-advance')} hint={tr('Après une réussite, passe au niveau suivant en 3 s (annulable).', 'After success, go to the next level in 3 s (cancellable).')}>
          <Toggle on={s.autoNext} onChange={(v) => set({ autoNext: v })} label="auto next" />
        </Row>
        <Row label={tr('Tout débloquer', 'Unlock everything')} hint={tr('Pour sauter les mondes que tu maîtrises déjà (ou réviser librement).', 'To skip worlds you already master (or review freely).')}>
          <Toggle on={s.unlockAll} onChange={(v) => set({ unlockAll: v })} label="unlock all" />
        </Row>
      </div>

      <h2 className="mb-2 mt-8 font-display text-2xl">💾 {tr('Progression', 'Progress')}</h2>
      <div className="card space-y-3 p-4 text-sm">
        <p className="text-muted">
          {tr('Ta progression est enregistrée dans ce navigateur. Exporte-la pour la sauvegarder ou la transférer sur un autre ordinateur.', 'Your progress is stored in this browser. Export it to back it up or move it to another computer.')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => downloadText(`pyarcade-${p.name}.json`, localRepository.exportProfile())}>
            ⬇️ {tr('Exporter (JSON)', 'Export (JSON)')}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆️ {tr('Importer', 'Import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const prof = localRepository.importProfile(await f.text())
                setMsg(tr(`Profil « ${prof.name} » importé.`, `Profile “${prof.name}” imported.`))
              } catch {
                setMsg(tr('Fichier invalide.', 'Invalid file.'))
              }
            }}
          />
        </div>
        {msg && <div className="text-ok">{msg}</div>}
      </div>
    </div>
  )
}
