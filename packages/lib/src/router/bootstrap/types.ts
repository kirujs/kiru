import type { RouteManifest, RouteTreeDefinition } from "../types.js"

export type CreateRouterAppBaseOptions = {
  routes: RouteTreeDefinition | RouteManifest
  container: HTMLElement
}
