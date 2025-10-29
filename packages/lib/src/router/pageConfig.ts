import { __DEV__ } from "../env.js"
import { fileRouterInstance } from "./globals.js"
import type { PageConfig } from "./types"
import type { Guard } from "../types.utils.js"

export function definePageConfig<const T extends PageConfig>(
  config: Guard<T, keyof T>
): T {
  if (__DEV__ && "window" in globalThis) {
    const filePath = window.__kiru?.HMRContext?.getCurrentFilePath()
    const fileRouter = fileRouterInstance.current
    if (filePath && fileRouter) {
      fileRouter.onPageConfigDefined(filePath, config)
    }
  }

  return config as T
}
