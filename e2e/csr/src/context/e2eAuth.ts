import type { CustomRequestContext, ResolveContextEvent } from "kiru/router"

export type E2eAuthMode = "anonymous" | "user" | "slow"

declare global {
  interface Window {
    __E2E_AUTH__?: E2eAuthMode
  }
}

declare module "kiru/router" {
  interface CustomRequestContext {
    user: { id: string; name: string } | null
  }
}

export function readE2eAuthMode(): E2eAuthMode {
  if (typeof window === "undefined") return "anonymous"
  const stored = sessionStorage.getItem("kiru-e2e-auth")
  return (window.__E2E_AUTH__ ?? stored ?? "anonymous") as E2eAuthMode
}

export async function e2eResolveContext(
  _event: ResolveContextEvent
): Promise<CustomRequestContext> {
  const mode = readE2eAuthMode()
  if (mode === "slow") {
    await new Promise((resolve) => setTimeout(resolve, 800))
  }
  if (mode === "user") {
    return { user: { id: "e2e", name: "E2E User" } }
  }
  return { user: null }
}

export function setE2eAuth(mode: E2eAuthMode): void {
  if (typeof window !== "undefined") {
    window.__E2E_AUTH__ = mode
    sessionStorage.setItem("kiru-e2e-auth", mode)
  }
}
