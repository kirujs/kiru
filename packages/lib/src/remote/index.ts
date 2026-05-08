import { AsyncLocalStorage } from "async_hooks"
import type { CustomRequestContext } from "../router/types.js"
import { unwrapKiruToken } from "./token.js"

type RequestContext = Record<string, unknown>

const als = new AsyncLocalStorage<RequestContext>()
const registry: Record<string, Record<string, unknown>> = {}

export const __INTERNAL_REMOTE_REGISTRY = {
  register(id: string, fns: Record<string, unknown>): void {
    registry[id] = fns
  },
}

export function getRequestContext(): CustomRequestContext {
  const context = als.getStore()
  if (!context) {
    throw new Error("[kiru/remote]: Invalid `getRequestContext` invocation.")
  }
  return context as CustomRequestContext
}

export function createRemoteActionHandler(
  secret: string
): (request: Request) => Promise<Response | null> {
  return async (request: Request) => {
    try {
      if (request.method !== "POST") return null
      if (request.headers.get("content-type") !== "application/json")
        return null

      const actionId = new URL(request.url).searchParams.get("action")
      const token = request.headers.get("x-kiru-token")
      if (!actionId || !token) return null

      const split = actionId.indexOf(":")
      if (split < 1) {
        return new Response(null, { status: 500 })
      }
      const routeId = actionId.slice(0, split)
      const actionName = actionId.slice(split + 1)

      const context = unwrapKiruToken(token, secret)
      if (!context) {
        return new Response(null, { status: 500 })
      }

      const action = registry[routeId]?.[actionName] as
        | ((...args: unknown[]) => unknown)
        | undefined
      const args = await request.json()
      if (typeof action !== "function" || !Array.isArray(args)) {
        return new Response(null, { status: 500 })
      }

      return await new Promise<Response>((resolve) => {
        als.run(context, async () => {
          try {
            const result = await action(...args)
            resolve(
              new Response(JSON.stringify(result), {
                status: 200,
                headers: {
                  "content-type": "application/json; charset=utf-8",
                },
              })
            )
          } catch {
            resolve(new Response(null, { status: 500 }))
          }
        })
      })
    } catch {
      return new Response(null, { status: 500 })
    }
  }
}
