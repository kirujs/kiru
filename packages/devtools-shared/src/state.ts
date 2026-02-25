import { Signal, signal, type AppHandle } from "kiru"

export let kiruGlobal!: typeof window.__kiru
if ("window" in globalThis) {
  kiruGlobal = window.opener?.__kiru ?? window.__kiru
}

type SyncedState<T extends Record<string, unknown>> = {
  state: {
    [K in keyof T]: Signal<T[K]>
  }
  dispose: () => void
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
): SyncedState<T> {
  const broadcastChannel = new BroadcastChannel(channelName)
  const emit = (message: SyncedStateBroadcastData<T, keyof T>) => {
    broadcastChannel.postMessage(message)
  }

  const syncedState = {
    state: {},
    dispose() {
      broadcastChannel.close()
      Object.values(this.state).forEach((s) => Signal.dispose(s))
    },
  } as SyncedState<T>

  const versions = {} as { [K in keyof T]: number }

  const messageHandlers: ((
    data: SyncedStateBroadcastData<T, keyof T>
  ) => void)[] = []

  broadcastChannel.addEventListener(
    "message",
    ({ data }: MessageEvent<SyncedStateBroadcastData<T, keyof T>>) => {
      messageHandlers.forEach((handler) => handler(data))
    }
  )

  for (const key in initial) {
    const state: Signal<T[keyof T]> = (syncedState.state[key] = signal(
      initial[key]
    ))
    versions[key] = 0

    const handler = (data: SyncedStateBroadcastData<T, keyof T>) => {
      if (data.key !== key) return
      if (data.type === "GET") {
        return emit({
          type: "SET",
          key: key,
          version: versions[key],
          value: state.value,
        })
      }
      if (data.version > versions[key]) {
        state.value = data.value
        versions[key] = data.version
      }
    }
    messageHandlers.push(handler)

    state.subscribe((value) =>
      emit({
        type: "SET",
        key: key,
        version: ++versions[key],
        value,
      })
    )

    broadcastChannel.postMessage({
      type: "GET",
      key: key,
    } satisfies SyncedStateBroadcastData<T, keyof T>)
  }

  return syncedState
}

const { state } = createSyncedState("kiru-devtools:syncedState", {
  vNodeSelection: {
    enabled: false,
    vNode: null as Kiru.VNode | null,
  },
  popupWindow: null as Window | null,
  selectedApp: null as AppHandle | null,
  selectedNode: null as Kiru.VNode | null,
})

export { state }
