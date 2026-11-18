import { useState } from 'react'
import { useProfile, useSettings, useStore } from '../store/store'
import { useTr } from '../i18n'
import { CodeEditor, type EditorThemeName } from '../components/CodeEditor'
import { RunConsole, useInteractiveRun } from '../components/RunConsole'
import { loadDataFile } from '../engine/api'

const EXAMPLES: Record<string, { fr: string; code: string }> = {
  hello: { fr: 'Bonjour + input()', code: 'name = input("Ton prénom ? ")\nprint(f"Bonjour {name} !")\n' },
  matplotlib: {
    fr: 'Courbe matplotlib',
    code: 'import matplotlib.pyplot as plt\n\nxs = list(range(10))\nplt.plot(xs, [x ** 2 for x in xs], label="x²")\nplt.plot(xs, [2 * x for x in xs], label="2x")\nplt.legend()\nplt.title("Deux courbes")\nplt.show()\n',
  },
  canvas: {
    fr: 'Animation canvas (≈ pygame)',
    code: 'import canvas  # chez toi : pygame\nimport math\n\nt = 0\n\ndef frame():\n    global t\n    t += 1\n    canvas.clear("#0d1021")\n    for i in range(12):\n        a = t / 30 + i * math.pi / 6\n        x = 300 + 120 * math.cos(a)\n        y = 200 + 120 * math.sin(a)\n        canvas.circle(x, y, 10 + 4 * math.sin(t / 10 + i), "#39d0d8")\n    canvas.text(10, 20, f"frame {t}", "white")\n\ncanvas.on_frame(frame)\n',
  },
  rich: {
    fr: 'Tableau rich_lite',
    code: 'from rich_lite import Console, Table  # chez toi : from rich.console import Console\n\nconsole = Console()\ntable = Table(title="Scores")\ntable.add_column("Joueur")\ntable.add_column("Points", justify="right")\ntable.add_row("Ada", "[bold green]42[/]")\ntable.add_row("Alan", "[red]17[/]")\nconsole.print(table)\nconsole.print("[black on yellow] C [/][white on green] R [/][white on grey] A [/]")\n',
  },
  folium: {
    fr: 'Carte folium_lite',
    code: 'import folium_lite as folium  # chez toi : import folium\n\nm = folium.Map(location=[48.8566, 2.3522], zoom_start=12)\nfolium.CircleMarker([48.8584, 2.2945], radius=8, popup="Tour Eiffel", color="red").add_to(m)\nfolium.CircleMarker([48.8606, 2.3376], radius=8, popup="Louvre").add_to(m)\nfolium.PolyLine([[48.8584, 2.2945], [48.8606, 2.3376]], color="purple").add_to(m)\nm.save("carte.html")\n',
  },
  keys: {
    fr: 'Touches readchar_lite',
    code: 'import readchar_lite as readchar  # chez toi : import readchar\n\nx = 0\nwhile True:\n    print("." * x + "@")\n    k = readchar.readkey()\n    if k == readchar.key.RIGHT:\n        x += 1\n    elif k == readchar.key.LEFT and x > 0:\n        x -= 1\n    elif k == "q":\n        break\nprint("fin")\n',
  },
  files: { fr: 'Lire un fichier', code: 'with open("words.txt", encoding="utf-8") as f:\n    words = [line.strip() for line in f]\nprint(len(words), "mots, dont", words[:5])\n' },
}

export default function SandboxPage() {
  const tr = useTr()
  const p = useProfile()
  const settings = useSettings()
  const [code, setCode] = useState(p.drafts.__sandbox ?? EXAMPLES.hello.code)
  const run = useInteractiveRun()
  const go = async () => {
    useStore.getState().saveDraft('__sandbox', code)
    useStore.getState().bump('sandbox')
    const files: Record<string, string> = /words\.txt/.test(code) ? { 'words.txt': await loadDataFile('words_en_5.txt') } : {}
    void run.start({ code, files })
  }
  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-20 pt-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-3xl">🏖️ {tr('Bac à sable', 'Sandbox')}</h1>
        <select className="rounded-lg border border-line bg-bg2 px-2 py-1.5 text-sm" onChange={(e) => e.target.value && setCode(EXAMPLES[e.target.value].code)} defaultValue="" aria-label="exemples">
          <option value="">{tr('Charger un exemple…', 'Load an example…')}</option>
          {Object.entries(EXAMPLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.fr}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-sm text-muted">
        {tr('Python libre, avec les modules du site : matplotlib, canvas (≈ pygame), rich_lite, readchar_lite, folium_lite. Fichier words.txt disponible.', 'Free Python with the site modules: matplotlib, canvas (≈ pygame), rich_lite, readchar_lite, folium_lite.')}
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div className="h-[460px]">
            <CodeEditor value={code} onChange={setCode} onRun={go} theme={p.equipped.editorTheme as EditorThemeName} fontSize={settings.fontSize} />
          </div>
          <button className="btn btn-primary" onClick={go} disabled={run.running}>
            ▶ {tr('Exécuter', 'Run')} <span className="kbd">⌘/Ctrl ↵</span>
          </button>
        </div>
        <div className="min-w-0">
          <RunConsole run={run} />
        </div>
      </div>
    </div>
  )
}
