import { createContext, useContext } from "../context.js"
import { createElement } from "../element.js"
import type { CustomRequestContext } from "./types.js"

export const REQUEST_CONTEXT_SCRIPT_ID = "__kiru_request_context__"

const RequestContext = createContext<CustomRequestContext>({})

export function RequestContextProvider({
  value,
  children,
}: {
  value: CustomRequestContext
  children?: JSX.Children
}) {
  return createElement(RequestContext, { value, children })
}

export function useOptionalRequestContext(): CustomRequestContext {
  return useContext(RequestContext)
}

export function useRequestContext(): CustomRequestContext {
  const ctx = useContext(RequestContext)
  if (!ctx) {
    throw new Error(
      "[kiru/router] useRequestContext must be used during SSR/initial hydration inside RequestContextProvider"
    )
  }
  return ctx
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
  return `<script id="${REQUEST_CONTEXT_SCRIPT_ID}" type="application/json">${json}</script>`
}

export function readHydratedRequestContext(): CustomRequestContext {
  if (typeof document === "undefined") return {}
  const el = document.getElementById(REQUEST_CONTEXT_SCRIPT_ID)
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
