import { createContext, useContext } from "../context.js"
import { createElement } from "../element.js"
import type { CustomRequestContext } from "./types.js"

export const REQUEST_CONTEXT_SCRIPT_ID = "__kiru_request_context__"

export type RequestContextValue = CustomRequestContext | null

const RequestContext = createContext<RequestContextValue>(null)

export function RequestContextProvider({
  value,
  children,
}: {
  value: RequestContextValue
  children?: JSX.Children
}) {
  return createElement(RequestContext, { value, children })
}

export function useOptionalRequestContext(): RequestContextValue {
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
  // Prevent breaking out of <script> and reduce XSS surface.
  return json.replace(/</g, "\\u003c")
}

export function serializeRequestContextScript(
  ctx: RequestContextValue
): string {
  if (!ctx) return ""
  const json = escapeScriptJson(JSON.stringify(ctx))
  return `<script id="${REQUEST_CONTEXT_SCRIPT_ID}" type="application/json">${json}</script>`
}

export function readHydratedRequestContext(): RequestContextValue {
  if (typeof document === "undefined") return null
  const el = document.getElementById(REQUEST_CONTEXT_SCRIPT_ID)
  if (!el) return null
  try {
    const parsed = JSON.parse(el.textContent || "null") as RequestContextValue
    el.remove()
    return parsed
  } catch {
    el.remove()
    return null
  }
}
