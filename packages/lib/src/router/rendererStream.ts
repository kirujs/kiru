import { renderToReadableStream } from "../ssr/server.js"
import { serializeDocumentHead } from "./meta.js"
import { serializeRequestContextScript } from "./requestContext.js"
import { serializePageDataHeadScripts } from "./pageData.js"
import { serializeI18nScript, type HydratedI18nPayload } from "./i18nContext.js"
import { mergeRouteAndPageHead } from "./pageHead.js"
import type {
  CompiledRouteHtmlTemplate,
} from "./htmlTemplate.js"
import type {
  CustomRequestContext,
  DocumentHead,
  RouteHeadMeta,
  RouteMatch,
} from "./types.js"

export function buildStreamDocumentHead(
  meta: RouteHeadMeta,
  pathname: string,
  requestContext: CustomRequestContext,
  opts: {
    pageData?: unknown
    i18nPayload?: HydratedI18nPayload
    decorateDocument: (document: DocumentHead) => void
  }
): DocumentHead {
  const ctxScript = serializeRequestContextScript(requestContext)
  const pageDataScript =
    opts.pageData !== undefined
      ? serializePageDataHeadScripts(opts.pageData)
      : ""
  const i18nScript =
    opts.i18nPayload !== undefined ? serializeI18nScript(opts.i18nPayload) : ""
  const document: DocumentHead = {
    headHtml:
      serializeDocumentHead(meta, { pathname }) +
      (ctxScript ? `\n    ${ctxScript}` : "") +
      (i18nScript ? `\n    ${i18nScript}` : "") +
      (pageDataScript ? `\n    ${pageDataScript}` : ""),
    title: meta.title,
  }
  opts.decorateDocument(document)
  return document
}

export function serializedDataFromPageProps(
  pageProps: Record<string, unknown>
): unknown | undefined {
  if ("error" in pageProps && pageProps.error === null && "data" in pageProps) {
    return pageProps.data
  }
  return undefined
}

export function renderStreamForRouteMatch(
  app: JSX.Element,
  match: RouteMatch,
  requestContext: CustomRequestContext,
  opts: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    decorateDocument: (document: DocumentHead) => void
    pageData?: unknown
    streamHeadMeta?: RouteHeadMeta
    pagePropsPromise?: Promise<Record<string, unknown>>
    earlyFlushHead?: boolean
    i18nPayload?: HydratedI18nPayload
    documentLang?: string
    renderSignal: AbortSignal
  }
): ReadableStream<string> {
  const { pathname } = match
  const baseHeadMeta =
    opts.streamHeadMeta ??
    mergeRouteAndPageHead(match.route.head, undefined)
  const resolveHeadMeta = () => baseHeadMeta
  const mayEarlyFlush =
    !!opts.earlyFlushHead &&
    opts.compiledTemplate?.headBeforeBody === true
  let streamedHeadEarly = false

  const headWithoutPageData = () =>
    buildStreamDocumentHead(resolveHeadMeta(), pathname, requestContext, {
      decorateDocument: opts.decorateDocument,
    })

  const stream = renderToReadableStream(app, {
    requestContext,
    renderSignal: opts.renderSignal,
    onStreamStart: mayEarlyFlush
      ? (controller) => {
          const document = headWithoutPageData()
          const split = opts.compiledTemplate!.splitForStream(
            document.headHtml,
            opts.documentLang
          )
          controller.enqueue(split.prefix)
          streamedHeadEarly = true
        }
      : undefined,
    onShellReady: async (shell, controller) => {
      if (streamedHeadEarly) {
        enqueueTemplatedShellBody(controller, {
          compiledTemplate: opts.compiledTemplate,
          shell,
        })
        return
      }
      let pageData = opts.pageData
      if (opts.pagePropsPromise) {
        const props = await opts.pagePropsPromise
        pageData = serializedDataFromPageProps(props)
      }
      const document = buildStreamDocumentHead(
        resolveHeadMeta(),
        pathname,
        requestContext,
        {
          pageData,
          i18nPayload: opts.i18nPayload,
          decorateDocument: opts.decorateDocument,
        }
      )
      enqueueTemplatedShell(controller, {
        compiledTemplate: opts.compiledTemplate,
        headHtml: document.headHtml,
        shell,
        documentLang: opts.documentLang,
      })
    },
  })
  return stream
}

export function renderUnmatchedAppStream(
  app: JSX.Element,
  requestContext: CustomRequestContext,
  compiledTemplate: CompiledRouteHtmlTemplate | null,
  decorateDocument: (document: DocumentHead) => void,
  renderSignal: AbortSignal
): ReadableStream<string> {
  const document: DocumentHead = {
    headHtml: serializeRequestContextScript(requestContext),
  }
  decorateDocument(document)
  const stream = renderToReadableStream(app, {
    requestContext,
    renderSignal,
    onShellReady: (shell, controller) =>
      enqueueTemplatedShell(controller, {
        compiledTemplate,
        headHtml: document.headHtml,
        shell,
      }),
  })
  return stream
}

export function enqueueTemplatedShell(
  controller: ReadableStreamDefaultController<string>,
  args: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    headHtml: string
    shell: string
    documentLang?: string
  }
): void {
  if (!args.compiledTemplate) {
    controller.enqueue(args.shell)
    return
  }
  const split = args.compiledTemplate.splitForStream(
    args.headHtml,
    args.documentLang
  )
  controller.enqueue(split.prefix)
  controller.enqueue(args.shell)
  controller.enqueue(split.suffix)
}

export function enqueueTemplatedShellBody(
  controller: ReadableStreamDefaultController<string>,
  args: {
    compiledTemplate: CompiledRouteHtmlTemplate | null
    shell: string
  }
): void {
  if (!args.compiledTemplate) {
    controller.enqueue(args.shell)
    return
  }
  controller.enqueue(args.shell)
  controller.enqueue(args.compiledTemplate.splitForStream("").suffix)
}
