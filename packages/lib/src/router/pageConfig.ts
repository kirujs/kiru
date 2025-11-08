import { __DEV__ } from "../env.js"
import { fileRouterInstance } from "./globals.js"
import type { PageConfig } from "./types"

export function definePageConfig<T>(config: PageConfig<T>): PageConfig<T> {
  if (__DEV__ && "window" in globalThis) {
    const filePath = window.__kiru?.HMRContext?.getCurrentFilePath()
    const fileRouter = fileRouterInstance.current
    if (filePath && fileRouter) {
      fileRouter.dev_onPageConfigDefined!(filePath, config)
    }
  }

  return config
}
