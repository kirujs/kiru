import { broadcastChannel } from "devtools-shared"
import { signal } from "kaioken"

export const toggleElementToVnode = signal(false)
if ("window" in globalThis) {
  broadcastChannel.addEventListener((e) => {
    if (e.data.type === "set-inspect-enabled") {
      toggleElementToVnode.value = e.data.value
    }
  })
}

export const popup = signal(null as Window | null)
