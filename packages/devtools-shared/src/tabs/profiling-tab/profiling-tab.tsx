import * as kiru from "kiru"

import { createLineChart } from "../../features"
import { kiruGlobal as getKiruGlobal } from "../../state.js"
import {
  initProfilingViewState,
  profilingViewState,
  type ProfilingViewStateItem,
} from "./profiling-tab-state.js"
import { InfoIcon } from "../../components/icons/info-icon.jsx"

type ProfilingTabViewProps = {
  /** When true, chart does not update and zoom is not reset (e.g. while dragging the widget). */
  pauseWhen?: kiru.Signal<boolean>
}

export function ProfilingTabView({ pauseWhen }: ProfilingTabViewProps) {
  const kiruGlobal = getKiruGlobal()
  kiru.onMount(() => initProfilingViewState(kiruGlobal))

  return (
    <div className="flex flex-col gap-2">
      <kiru.For each={profilingViewState}>
        {(item) => <AppProfilingChart item={item} pauseWhen={pauseWhen} />}
      </kiru.For>
    </div>
  )
}

type AppProfilingChartProps = {
  item: ProfilingViewStateItem
  pauseWhen?: kiru.Signal<boolean>
}

function AppProfilingChart({ item, pauseWhen }: AppProfilingChartProps) {
  const hovered = kiru.signal(false)
  const chartData = kiru.signal(item.chartData.peek())
  const lineChart = createLineChart({ data: chartData })

  const unsub = item.chartData.subscribe((data) => {
    if (hovered.peek() || pauseWhen?.peek()) return
    chartData.value = data
  })

  kiru.onCleanup(() => unsub())
  kiru.onMount(() => lineChart.init())

  const showStatsTooltip = kiru.signal(false)

  const onCanvasMouseOver = () => {
    hovered.value = true
  }
  const onCanvasMouseOut = () => {
    if (pauseWhen?.peek()) return
    hovered.value = false
    chartData.value = item.chartData.peek()
    lineChart.resetZoom()
  }

  return () => (
    <div className="flex overflow-hidden">
      <canvas
        ref={lineChart.canvasRef}
        className="w-full max-w-full h-80 overflow-hidden"
        onmouseover={onCanvasMouseOver}
        onmouseout={onCanvasMouseOut}
        onmousedown={(e) => {
          if (lineChart.getZoomLevel() <= 1) return
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }}
      />
      <div
        onmousedown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 flex flex-col gap-1 items-end text-neutral-300"
      >
        <button
          className="p-1"
          onclick={() => (showStatsTooltip.value = !showStatsTooltip.value)}
        >
          <InfoIcon className="w-4 h-4" />
        </button>

        <kiru.Derive from={{ stats: item.stats, showStatsTooltip }}>
          {({ stats, showStatsTooltip }) =>
            showStatsTooltip && (
              <div className="bg-neutral-800 bg-opacity-60 hover:bg-opacity-80 rounded-md p-2 flex flex-col gap-2 cursor-auto">
                <div className="text-xs font-medium">{item.app.name}</div>
                <div
                  className="text-xs grid grid-cols-2 gap-x-4 text-neutral-400"
                  style="grid-template-columns: auto auto;"
                >
                  <span>Mount duration:</span>
                  <span>{stats.mountDuration} ms</span>
                  <span>Total updates:</span>
                  <span>{stats.totalTicks}</span>
                  <span>Avg. update duration:</span>
                  <span>{stats.avgTickDuration} ms</span>
                  <span>Latest update:</span>
                  <span>{stats.lastTickDuration} ms</span>
                </div>
              </div>
            )
          }
        </kiru.Derive>
      </div>
    </div>
  )
}
