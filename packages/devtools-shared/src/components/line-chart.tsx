import * as Kiru from "kiru"
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

export interface LineChartProps extends Omit<
  Kiru.ElementProps<"canvas">,
  "ref"
> {
  data: Kiru.Signal<LineChartData>
}

export function LineChart({ data, ...props }: LineChartProps) {
  const canvasRef = Kiru.ref<HTMLCanvasElement>(null)

  Kiru.onMount(() => {
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
    const canvas = canvasRef.current!
    const chart = new Chart(canvas, {
      type: "line",
      data: data.peek(),
      options: {
        scales: {
          y: {
            min: 0,
          },
        },
        animation: false,
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              mode: "x",
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              mode: "x",
            },
          },
          legend: {
            position: "top",
          },
          title: {
            display: false,
          },
        },
      },
    })

    const unsub = data.subscribe((newData) => {
      chart.data = newData
      chart.update()
    })

    return () => {
      chart.destroy()
      unsub()
    }
  })
  return <canvas ref={canvasRef} {...props} />
}
