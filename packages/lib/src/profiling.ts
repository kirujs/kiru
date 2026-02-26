import type { AppHandle } from "./appContext"

const MAX_TICKS = 100

const ProfilingEvents = [
  "updateNode",
  "createNode",
  "removeNode",
  "update",
  "updateDirtied",
  "signalTextUpdate",
  "signalAttrUpdate",
] as const

export type ProfilingEvent = (typeof ProfilingEvents)[number]
export interface AppStats {
  timestamps: TickTS[]
  mountDuration: number
  totalTicks: number
}

interface TickTS {
  start: number
  end: number
}

type ProfilingEventListener = (app: AppHandle) => void

export function createProfilingContext() {
  const eventListeners = new Map<ProfilingEvent, Set<ProfilingEventListener>>()
  const appStats: Map<AppHandle, AppStats> = new Map()
  return {
    appStats,
    emit: (event: ProfilingEvent, app: AppHandle) => {
      eventListeners.get(event)?.forEach((listener) => listener(app))
    },
    addEventListener: (
      event: ProfilingEvent,
      listener: ProfilingEventListener
    ) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set())
      }
      eventListeners.get(event)!.add(listener)
    },
    removeEventListener: (
      event: ProfilingEvent,
      listener: ProfilingEventListener
    ) => {
      if (!eventListeners.has(event)) return
      eventListeners.get(event)!.delete(listener)
    },
    mountDuration: (app: AppHandle) => {
      const stats = appStats.get(app)
      if (!stats) return 0
      return stats.mountDuration
    },
    totalTicks: (app: AppHandle) => {
      const stats = appStats.get(app)
      if (!stats) return 0
      return stats.totalTicks
    },
    lastTickDuration: (app: AppHandle) => {
      const stats = appStats.get(app)
      if (!stats) return 0
      const last = stats.timestamps[stats.timestamps.length - 1]
      return last.end - last.start
    },
    averageTickDuration: (app: AppHandle) => {
      const stats = appStats.get(app)
      if (!stats) return 0
      const completeTicks = stats.timestamps.filter((ts) => ts.end !== Infinity)
      return (
        completeTicks.reduce((a, b) => a + (b.end - b.start), 0) /
        completeTicks.length
      )
    },
    beginTick: (app: AppHandle) => {
      if (!appStats.has(app)) {
        appStats.set(app, {
          mountDuration: Infinity,
          timestamps: [],
          totalTicks: 0,
        })
      }
      const stats = appStats.get(app)!
      stats.totalTicks++
      stats.timestamps.push({ start: performance.now(), end: Infinity })
    },
    endTick: (app: AppHandle) => {
      if (!appStats.has(app)) return
      const stats = appStats.get(app)!

      const last = stats.timestamps[stats.timestamps.length - 1]
      last.end = performance.now()

      if (stats.mountDuration === Infinity) {
        stats.mountDuration = last.end - last.start
      }
      if (stats.timestamps.length > MAX_TICKS) stats.timestamps.shift()
    },
  }
}
