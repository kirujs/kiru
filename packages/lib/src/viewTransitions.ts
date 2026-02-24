import { flushSync } from "./scheduler.js"

export namespace ViewTransitions {
  type ViewTransitionJob = () => Promise<void>

  const jobs: ViewTransitionJob[] = []
  let running = false
  let scheduled = false
  let transition: ViewTransition | null = null
  const supported =
    "window" in globalThis && typeof document.startViewTransition === "function"

  export function run<T>(
    callback: () => T | Promise<T>,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    const signal = options?.signal

    return new Promise<T>((resolve) => {
      const job: ViewTransitionJob = async () => {
        const result = await callback()
        resolve(result)
      }

      jobs.push(job)

      signal?.addEventListener(
        "abort",
        () => {
          const i = jobs.indexOf(job)
          if (i !== -1) {
            jobs.splice(i, 1)
          } else {
            transition?.skipTransition()
          }
        },
        { once: true }
      )

      schedule()
    })
  }

  export function stop() {
    transition?.skipTransition()
    transition = null
    jobs.length = 0
    running = false
    scheduled = false
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      runJobs()
    })
  }

  async function runJobs() {
    if (running || jobs.length === 0) return

    running = true

    const __jobs = [...jobs]
    jobs.length = 0

    const runJobs = async () => {
      await Promise.all(__jobs.map((j) => j()))
      flushSync()
    }

    if (!supported) {
      await runJobs()
    } else {
      transition = document.startViewTransition(runJobs)
      await transition.finished
    }

    transition = null
    running = false

    if (jobs.length > 0) {
      schedule()
    }
  }
}
