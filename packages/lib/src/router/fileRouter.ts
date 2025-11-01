import { createElement } from "../element.js"
import { useState, useEffect } from "../hooks/index.js"
import { RouterContext } from "./context.js"
import { FileRouterController } from "./fileRouterController.js"
import type { FileRouterConfig } from "./types.js"
import { fileRouterInstance } from "./globals.js"

export interface FileRouterProps {
  /**
   * The router configuration
   * @example
   * ```ts
   *<FileRouter
       config={{
         dir: "/fbr-app", // optional, defaults to "/pages"
         baseUrl: "/app", // optional, defaults to "/"
         pages: import.meta.glob("/∗∗/index.tsx"),
         layouts: import.meta.glob("/∗∗/layout.tsx"),
         transition: true
       }}
  />
   * ```
   */
  config: FileRouterConfig
}

export function FileRouter({ config }: FileRouterProps): JSX.Element {
  const [controller] = useState(() => {
    if (fileRouterInstance.current && !config.preloaded) {
      throw new Error(
        "[kiru/router]: FileRouter cannot be instantiated more than once at a time."
      )
    }
    const router = (fileRouterInstance.current ??= new FileRouterController())
    router.init(config)
    return router
  })
  useEffect(() => () => controller.dispose(), [controller])

  return createElement(
    RouterContext.Provider,
    { value: controller.getContextValue() },
    controller.getChildren()
  )
}
