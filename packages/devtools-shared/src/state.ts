import { Signal, signal, type AppHandle } from "kiru"

export let kiruGlobal!: typeof window.__kiru
if ("window" in globalThis) {
  kiruGlobal = window.opener?.__kiru ?? window.__kiru
}

type SyncedState<T extends Record<string, unknown>> = {
  [K in keyof T]: Signal<T[K]>
}

type SyncedStateBroadcastData<
  T extends Record<string, unknown>,
  K extends keyof T,
> =
  | {
      version: number
      type: "SET"
      key: K
      value: T[K]
    }
  | {
      type: "GET"
      key: K
    }

function createSyncedState<T extends Record<string, unknown>>(
  channelName: string,
  initial: T
): [state: SyncedState<T>, dispose: () => void] {
  const broadcastChannel = new BroadcastChannel(channelName)
  const emit = (message: SyncedStateBroadcastData<T, keyof T>) => {
    broadcastChannel.postMessage(message)
  }

  const versions = {} as { [K in keyof T]: number }
  const syncedState = {} as SyncedState<T>
  const messageHandlers = {} as {
    [K in keyof T]: (data: SyncedStateBroadcastData<T, K>) => void
  }

  for (const key in initial) {
    const state: Signal<T[keyof T]> = (syncedState[key] = signal(initial[key]))
    versions[key] = 0

    messageHandlers[key] = (data) => {
      if (data.type === "GET") {
        const value = state.value
        const version = versions[key]
        return emit({ type: "SET", key, value, version })
      }

      if (data.version > versions[key]) {
        state.value = data.value
        versions[key] = data.version
      }
    }

    state.subscribe((value) => {
      const version = ++versions[key]
      emit({ type: "SET", key, value, version })
    })
  }

  broadcastChannel.addEventListener(
    "message",
    ({ data }: MessageEvent<SyncedStateBroadcastData<T, keyof T>>) => {
      messageHandlers[data.key](data)
    }
  )

  for (const key in syncedState) emit({ type: "GET", key })

  const dispose = () => {
    broadcastChannel.close()
    Object.values(syncedState).forEach((s) => Signal.dispose(s))
  }

  return [syncedState, dispose]
}

const [state] = createSyncedState("kiru-devtools:syncedState", {
  vNodeSelection: {
    enabled: false,
    vNode: null as Kiru.VNode | null,
  },
  popupWindow: null as Window | null,
  selectedApp: null as AppHandle | null,
  selectedNode: null as Kiru.VNode | null,
})

export { state }
