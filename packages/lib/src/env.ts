const NODE_ENV = process.env.NODE_ENV
if (NODE_ENV !== "development" && NODE_ENV !== "production") {
  throw new Error("NODE_ENV must either be set to development or production.")
}

export const __DEV__ = NODE_ENV === "development"

export const isBrowser = "window" in globalThis && typeof window !== "undefined"
export const isServer = !isBrowser
