import * as kiru from "kiru"

import { LineChart } from "../../components/line-chart.jsx"
import { kiruGlobal as getKiruGlobal } from "../../state.js"
import {
  initProfilingViewState,
  profilingViewState,
  type ProfilingViewStateItem,
} from "./profiling-tab-state.js"

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

  const unsub = item.chartData.subscribe((data) => {
    if (hovered.peek()) return
    chartData.value = data
  })

  kiru.onCleanup(() => unsub())

  return () => (
    <div className="flex flex-col gap-2 p-2">
      <div
        className="grid items-start gap-2"
        style="grid-template-columns: 1fr max-content;"
      >
        <div className="flex flex-col gap-2">
          <span>{item.app.name}</span>
          <LineChart
            data={chartData}
            className="w-full max-w-full min-h-20 bg-black bg-opacity-30"
            onmouseover={() => (hovered.value = true)}
            onmouseout={() => (hovered.value = false)}
          />
        </div>
        <div
          className="text-xs grid grid-cols-2 gap-x-4"
          style="grid-template-columns: auto auto;"
        >
          <kiru.Derive from={item.stats}>
            {(stats) => (
              <>
                <span className="text-right">Mount duration:</span>
                {stats.mountDuration} ms
                <span className="text-right">Total updates:</span>
                <span>{stats.totalTicks}</span>
                <span className="text-right">Avg. update duration:</span>
                {stats.avgTickDuration} ms
                <span className="text-right">Latest update:</span>
                <span>{stats.lastTickDuration} ms</span>
              </>
            )}
          </kiru.Derive>
        </div>
      </div>
    </div>
  )
}
