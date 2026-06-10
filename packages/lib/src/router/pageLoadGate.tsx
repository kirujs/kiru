import { Derive } from "../components/derive.js"
import { createElement } from "../element.js"
import { signal } from "../signals/base.js"
import { resource } from "../resource.js"
import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { buildPageErrorProps, buildPageProps } from "./runPageLoad.js"
import type { PageModule } from "./types.js"
import { onMount } from "../hooks/onMount.js"
import {
  bootstrapStreamedHydration,
  readHydratedPageData,
  readStreamedPagePropsForHydrate,
  registerStreamPageLoadResult,
} from "./pageData.js"

function asComponent(
  module: PageModule
): Kiru.Component<PageProps<KiruLoader<unknown>>> {
  const c = typeof module === "function" ? module : module.default
  return c as Kiru.Component<PageProps<KiruLoader<unknown>>>
}

/**
 * SSR/CSR: stream the route shell while `load` is in flight, using `fallback`
 * until {@link PageProps} are ready.
 */
export function wrapRouteModuleWithLoadGate(
  routeModule: PageModule,
  load: KiruLoader,
  loaderCtx: LoaderContext,
  fallback: () => JSX.Element
): PageModule {
  const Page = asComponent(routeModule)
  const Gated: Kiru.Component<Record<string, never>> = () => {
    /** Wait until tail stream replay before resolving the gate on the client. */
    const hydrateTick = signal(typeof window === "undefined" ? 0 : -1)
    const pending = resource({
      source: hydrateTick,
      load: async (_source, { signal }) => {
        if (hydrateTick.peek() < 0) {
          return new Promise(() => {})
        }
        const ctx: LoaderContext = {
          ...loaderCtx,
          signal,
        }
        try {
          if (typeof document !== "undefined") {
            const hydrated = readHydratedPageData()
            if (hydrated !== undefined) {
              return buildPageProps(hydrated)
            }
          }
          const streamed = readStreamedPagePropsForHydrate()
          if (streamed) return streamed
          const data = await load.__kiruInvoke(ctx)
          if (typeof window === "undefined") {
            registerStreamPageLoadResult(data)
          }
          return buildPageProps(data)
        } catch (err) {
          if (signal.aborted) throw err
          return buildPageErrorProps(err)
        }
      },
    })

    onMount(() => {
      queueMicrotask(() => {
        bootstrapStreamedHydration()
        hydrateTick.value = 0
      })
    })

    const props = {
      from: pending,
      get fallback() {
        return fallback()
      },
    }
    return () =>
      createElement(Derive, props, (props: Record<string, unknown>) =>
        createElement(Page, props)
      )
  }
  return { default: Gated }
}
