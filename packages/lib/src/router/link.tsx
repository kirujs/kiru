import { createElement } from "../element.js"
import { setup } from "../hooks/index.js"
import { onMount } from "../hooks/onMount.js"
import { runLinkPrefetch, type LinkPrefetch } from "./prefetchRoute.js"
import type { RouterLocaleParam } from "./i18n/augmentation.js"
import { useRouter } from "./routerContext.js"

export type { LinkPrefetch } from "./prefetchRoute.js"

export type LinkProps = JSX.IntrinsicElements["a"] & {
  to: string
  replace?: boolean
  /** @default `{ trigger: "hover", chunks: true, data: true }` when loader RPC exists */
  prefetch?: LinkPrefetch
  /**
   * Prepends a locale path segment for `to`.
   * When i18n is configured (`declare module "kiru/router" { interface Internationalization … }`),
   * must be one of your configured locales. Use `false` when `to` already includes a prefix.
   */
  locale?: RouterLocaleParam
  children?: JSX.Children
}

export const Link: Kiru.Component<LinkProps> = () => {
  const $ = setup<typeof Link>()
  const router = useRouter()

  const href = $.derive(({ to, locale }) =>
    router.resolveHref(
      to,
      locale === false ? { locale: false } : locale ? { locale } : undefined
    )
  )
  const runHoverPrefetch = () => {
    const p = $.props.prefetch
    const resolved =
      p === false
        ? false
        : { trigger: "hover" as const, chunks: true, data: true, ...p }
    if (resolved === false || resolved.trigger === "visible") return
    runLinkPrefetch(
      router as import("./clientRoutePrep.js").ClientOutletRouter & {
        manifest: typeof router.manifest
        baseUrl: string
        navigationMode: string
      },
      href.peek(),
      resolved
    )
  }

  const onpointerenter: Kiru.PointerEventHandler<HTMLAnchorElement> = (event) => {
    $.props.onpointerenter?.(event)
    if (event.defaultPrevented) return
    runHoverPrefetch()
  }

  const onmouseenter: Kiru.MouseEventHandler<HTMLAnchorElement> = (event) => {
    $.props.onmouseenter?.(event)
    if (event.defaultPrevented) return
    runHoverPrefetch()
  }

  onMount(() => {
    const p = $.props.prefetch
    const resolved =
      p === false
        ? false
        : { trigger: "hover" as const, chunks: true, data: true, ...p }
    if (resolved !== false && resolved.trigger === "visible") {
      runLinkPrefetch(
        router as import("./clientRoutePrep.js").ClientOutletRouter & {
          manifest: typeof router.manifest
          baseUrl: string
          navigationMode: string
        },
        href.peek(),
        resolved
      )
    }
  })

  const onclick: Kiru.MouseEventHandler<HTMLAnchorElement> = (event) => {
    $.props.onclick?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const { to, replace, locale: linkLocale } = $.props
    void router.navigate(
      to,
      linkLocale !== undefined ? { replace, locale: linkLocale } : replace
    )
  }

  return ({ to, replace, children, ...rest }) =>
    createElement("a", {
      children,
      href,
      onpointerenter,
      onmouseenter,
      onclick,
      ...rest,
    })
}
