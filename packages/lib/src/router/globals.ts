import type { FileRouterController } from "./fileRouterController"

export const fileRouterInstance = {
  current: null as FileRouterController | null,
}

export const fileRouterRoute = {
  current: null as string | null,
}
