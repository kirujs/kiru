import { __DEV__ } from "../env.js"
import { fileRouterInstance } from "./globals.js"
import type { PageConfig } from "./types"

export function definePageConfig<T extends PageConfig>(config: T): T {
  if (__DEV__) {
    const filePath = window.__kiru?.HMRContext?.getCurrentFilePath()
    const fileRouter = fileRouterInstance.current
    if (filePath && fileRouter) {
      fileRouter.onPageConfigDefined(filePath, config)
    }
  }

  return config
}
