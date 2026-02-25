import * as kiru from "kiru"

import { LineChart, type LineChartData } from "../components/line-chart.jsx"
import { kiruGlobal as getKiruGlobal } from "../state.js"
import { isDevtoolsApp, typedMapEntries } from "../utils.js"

type EventStateMap = Record<
  kiru.ProfilingEvent,
  { values: number[]; color: string }
>

const MAX_TICKS = 100

export function ProfilingTabView() {
  const requestUpdate = kiru.useRequestUpdate()
  const kiruGlobal = getKiruGlobal()
  kiru.onMount(() => {
    const update = (app: kiru.AppHandle) => {
      if (isDevtoolsApp(app)) return
      requestUpdate()
    }
    kiruGlobal?.on("mount", update)
    kiruGlobal?.on("unmount", update)
    return () => {
      kiruGlobal?.off("mount", update)
      kiruGlobal?.off("unmount", update)
    }
  })

  const profilingContext = kiruGlobal?.profilingContext!
  return (
    <div className="flex flex-col gap-2">
      {typedMapEntries(profilingContext.appStats)
        .filter(([app]) => !isDevtoolsApp(app))
        .map(([app]) => (
          <AppProfilingChart key={app.id} app={app} />
        ))}
    </div>
  )
}

type AppProfilingChartProps = {
  app: kiru.AppHandle
}

function AppProfilingChart({ app: thisApp }: AppProfilingChartProps) {
  const requestUpdate = kiru.useRequestUpdate()
  const kiruGlobal = getKiruGlobal()
  kiru.onMount(() => {
    const onUpdate = (app: kiru.AppHandle) => {
      if (app.id !== thisApp.id) return
      requestUpdate()
    }
    kiruGlobal?.on("update", onUpdate)
    return () => kiruGlobal?.off("update", onUpdate)
  })

  const profilingContext = kiruGlobal?.profilingContext!
  const events = createEventStateMap()
  const chartHovered = kiru.signal(false)
  const lineChartData = kiru.signal<LineChartData>({
    labels: [(performance.now() / 1000).toFixed(2)],
    datasets: createLineChartDatasets(events),
  })

  kiru.onMount(() => {
    const cleanups: (() => void)[] = []
    Object.entries(events).forEach(([event, { values }]) => {
      const listener = (app: kiru.AppHandle) => {
        if (app.id !== thisApp.id) return
        if (chartHovered.peek() === true) return
        values[values.length - 1]++
      }
      const e = event as kiru.ProfilingEvent
      profilingContext.addEventListener(e, listener)
      cleanups.push(() => profilingContext.removeEventListener(e, listener))
    })

    const updateInterval = setInterval(() => {
      if (chartHovered.peek() === true) return

      Object.values(events).forEach((evt) => {
        evt.values.push(0)
        if (evt.values.length > MAX_TICKS) {
          evt.values.shift()
        }
      })

      const newLabels = [
        ...lineChartData.value.labels,
        (performance.now() / 1000).toFixed(2),
      ]
      if (newLabels.length > MAX_TICKS) {
        newLabels.shift()
      }

      lineChartData.value = {
        labels: newLabels,
        datasets: createLineChartDatasets(events),
      }
    }, 100)

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      clearInterval(updateInterval)
    }
  })

  return (
    <div className="flex flex-col gap-2 border border-white border-opacity-10 rounded bg-neutral-400 bg-opacity-5 text-neutral-400 p-2">
      <div
        className="grid items-start gap-2"
        style="grid-template-columns: 1fr max-content;"
      >
        <div className="flex flex-col gap-2">
          <span>{thisApp.name}</span>
          <LineChart
            data={lineChartData}
            className="w-full max-w-full min-h-20 bg-black bg-opacity-30"
            onmouseenter={() => (chartHovered.value = true)}
            onmouseleave={() => (chartHovered.value = false)}
          />
        </div>
        <div
          className="text-xs grid grid-cols-2 gap-x-4"
          style="grid-template-columns: auto auto;"
        >
          <span className="text-right">Mount duration:</span>
          {profilingContext.mountDuration(thisApp).toFixed(2)} ms
          <span className="text-right">Total updates:</span>
          <span>{profilingContext.totalTicks(thisApp).toLocaleString()}</span>
          <span className="text-right">Avg. update duration:</span>
          {profilingContext.averageTickDuration(thisApp).toFixed(2)} ms
          <span className="text-right">Latest update:</span>
          <span>
            {profilingContext.lastTickDuration(thisApp).toFixed(2)} ms
          </span>
        </div>
      </div>
    </div>
  )
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
