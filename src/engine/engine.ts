/**
 * Main-thread client of the Pyodide worker: request/response with timeouts.
 * On timeout the worker is terminated and restarted automatically.
 */
type Listener = (s: EngineStatus) => void
export type EngineStatus = { state: 'idle' | 'loading' | 'ready' | 'error'; progress: number; label: string; restarts: number }
export const TIMEOUT = Symbol('timeout')
export type Timed<T> = T | typeof TIMEOUT

class PyEngine {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> | null }>()
  private chain: Promise<unknown> = Promise.resolve()
  private readyPromise: Promise<void> | null = null
  private listeners = new Set<Listener>()
  status: EngineStatus = { state: 'idle', progress: 0, label: '', restarts: 0 }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.status)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private setStatus(patch: Partial<EngineStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l(this.status))
  }

  /** Start (or restart) the worker and preload Pyodide. */
  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise
    this.setStatus({ state: 'loading', progress: 2, label: 'download' })
    const worker = new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'progress') {
        this.setStatus({ progress: msg.value, label: msg.label, state: msg.value >= 100 ? 'ready' : 'loading' })
        return
      }
      const p = this.pending.get(msg.id)
      if (p) {
        if (p.timer) clearTimeout(p.timer)
        this.pending.delete(msg.id)
        p.resolve(msg.result)
      }
    }
    worker.onerror = () => this.setStatus({ state: 'error', label: 'error' })
    this.readyPromise = this.post('init', {}, 120_000).then((r) => {
      if (r === TIMEOUT || (r as { fatal?: string })?.fatal) {
        this.setStatus({ state: 'error', label: 'error' })
        this.readyPromise = null
        throw new Error('Pyodide failed to load')
      }
      this.setStatus({ state: 'ready', progress: 100, label: 'ready' })
    })
    return this.readyPromise
  }

  private post(cmd: string, payload: unknown, timeoutMs: number): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve) => {
      const timer = timeoutMs
        ? setTimeout(() => {
            this.pending.delete(id)
            this.restart()
            resolve(TIMEOUT)
          }, timeoutMs)
        : null
      this.pending.set(id, { resolve, timer })
      this.worker!.postMessage({ id, cmd, payload })
    })
  }

  /** Kill the worker (infinite loop) and boot a fresh one. */
  restart() {
    this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
    for (const p of this.pending.values()) {
      if (p.timer) clearTimeout(p.timer)
      p.resolve(TIMEOUT)
    }
    this.pending.clear()
    this.setStatus({ restarts: this.status.restarts + 1 })
    this.start().catch(() => undefined)
  }

  /** Serialised call: one Python request at a time. Timeout starts once the worker is ready. */
  call<T>(cmd: string, payload: Record<string, unknown>, timeoutMs: number): Promise<Timed<T>> {
    const run = async () => {
      await this.start()
      return (await this.post(cmd, payload, timeoutMs)) as Timed<T>
    }
    const result = this.chain.then(run, run)
    this.chain = result.catch(() => undefined)
    return result
  }
}

export const engine = new PyEngine()
