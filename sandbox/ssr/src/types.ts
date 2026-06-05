import type { CustomRequestContext } from "kiru/router"

/** Signed request context shape for sandbox SSR remotes. */
export interface SandboxRequestContext extends CustomRequestContext {
  userId?: string
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
