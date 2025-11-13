import type { ViteDevServer } from "vite"

export const VITE_DEV_SERVER_INSTANCE = {
  get current() {
    return (
      // @ts-ignore
      (globalThis.KIRU_VITE_DEV_SERVER_INSTANCE ?? null) as ViteDevServer | null
    )
  },
  set current(server: ViteDevServer | null) {
    // @ts-ignore
    globalThis.KIRU_VITE_DEV_SERVER_INSTANCE = server
  },
}
