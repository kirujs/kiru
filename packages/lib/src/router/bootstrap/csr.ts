import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import { mount } from "../../appHandle.js"
import { createElement } from "../../element.js"
import { createRouter, RouterProvider, RouterView } from "../csr.js"
import type { InternationalizationConfig } from "../i18n/index.js"
import { I18nReactiveRoot } from "../i18nContext.js"
import { RequestContextProvider } from "../requestContext.js"
import { markRouterBootstrap } from "../devWarnings.js"
import type { RouterPathPolicy } from "../pathPolicy.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  pathPolicy?: RouterPathPolicy
  /** Enable view transitions on client navigation. */
  transition?: boolean
  /** Same config as {@link createRenderer} / {@link createRouter}. */
  i18n?: InternationalizationConfig<readonly string[], unknown>
  /** Passed to {@link mount}. */
  appOptions?: AppHandleOptions
}

/**
 * Mount a client-only SPA (`RouterView` + history).
 *
 * Import from `kiru/router/csr` so the bundle excludes SSR/SSG hydration code.
 */
export function createRouterApp(options: CreateRouterAppOptions): AppHandle {
  const { routes, container, pathPolicy, transition, i18n, appOptions } = options
  markRouterBootstrap("csr")
  const router = createRouter({ routes, pathPolicy, transition, i18n })
  let outlet: JSX.Element = createElement(RouterView, {})
  if (router.__i18n) {
    outlet = createElement(I18nReactiveRoot, {
      runtime: router.__i18n.runtime,
      children: outlet,
    })
  }
  return mount(
    createElement(RequestContextProvider, {
      value: {},
      children: createElement(RouterProvider, {
        router,
        children: outlet,
      }),
    }),
    container,
    appOptions
  )
}
