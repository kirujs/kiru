import { Derive } from "../components/derive.js"
import { createElement } from "../element.js"
import { resource } from "../resource.js"
import type { KiruLoader, LoaderContext, PageProps } from "./loaders.js"
import { buildPageErrorProps, buildPageProps } from "./runPageLoad.js"
import type { RouteModule } from "./types.js"

function asComponent(
  module: RouteModule
): Kiru.Component<PageProps<KiruLoader<unknown>>> {
  const c = typeof module === "function" ? module : module.default
  return c as Kiru.Component<PageProps<KiruLoader<unknown>>>
}

/**
 * SSR/CSR: stream the route shell while `load` is in flight, using `fallback`
 * until {@link PageProps} are ready.
 */
export function wrapRouteModuleWithLoadGate(
  routeModule: RouteModule,
  load: KiruLoader,
  loaderCtx: LoaderContext,
  fallback: () => JSX.Element
): RouteModule {
  const Page = asComponent(routeModule)
  const Gated: Kiru.Component<Record<string, never>> = () => {
    const pending = resource(async ({ signal }) => {
      const ctx: LoaderContext = {
        ...loaderCtx,
        signal,
      }
      try {
        const data = await load.__kiruInvoke(ctx)
        return buildPageProps(data)
      } catch (err) {
        if (signal.aborted) throw err
        return buildPageErrorProps(err)
      }
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
