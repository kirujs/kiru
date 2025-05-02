import { useSignal } from "kaioken"
import { useEventListener } from "./useEventListener"

export const useMouse = () => {
  const mouse = useSignal({ x: 0, y: 0 })
  const delta = useSignal({ x: 0, y: 0 })
  const client = useSignal({ x: 0, y: 0 })

  useEventListener("mousemove", (event) => {
    mouse.value = {
      x: event.x,
      y: event.y,
    }

    delta.value = {
      x: event.movementX,
      y: event.movementY,
    }

    client.value = {
      x: event.clientX,
      y: event.clientY,
    }
  })

  return { mouse, delta, client }
}
