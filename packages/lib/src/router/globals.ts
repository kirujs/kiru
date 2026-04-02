import type { RouterCache } from "./cache.js"
import type { FileRouterController } from "./fileRouterController.js"

export const fileRouterInstance = {
  current: null as FileRouterController | null,
}

export const fileRouterRoute = {
  current: null as string | null,
}

export const routerCache = {
  current: null as RouterCache | null,
}
