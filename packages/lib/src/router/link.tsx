import { createElement } from "../element.js"
import { setup } from "../hooks/index.js"
import { onMount } from "../hooks/onMount.js"
import {
  resolveLinkPrefetch,
  runLinkPrefetch,
  type LinkPrefetch,
} from "./prefetchRoute.js"
import type { RouterLocaleParam } from "./i18n/augmentation.js"
import {
  interpolateRoutePath,
  type HasRouteParams,
  type IsRouteRegistryConfigured,
  type NavigatePath,
  type NavigateParamsOption,
  type RouteParams,
} from "./routePaths.js"
import { useRouter } from "./routerContext.js"

export type { LinkPrefetch } from "./prefetchRoute.js"

type LinkBase = Omit<JSX.IntrinsicElements["a"], "href"> & {
  replace?: boolean
  /** @default `{ trigger: "hover", chunks: true, data: true }` when loader RPC exists */
  prefetch?: LinkPrefetch
  /**
   * Prepends a locale path segment for `to`.
   * When i18n is configured (`declare module "kiru/router" { interface Internationalization … }`),
   * must be one of your configured locales. Use `false` when `to` already includes a prefix.
   */
  locale?: RouterLocaleParam
  children?: JSX.Element
}

export type LinkProps = IsRouteRegistryConfigured extends true
  ? {
      [P in NavigatePath]: LinkBase & { to: P } & NavigateParamsOption<P>
    }[NavigatePath]
  : LinkBase & {
      to: string
      params?: Record<string, string | undefined>
    }

function resolveLinkTo(
  to: NavigatePath | string,
  params?: Record<string, string | undefined>
): string {
  if (params && Object.keys(params).length > 0) {
    return interpolateRoutePath(String(to), params)
  }
  return String(to)
}

export const Link: Kiru.Component<LinkProps> = () => {
  const $ = setup<typeof Link>()
  const router = useRouter()

  const href = $.derive(({ to, params }) => {
    const resolved = resolveLinkTo(
      to as NavigatePath | string,
      params as Record<string, string | undefined> | undefined
    )
    const { locale } = $.props
    return router.resolveHref(
      resolved,
      locale === false ? { locale: false } : locale ? { locale } : undefined
    )
  })

  const maybePrefetch = (trigger: "hover" | "visible") => {
    const prefetch = $.props.prefetch
    const resolved = resolveLinkPrefetch(prefetch)
    if (resolved === false || resolved.trigger !== trigger) return
    runLinkPrefetch(router, href.peek(), prefetch)
  }

  onMount(() => maybePrefetch("visible"))

  const onpointerenter: Kiru.PointerEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    $.props.onpointerenter?.(event)
    if (event.defaultPrevented) return
    maybePrefetch("hover")
  }

  const onclick: Kiru.MouseEventHandler<HTMLAnchorElement> = (event) => {
    $.props.onclick?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const { to, replace, locale: linkLocale, params } = $.props
    const target = resolveLinkTo(to, params)
    void router.navigate(
      target,
      linkLocale !== undefined ? { replace, locale: linkLocale } : replace
    )
  }

  return ({ to, replace, params, children, ...rest }) =>
    createElement("a", {
      ...rest,
      children,
      href,
      onpointerenter,
      onclick,
    })
}

export type { RouteParams, NavigatePath, HasRouteParams }
