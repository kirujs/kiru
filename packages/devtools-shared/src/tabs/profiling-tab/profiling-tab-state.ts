import * as kiru from "kiru"
import { isDevtoolsApp } from "../../utils.js"
import { LineChartData } from "../../features/line-chart.jsx"
export type { LineChartData }

const MAX_TICKS = 100

export const profilingViewState = kiru.signal<ProfilingViewState>([])

type EventStateMap = Record<
  kiru.ProfilingEvent,
  { values: number[]; color: string }
>

type ProfilingContext = NonNullable<typeof window.__kiru.profilingContext>

interface AppStats {
  mountDuration: string
  totalTicks: string
  avgTickDuration: string
  lastTickDuration: string
}

export interface ProfilingViewStateItem {
  app: kiru.AppHandle
  stats: kiru.Signal<AppStats>
  chartData: kiru.Signal<LineChartData>
  dispose: () => void
}
type ProfilingViewState = ProfilingViewStateItem[]

let didInit = false
export function initProfilingViewState(kiruGlobal: typeof window.__kiru) {
  if (didInit) return
  didInit = true

  const profilingContext = kiruGlobal.profilingContext!

  const onAppMounted = (app: kiru.AppHandle) => {
    if (isDevtoolsApp(app)) return

    const match = profilingViewState.value.find(
      (item) => item.app.name === app.name
    )
    if (match) return
    const item = createProfilingViewStateItem(kiruGlobal, profilingContext, app)
    profilingViewState.value = [...profilingViewState.value, item]
  }

  const onAppUnmounted = (app: kiru.AppHandle) => {
    if (isDevtoolsApp(app)) return
    console.log("onAppUnmounted", app)
    profilingViewState.value
      .find((item) => item.app.name === app.name)
      ?.dispose()
  }

  profilingContext.appStats.forEach((_, app) => {
    if (isDevtoolsApp(app)) return
    const stateItem = createProfilingViewStateItem(
      kiruGlobal,
      profilingContext,
      app
    )
    profilingViewState.value = [...profilingViewState.value, stateItem]
  })

  kiruGlobal.on("mount", onAppMounted)
  kiruGlobal.on("unmount", onAppUnmounted)
}

function createAppStats(ctx: ProfilingContext, app: kiru.AppHandle): AppStats {
  return {
    mountDuration: ctx.mountDuration(app).toFixed(2),
    totalTicks: ctx.totalTicks(app).toLocaleString(),
    avgTickDuration: ctx.averageTickDuration(app).toFixed(2),
    lastTickDuration: ctx.lastTickDuration(app).toFixed(2),
  }
}

function createProfilingViewStateItem(
  kiruGlobal: typeof window.__kiru,
  ctx: ProfilingContext,
  thisApp: kiru.AppHandle
): ProfilingViewStateItem {
  const cleanups: (() => void)[] = []
  const dispose = () => {
    cleanups.forEach((c) => c())
    profilingViewState.value = profilingViewState.value.filter(
      (item) => item.app.name !== thisApp.name
    )
  }

  const events = createEventStateMap()
  const chartData = kiru.signal<LineChartData>({
    labels: [(performance.now() / 1000).toFixed(2)],
    datasets: createLineChartDatasets(events),
  })
  cleanups.push(() => kiru.Signal.dispose(chartData))

  Object.entries(events).forEach(([event, { values }]) => {
    const listener = (app: kiru.AppHandle) => {
      if (app.name !== thisApp.name) return
      values[values.length - 1]++
    }
    const e = event as kiru.ProfilingEvent
    ctx.addEventListener(e, listener)
    cleanups.push(() => ctx.removeEventListener(e, listener))
  })

  const updateInterval = setInterval(() => {
    Object.values(events).forEach((evt) => {
      evt.values.push(0)
      if (evt.values.length > MAX_TICKS) {
        evt.values.shift()
      }
    })

    const newLabels = [
      ...chartData.value.labels,
      (performance.now() / 1000).toFixed(2),
    ]
    if (newLabels.length > MAX_TICKS) {
      newLabels.shift()
    }

    chartData.value = {
      labels: newLabels,
      datasets: createLineChartDatasets(events),
    }
  }, 100)

  cleanups.push(() => clearInterval(updateInterval))

  const stats = kiru.signal<AppStats>(createAppStats(ctx, thisApp))
  const onUpdate = (app: kiru.AppHandle) => {
    if (app.name === thisApp.name) {
      stats.value = createAppStats(ctx, app)
    }
  }

  kiruGlobal.on("update", onUpdate)
  cleanups.push(() => kiruGlobal.off("update", onUpdate))

  return { app: thisApp, stats, chartData, dispose }
}

function createLineChartDatasets(
  events: EventStateMap
): LineChartData["datasets"] {
  return Object.entries(events).map(([event, { values, color }]) => ({
    label: event,
    data: values,
    fill: false,
    borderColor: color,
    tension: 0.1,
  }))
}

function createEventStateMap(): EventStateMap {
  return {
    update: { values: [0], color: "#ad981f" },
    updateDirtied: { values: [0], color: "#b21f3a" },
    createNode: { values: [0], color: "#198019" },
    removeNode: { values: [0], color: "#5F3691" },
    updateNode: { values: [0], color: "#2f2f9d" },
    signalAttrUpdate: { values: [0], color: "#28888f" },
    signalTextUpdate: { values: [0], color: "#9b3b98" },
  }
}
