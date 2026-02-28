import * as kiru from "kiru"

import { createLineChart } from "../../features"
import { kiruGlobal as getKiruGlobal } from "../../state.js"
import {
  initProfilingViewState,
  profilingViewState,
  type ProfilingViewStateItem,
} from "./profiling-tab-state.js"
import { InfoIcon } from "../../components/icons/info-icon.jsx"

export function ProfilingTabView() {
  const kiruGlobal = getKiruGlobal()
  kiru.onMount(() => initProfilingViewState(kiruGlobal))

  return (
    <div className="flex flex-col gap-2">
      <kiru.For each={profilingViewState}>
        {(item) => <AppProfilingChart item={item} />}
      </kiru.For>
    </div>
  )
}

type AppProfilingChartProps = {
  item: ProfilingViewStateItem
}

function AppProfilingChart({ item }: AppProfilingChartProps) {
  const hovered = kiru.signal(false)
  const chartData = kiru.signal(item.chartData.peek())
  const lineChart = createLineChart({ data: chartData })

  const unsub = item.chartData.subscribe((data) => {
    if (hovered.peek()) return
    chartData.value = data
  })

  kiru.onCleanup(() => unsub())
  kiru.onMount(() => lineChart.init())

  const showStatsTooltip = kiru.signal(false)

  const onCanvasMouseOver = () => {
    hovered.value = true
  }
  const onCanvasMouseOut = () => {
    hovered.value = false
    chartData.value = item.chartData.peek()
    lineChart.resetZoom()
  }

  return () => (
    <div title={item.app.name} className="flex overflow-hidden">
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
      <div className="absolute top-1 right-1 flex flex-col gap-1 items-end">
        <button
          className="p-1"
          onclick={() => (showStatsTooltip.value = !showStatsTooltip.value)}
        >
          <InfoIcon className="w-4 h-4" />
        </button>

        <kiru.Derive from={{ stats: item.stats, showStatsTooltip }}>
          {({ stats, showStatsTooltip }) =>
            showStatsTooltip && (
              <div
                className="text-xs grid grid-cols-2 gap-x-4 bg-neutral-800 bg-opacity-60 hover:bg-opacity-80 rounded-md p-2"
                style="grid-template-columns: auto auto;"
              >
                <span className="text-right">Mount duration:</span>
                {stats.mountDuration} ms
                <span className="text-right">Total updates:</span>
                <span>{stats.totalTicks}</span>
                <span className="text-right">Avg. update duration:</span>
                {stats.avgTickDuration} ms
                <span className="text-right">Latest update:</span>
                <span>{stats.lastTickDuration} ms</span>
              </div>
            )
          }
        </kiru.Derive>
      </div>
    </div>
  )
}
