import type { AppContext } from "kiru"

const BROADCAST_CHANNEL_NAME = "kiru-devtools"

declare global {
  interface Window {
    __devtoolsSelection: {
      node: Kiru.VNode
      app: AppContext
    } | null
  }
}

if ("window" in globalThis) {
  window.__devtoolsSelection ??= null
}

export const BROADCAST_MSG_TYPES = {
  SET_INSPECT_ENABLED: "set-inspect-enabled",
  SELECT_NODE: "select-node",
  OPEN_EDITOR: "open-editor",
  READY: "ready",
} as const

export type BroadcastChannelMessage =
  | {
      type: typeof BROADCAST_MSG_TYPES.SET_INSPECT_ENABLED
      value: boolean
    }
  | {
      type: typeof BROADCAST_MSG_TYPES.SELECT_NODE
    }
  | {
      type: typeof BROADCAST_MSG_TYPES.OPEN_EDITOR
      fileLink: string
    }
  | {
      type: typeof BROADCAST_MSG_TYPES.READY
    }

class TypedBroadcastChannel<T> extends BroadcastChannel {
  send(data: T) {
    super.postMessage(data)
  }

  // @ts-expect-error heck u ts
  removeEventListener(listener: (e: MessageEvent<T>) => void): void {
    return super.removeEventListener("message", listener)
  }

  // @ts-expect-error heck u ts
  addEventListener(listener: (e: MessageEvent<T>) => void): void {
    return super.addEventListener("message", listener)
  }
}

export const broadcastChannel =
  new TypedBroadcastChannel<BroadcastChannelMessage>(BROADCAST_CHANNEL_NAME)
