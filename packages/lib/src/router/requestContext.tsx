import { createContext, useContext } from "../context.js"
import { createElement } from "../element.js"
import { __getSsrRequestContext } from "../remote/action.js"
import type { CustomRequestContext } from "./types.js"

const RequestContext = createContext<CustomRequestContext>({})

export function RequestContextProvider({
  value,
  children,
}: {
  value: CustomRequestContext
  children?: JSX.Element
}) {
  return createElement(RequestContext, { value, children })
}

export function useOptionalRequestContext(): CustomRequestContext {
  return useContext(RequestContext)
}

/** Per-request context; `{}` when not provided (pure CSR/SSG or outside a provider). */
export function useRequestContext(): CustomRequestContext {
  const fromProvider = useOptionalRequestContext()
  if (fromProvider && Object.keys(fromProvider).length > 0) {
    return fromProvider
  }
  const fromSsr = __getSsrRequestContext()
  if (fromSsr && Object.keys(fromSsr).length > 0) {
    return fromSsr
  }
  return fromProvider ?? {}
}

function escapeScriptJson(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function serializeRequestContextScript(
  ctx: CustomRequestContext | null | undefined
): string {
  if (!ctx) return ""
  const json = escapeScriptJson(JSON.stringify(ctx))
  return `<script type="application/json" k-request-context>${json}</script>`
}

export function readHydratedRequestContext(): CustomRequestContext {
  if (typeof document === "undefined") return {}
  const el = document.querySelector("script[k-request-context]")
  if (!el) return {}
  try {
    const parsed = JSON.parse(el.textContent || "{}") as CustomRequestContext
    el.remove()
    return parsed
  } catch {
    el.remove()
    return {}
  }
}
