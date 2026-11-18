/// <reference lib="webworker" />
/**
 * Pyodide web worker. All Python runs here, never on the main thread.
 * The main thread kills this worker on timeout (infinite loops) and starts a new one.
 */
import runnerSrc from '../python/runner.py?raw'
import canvasSrc from '../python/shims/canvas.py?raw'
import richSrc from '../python/shims/rich_lite.py?raw'
import readcharSrc from '../python/shims/readchar_lite.py?raw'
import foliumSrc from '../python/shims/folium_lite.py?raw'
import { PYODIDE_INDEX_URL } from './config'

declare const self: DedicatedWorkerGlobalScope

type PyodideAPI = {
  FS: { mkdirTree(p: string): void; writeFile(p: string, d: string): void }
  runPython(code: string): unknown
  loadPackagesFromImports(code: string): Promise<void>
  loadPackage(names: string[]): Promise<void>
  globals: { get(name: string): unknown }
}

let py: PyodideAPI | null = null
let handle: ((req: string) => string) | null = null
const loadedPkgs = new Set<string>()

function progress(value: number, label: string) {
  self.postMessage({ type: 'progress', value, label })
}

async function init() {
  progress(5, 'download')
  const mod = await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)
  progress(35, 'runtime')
  py = (await mod.loadPyodide({ indexURL: PYODIDE_INDEX_URL })) as PyodideAPI
  progress(80, 'runner')
  const dir = '/home/pyodide/pyarcade'
  py.FS.mkdirTree(dir)
  py.FS.writeFile(`${dir}/runner.py`, runnerSrc)
  py.FS.writeFile(`${dir}/canvas.py`, canvasSrc)
  py.FS.writeFile(`${dir}/rich_lite.py`, richSrc)
  py.FS.writeFile(`${dir}/readchar_lite.py`, readcharSrc)
  py.FS.writeFile(`${dir}/folium_lite.py`, foliumSrc)
  py.runPython(`import sys, os\nsys.path.insert(0, '${dir}')\nos.chdir('/home/pyodide')\nimport runner`)
  handle = py.runPython('runner.handle') as (req: string) => string
  progress(100, 'ready')
}

async function ensurePackages(code: string | undefined, packages: string[] | undefined) {
  if (!py) return
  const wanted = new Set(packages ?? [])
  if (code && /\bmatplotlib\b/.test(code)) wanted.add('matplotlib')
  if (code && /\bnumpy\b/.test(code)) wanted.add('numpy')
  const missing = [...wanted].filter((p) => !loadedPkgs.has(p))
  if (missing.length) {
    progress(50, 'packages')
    await py.loadPackage(missing)
    missing.forEach((p) => loadedPkgs.add(p))
    progress(100, 'ready')
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { id, cmd, payload } = event.data as { id: number; cmd: string; payload: Record<string, unknown> }
  try {
    if (cmd === 'init') {
      if (!py) await init()
      self.postMessage({ type: 'result', id, result: { ok: true } })
      return
    }
    if (!py || !handle) await init()
    const codeLike = [payload.code, payload.given_code, payload.exec].filter(Boolean).join('\n') as string
    await ensurePackages(codeLike, payload.packages as string[] | undefined)
    const out = handle!(JSON.stringify({ cmd, ...payload }))
    self.postMessage({ type: 'result', id, result: JSON.parse(out) })
  } catch (err) {
    self.postMessage({ type: 'result', id, result: { fatal: String(err) } })
  }
}
