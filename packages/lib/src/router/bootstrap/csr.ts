import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import { mount } from "../../appHandle.js"
import { createElement } from "../../element.js"
import { createRouter, RouterProvider, RouterView } from "../csr.js"
import { RequestContextProvider } from "../requestContext.js"
import { markRouterBootstrap } from "../devWarnings.js"
import type { RouterPathPolicy } from "../pathPolicy.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  pathPolicy?: RouterPathPolicy
  /** Enable view transitions on client navigation. */
  transition?: boolean
  /** Passed to {@link mount}. */
  appOptions?: AppHandleOptions
}

/**
 * Mount a client-only SPA (`RouterView` + history).
 *
 * Import from `kiru/router/csr` so the bundle excludes SSR/SSG hydration code.
 */
export function createRouterApp(options: CreateRouterAppOptions): AppHandle {
  const { routes, container, pathPolicy, transition, appOptions } = options
  markRouterBootstrap("csr")
  const router = createRouter({ routes, pathPolicy, transition })
  return mount(
    createElement(RequestContextProvider, {
      value: {},
      children: createElement(RouterProvider, {
        router,
        children: createElement(RouterView, {}),
      }),
    }),
    container,
    appOptions
  )
}
