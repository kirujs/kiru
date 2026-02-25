import { Signal, signal, type AppHandle } from "kiru"

const stateRegister: Record<string, any> = ((window.opener ?? window)[
  "__kiru_devtools_state_register"
] ??= {})

export const kiruGlobal = (): typeof window.__kiru => {
  return window.opener?.__kiru ?? window.__kiru
}

type SyncedState<T extends Record<string, unknown>> = {
  [K in keyof T & string]: Signal<T[K]>
}

type SyncedStateBroadcastData<T extends Record<string, unknown>> =
  | {
      version: number
      type: "SET"
      key: keyof T & string
    }
  | {
      type: "GET"
      key: keyof T & string
    }

function createSyncedState<T extends Record<string, unknown>>(
  channelName: string,
  initial: T
): [state: SyncedState<T>, dispose: () => void] {
  const broadcastChannel = new BroadcastChannel(channelName)
  const emit = (message: SyncedStateBroadcastData<T>, value?: unknown) => {
    if (message.type === "SET") {
      const { key, version } = message
      stateRegister[key] = value
      return broadcastChannel.postMessage({ type: "SET", key, version })
    }
    broadcastChannel.postMessage(message)
  }

  const versions = {} as { [K in keyof T]: number }
  const syncedState = {} as SyncedState<T>
  const messageHandlers = {} as {
    [K in keyof T & string]: (data: SyncedStateBroadcastData<T>) => void
  }

  for (const key in initial) {
    const state: Signal<T[keyof T & string]> = (syncedState[key] = signal(
      initial[key]
    ))
    versions[key] = 0

    messageHandlers[key] = (data) => {
      if (data.type === "GET") {
        const value = state.value
        const version = versions[key]
        return emit({ type: "SET", key, version }, value)
      }

      if (data.version > versions[key]) {
        state.value = stateRegister[key]
        versions[key] = data.version
      }
    }

    state.subscribe((value) => {
      const version = ++versions[key]
      emit({ type: "SET", key, version }, value)
    })
  }

  broadcastChannel.addEventListener(
    "message",
    ({ data }: MessageEvent<SyncedStateBroadcastData<T>>) => {
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

const [devtoolsState] = createSyncedState("kiru-devtools:syncedState", {
  vNodeSelection: {
    enabled: false,
    vNode: null as Kiru.VNode | null,
  },
  popupWindow: null as Window | null,
  selectedApp: null as AppHandle | null,
  selectedNode: null as Kiru.VNode | null,
})

export { devtoolsState }
