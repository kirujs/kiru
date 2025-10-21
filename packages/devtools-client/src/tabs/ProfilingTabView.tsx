import {
  AppContext,
  useEffect,
  useRef,
  useRequestUpdate,
  useSignal,
} from "kiru"
import { kiruGlobal } from "../state"
import { isDevtoolsApp, typedMapEntries } from "devtools-shared"
import { LineChart, LineChartData } from "../components/LineChart"
import type { ProfilingEvent } from "../../../lib/dist/profiling"

export function ProfilingTabView() {
  const requestUpdate = useRequestUpdate()
  useEffect(() => {
    const update = (app: AppContext) => {
      if (isDevtoolsApp(app)) return
      requestUpdate()
    }
    kiruGlobal?.on("mount", update)
    kiruGlobal?.on("unmount", update)
    return () => {
      kiruGlobal?.off("mount", update)
      kiruGlobal?.off("unmount", update)
    }
  }, [])

  const profilingContext = kiruGlobal?.profilingContext!
  return (
    <div className="flex flex-col gap-2">
      {typedMapEntries(profilingContext.appStats)
        .filter(([app]) => !isDevtoolsApp(app))
        .map(([app]) => (
          <AppProfilingView key={app.id} app={app} />
        ))}
    </div>
  )
}

const MAX_TICKS = 100

const createLineChartDatasets = (
  events: EventStateMap
): LineChartData["datasets"] => {
  return Object.entries(events).map(([event, { values, color }]) => ({
    label: event,
    data: values,
    fill: false,
    borderColor: color,
    tension: 0.1,
  }))
}

type AppProfilingViewProps = {
  app: AppContext
}
type EventStateMap = Record<ProfilingEvent, { values: number[]; color: string }>
function AppProfilingView({ app }: AppProfilingViewProps) {
  const requestUpdate = useRequestUpdate()
  const events = useRef<EventStateMap>({
    update: {
      values: [0],
      color: "#ad981f",
    },
    updateDirtied: {
      values: [0],
      color: "#b21f3a",
    },
    createNode: {
      values: [0],
      color: "#198019",
    },
    removeNode: {
      values: [0],
      color: "#5F3691",
    },
    updateNode: {
      values: [0],
      color: "#2f2f9d",
    },
    signalAttrUpdate: {
      values: [0],
      color: "#28888f",
    },
    signalTextUpdate: {
      values: [0],
      color: "#9b3b98",
    },
  })
  const lineChartData = useSignal<LineChartData>({
    labels: [(performance.now() / 1000).toFixed(2)],
    datasets: createLineChartDatasets(events.current),
  })
  const chartHovered = useSignal(false)
  const profilingContext = kiruGlobal?.profilingContext!

  useEffect(() => {
    const onUpdate = (_app: AppContext) => {
      if (_app.id !== app.id) return
      requestUpdate()
    }
    kiruGlobal?.on("update", onUpdate)
    return () => kiruGlobal?.off("update", onUpdate)
  }, [])

  useEffect(() => {
    const cleanups: (() => void)[] = []
    Object.entries(events.current).forEach(([event, { values }]) => {
      const listener = (_app: AppContext) => {
        if (_app.id !== app.id) return
        if (chartHovered.peek() === true) return
        values[values.length - 1]++
      }
      const e = event as ProfilingEvent
      profilingContext.addEventListener(e, listener)
      cleanups.push(() => profilingContext.removeEventListener(e, listener))
    })

    const updateInterval = setInterval(() => {
      if (chartHovered.peek() === true) return
      const newLabels = [...lineChartData.value.labels]
      Object.values(events.current).forEach((evt) => {
        evt.values.push(0)
        if (evt.values.length > MAX_TICKS) {
          evt.values.shift()
        }
      })
      newLabels.push((performance.now() / 1000).toFixed(2))
      if (newLabels.length > MAX_TICKS) {
        newLabels.shift()
      }

      lineChartData.value = {
        labels: newLabels,
        datasets: createLineChartDatasets(events.current),
      }
    }, 100)

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      clearInterval(updateInterval)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2 border border-white border-opacity-10 rounded bg-neutral-400 bg-opacity-5 text-neutral-400 p-2">
      <div
        className="grid items-start gap-2"
        style="grid-template-columns: 1fr max-content;"
      >
        <div className="flex flex-col gap-2">
          <span>{app.name}</span>
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
          {profilingContext.mountDuration(app).toFixed(2)} ms
          <span className="text-right">Total updates:</span>
          <span>{profilingContext.totalTicks(app).toLocaleString()}</span>
          <span className="text-right">Avg. update duration:</span>
          {profilingContext.averageTickDuration(app).toFixed(2)} ms
          <span className="text-right">Latest update:</span>
          <span>{profilingContext.lastTickDuration(app).toFixed(2)} ms</span>
        </div>
      </div>
    </div>
  )
}
