import { __DEV__ } from "../env.js"
import { createElement } from "../element.js"
import { useState, useEffect } from "../hooks/index.js"
import { RouterContext } from "./context.js"
import { FileRouterController } from "./fileRouterController.js"
import type { FileRouterConfig } from "./types.js"

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

export function FileRouter(props: FileRouterProps): JSX.Element {
  const [controller] = useState(() => new FileRouterController(props.config))
  useEffect(() => () => controller.dispose(), [controller])

  return createElement(
    RouterContext.Provider,
    { value: controller.getContextValue() },
    controller.getChildren()
  )
}
