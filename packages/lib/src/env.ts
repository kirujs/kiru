const NODE_ENV = process.env.NODE_ENV
if (NODE_ENV !== "development" && NODE_ENV !== "production") {
  throw new Error("NODE_ENV must either be set to development or production.")
}

export const __DEV__ = NODE_ENV === "development"

declare const __KIRU_ROUTER_BOOTSTRAP__: "csr" | "ssr" | "ssg" | undefined

/** True when the client bundle was built for CSR or SSG (injected by vite-plugin-kiru on client builds). */
export const __KIRU_PURE_CLIENT__ =
  typeof __KIRU_ROUTER_BOOTSTRAP__ !== "undefined" &&
  (__KIRU_ROUTER_BOOTSTRAP__ === "csr" || __KIRU_ROUTER_BOOTSTRAP__ === "ssg")

/** True when the client bundle was built for SSR. */
export const __KIRU_SSR__ =
  typeof __KIRU_ROUTER_BOOTSTRAP__ !== "undefined" &&
  __KIRU_ROUTER_BOOTSTRAP__ === "ssr"

export const isBrowser = "window" in globalThis && typeof window !== "undefined"
export const isServer = !isBrowser
