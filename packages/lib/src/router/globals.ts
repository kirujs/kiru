import type { RouterCache } from "./cache"
import type { FileRouterController } from "./fileRouterController"

export const fileRouterInstance = {
  current: null as FileRouterController | null,
}

export const fileRouterRoute = {
  current: null as string | null,
}

export const routerCache = {
  current: null as RouterCache | null,
}

export const requestContext = {
  current: {} as Kiru.RequestContext,
}
