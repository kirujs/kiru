import * as kiru from "kiru"
import {
  Chart,
  type PointStyle,
  LinearScale,
  LineController,
  CategoryScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
} from "chart.js"
import zoomPlugin from "chartjs-plugin-zoom"

export type LineChartData = {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    fill: boolean
    borderColor: string
    tension: number
    pointStyle?: PointStyle
  }[]
}

interface LineChartConfig {
  data: kiru.Signal<LineChartData>
}

export interface LineChartController {
  canvasRef: kiru.Signal<HTMLCanvasElement | null>
  init: () => () => void
  resetZoom: () => void
  getZoomLevel: () => number
}

export function createLineChart(config: LineChartConfig): LineChartController {
  const cleanups: (() => void)[] = []
  const dispose = () => cleanups.forEach((c) => c())

  const canvasRef = kiru.signal<HTMLCanvasElement | null>(null)
  let chart: Chart | null = null

  const resetZoom = () => chart?.resetZoom()
  const getZoomLevel = () => chart?.getZoomLevel() ?? 0

  const init = () => {
    const canvas = canvasRef.value
    if (!canvas) {
      console.error("createLineChart: canvas ref not set", new Error().stack)
      return dispose
    }

    Chart.register(
      zoomPlugin,
      LinearScale,
      LineController,
      CategoryScale,
      PointElement,
      LineElement,
      Legend,
      Tooltip
    )

    chart = new Chart(canvas, {
      type: "line",
      data: config.data.peek(),
      options: {
        scales: {
          y: { min: 0 },
        },
        animation: false,
        responsive: true,
        plugins: {
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: {
              wheel: { enabled: true },
              mode: "x",
            },
          },
          legend: { align: "start", position: "bottom" },
          title: { display: false },
        },
      },
    })

    const unsub = config.data.subscribe((newData) => {
      if (!chart) return
      chart.data = newData
      chart.update()
    })

    const resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(canvas.parentElement!)

    cleanups.push(() => {
      resizeObserver.disconnect()
      chart?.destroy()
      chart = null
      unsub()
    })

    return () => dispose()
  }

  return { canvasRef, init, resetZoom, getZoomLevel }
}
