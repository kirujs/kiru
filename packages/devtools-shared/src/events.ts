type EventsChannel<T extends Record<string, any>> = {
  channel: BroadcastChannel
  emit<K extends keyof T>(event: K, data: T[K]): void
  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): () => void
}

function createEventsChannel<T extends Record<string, any>>(
  name: string
): EventsChannel<T> {
  const channel = new BroadcastChannel(name)
  const handlerRegistry = {} as {
    [K in keyof T]: ((data: T[K]) => void)[]
  }

  channel.addEventListener("message", (event) => {
    handlerRegistry[event.data.type]?.forEach((cb) => cb(event.data))
  })

  return {
    channel,
    emit<K extends keyof T>(event: K, data: T[K]) {
      channel.postMessage({ type: event, data })
    },
    on<K extends keyof T>(
      event: K,
      callback: (data: T[K]) => void
    ): () => void {
      ;(handlerRegistry[event] ??= []).push(callback)
      return () => {
        handlerRegistry[event] = handlerRegistry[event].filter(
          (cb) => cb !== callback
        )
      }
    },
  }
}

export const devtoolsEvents = createEventsChannel<{
  ["open-editor"]: string
}>("kiru-devtools:events")
