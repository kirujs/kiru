import { renderToString } from "../renderToString.js"
import { renderToReadableStream } from "../ssr/server.js"
import { serializeRequestContextScript } from "./requestContext.js"
import type { CompiledRouteHtmlTemplate } from "./htmlTemplate.js"
import { runWithSsrRequestContext } from "../remote/action.js"
import {
  loadErrorRouteTree,
  loadRootErrorRouteTree,
} from "./routeTree.js"
import type {
  CustomRequestContext,
  DocumentHead,
  ErrorPageProps,
  RouteManifest,
  RouteMatch,
} from "./types.js"
import type { RouterPathPolicy } from "./pathPolicy.js"
import { parseRequestUrl } from "./requestUrl.js"
import { toRenderError } from "./types.js"
import { isAbortError } from "./navigationScope.js"
import type { KiruDeployTarget } from "@kirujs/runtime"
import { isEdgeDeployTarget } from "@kirujs/runtime"
import {
  makeKiruContextToken,
  makeKiruContextTokenAsync,
} from "../remote/index.js"
import { DEFAULT_SSR_HEADERS } from "./prepareAppForUrl.js"
import { enqueueTemplatedShell } from "./rendererStream.js"
import { buildAppElement } from "./ssrAppBuild.js"

export type SsrRenderHit =
  | {
      kind: "string"
      result: {
        status: number
        headers: Record<string, string>
        body: string
      }
    }
  | {
      kind: "stream"
      result: {
        status: number
        headers: Record<string, string>
        body: ReadableStream<string>
      }
    }

export type RenderSsrErrorRecoveryInput = {
  caught: unknown
  url: string
  manifest: RouteManifest
  pathPolicy?: RouterPathPolicy
  requestedPathname: string
  failureContext?: {
    match: RouteMatch | null
    requestContext: CustomRequestContext
    pathname: string
  }
  fallbackContext?: CustomRequestContext
  renderSignal: AbortSignal
  stream: boolean
  compiledTemplate: CompiledRouteHtmlTemplate | null
  actionsSecret?: string
  deployTarget?: KiruDeployTarget
}

export async function renderSsrErrorRecovery(
  input: RenderSsrErrorRecoveryInput
): Promise<SsrRenderHit | null> {
  if (isAbortError(input.caught)) return null
  const renderErr = toRenderError(input.caught)

  let recovery:
    | { app: JSX.Element; requestContext: CustomRequestContext }
    | undefined
  try {
    const tree =
      input.failureContext?.match != null
        ? await loadErrorRouteTree(input.failureContext.match)
        : await loadRootErrorRouteTree(input.manifest)
    if (tree) {
      const requestContext =
        input.failureContext?.requestContext ??
        (input.fallbackContext ?? {})
      recovery = {
        app: buildAppElement(
          input.failureContext?.pathname ?? input.requestedPathname,
          input.failureContext?.match?.params ?? {},
          tree.layoutModules,
          tree.routeModule,
          input.manifest,
          requestContext,
          { error: renderErr } satisfies ErrorPageProps,
          {
            url: parseRequestUrl(input.url),
            pathPolicy: input.pathPolicy,
          }
        ),
        requestContext,
      }
    }
  } catch {
    recovery = undefined
  }

  if (recovery) {
    const { app: recoveryApp, requestContext: recoveryCtx } = recovery
    const recoveryTokenInsertion = await buildActionTokenInsertion(
      recoveryCtx,
      input.actionsSecret,
      input.deployTarget ?? "node"
    )
    if (input.stream) {
      const document: DocumentHead = {
        headHtml: serializeRequestContextScript(recoveryCtx),
      }
      if (recoveryTokenInsertion) {
        document.headHtml += recoveryTokenInsertion
      }
      const stream = runWithSsrRequestContext(
        recoveryCtx,
        input.renderSignal,
        () =>
          renderToReadableStream(recoveryApp, {
            requestContext: recoveryCtx,
            renderSignal: input.renderSignal,
            onShellReady: (shell, controller) =>
              enqueueTemplatedShell(controller, {
                compiledTemplate: input.compiledTemplate,
                headHtml: document.headHtml,
                shell,
              }),
          })
      )
      return {
        kind: "stream",
        result: {
          status: 500,
          headers: { ...DEFAULT_SSR_HEADERS, "transfer-encoding": "chunked" },
          body: stream,
        },
      }
    }

    const body = runWithSsrRequestContext(recoveryCtx, input.renderSignal, () =>
      renderToString(recoveryApp)
    )

    const documentHead: DocumentHead = {
      headHtml: serializeRequestContextScript(recoveryCtx),
    }
    if (recoveryTokenInsertion) {
      documentHead.headHtml += recoveryTokenInsertion
    }
    const fullHead =
      documentHead.headHtml +
      (documentHead.headEndHtml ? `\n    ${documentHead.headEndHtml}` : "")
    const fullBody = body + (documentHead.bodyEndHtml ?? "")
    return {
      kind: "string",
      result: {
        status: 500,
        headers: DEFAULT_SSR_HEADERS,
        body:
          input.compiledTemplate !== null
            ? input.compiledTemplate.render(fullBody, fullHead)
            : fullBody,
      },
    }
  }

  const body = `<!DOCTYPE html><html><head><title>Error</title></head><body><pre>${String(
    renderErr.message
  ).replace(/</g, "&lt;")}</pre></body></html>`
  if (input.stream) {
    return {
      kind: "stream",
      result: {
        status: 500,
        headers: { ...DEFAULT_SSR_HEADERS },
        body: new ReadableStream<string>({
          start(controller) {
            controller.enqueue(body)
            controller.close()
          },
        }),
      },
    }
  }
  return {
    kind: "string",
    result: {
      status: 500,
      headers: DEFAULT_SSR_HEADERS,
      body,
    },
  }
}

async function buildActionTokenInsertion(
  requestContext: CustomRequestContext,
  secret: string | undefined,
  deployTarget: KiruDeployTarget
): Promise<string> {
  if (!secret || !requestContext) return ""
  const tag = isEdgeDeployTarget(deployTarget)
    ? await serializeKiruRequestTokenScriptAsync(requestContext, secret)
    : serializeKiruRequestTokenScript(requestContext, secret, deployTarget)
  return tag ? `\n    ${tag}` : ""
}

function serializeKiruRequestTokenScript(
  ctx: CustomRequestContext,
  secret: string,
  deployTarget: KiruDeployTarget
): string {
  if (!ctx) return ""
  if (isEdgeDeployTarget(deployTarget)) {
    throw new Error(
      "[kiru] serializeKiruRequestTokenScript is synchronous and unsupported on cloudflare; use serializeKiruRequestTokenScriptAsync"
    )
  }
  const token = makeKiruContextToken(ctx, secret)
  return `<script type="application/json" k-request-token>${token}</script>`
}

async function serializeKiruRequestTokenScriptAsync(
  ctx: CustomRequestContext,
  secret: string
): Promise<string> {
  if (!ctx) return ""
  const token = await makeKiruContextTokenAsync(
    ctx as Record<string, unknown>,
    secret
  )
  return `<script type="application/json" k-request-token>${token}</script>`
}
