import type { AppHandle, AppHandleOptions } from "../../appHandle.js"
import { mount } from "../../appHandle.js"
import { createElement } from "../../element.js"
import { createRouter, RouterProvider, RouterView } from "../csr.js"
import type { InternationalizationConfig } from "../i18n/index.js"
import { ensureClientI18nReady, I18nReactiveRoot } from "../i18nContext.js"
import { ensureLoaderClient } from "../loaderClient.js"
import { loadClientHydrationChunksManifest } from "../hydrationChunks.js"
import { getRouterInstanceRuntime } from "../routerRuntime.js"
import type { RouterPathPolicy } from "../pathPolicy.js"
import type { CreateRouterAppBaseOptions } from "./types.js"

export type { CreateRouterAppBaseOptions }

/**
 * Options for {@link createRouterApp} from `kiru/router/csr` (client-only SPA).
 * Extends {@link CreateRouterAppBaseOptions} with CSR routing and {@link mount} settings.
 */
export type CreateRouterAppOptions = CreateRouterAppBaseOptions & {
  /** Base path and trailing-slash rules (forwarded to {@link createRouter}). */
  pathPolicy?: RouterPathPolicy
  /** When true, navigations use the View Transitions API where supported. */
  transition?: boolean
  /**
   * Client i18n bundles and locale detection. Waits for the active locale bundle
   * before mount when no `k-i18n` script is present in the document.
   */
  i18n?: InternationalizationConfig<readonly string[], unknown>
  /** Passed through to {@link mount} (e.g. `hydrationMode` is not used on CSR). */
  appOptions?: AppHandleOptions
}

/**
 * Mount a client-only SPA (`RouterView` + history).
 *
 * Import from `kiru/router/csr` so the bundle excludes SSR/SSG hydration code.
 */
export async function createRouterApp(
  options: CreateRouterAppOptions
): Promise<AppHandle> {
  const {
    routes,
    container,
    pathPolicy,
    transition,
    i18n,
    appOptions,
    navigationAnnouncer,
  } = options
  ensureLoaderClient()
  await loadClientHydrationChunksManifest()
  const router = createRouter({
    routes,
    pathPolicy,
    transition,
    i18n,
    navigationAnnouncer,
  })
  await ensureClientI18nReady(router)
  let outlet: JSX.Element = createElement(RouterView, {})
  const i18nRuntime = getRouterInstanceRuntime(router).i18n?.runtime
  if (i18nRuntime) {
    outlet = createElement(I18nReactiveRoot, {
      runtime: i18nRuntime,
      children: outlet,
    })
  }
  return mount(
    createElement(RouterProvider, {
      router,
      children: outlet,
    }),
    container,
    appOptions
  )
}
