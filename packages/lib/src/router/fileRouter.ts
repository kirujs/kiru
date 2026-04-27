import { createElement } from "../element.js"
import { RouterContext } from "./context.js"
import { FileRouterController } from "./fileRouterController.js"
import type { FileRouterConfig } from "./types.js"
import { fileRouterInstance } from "./globals.js"
import { onCleanup } from "../hooks/onCleanup.js"
import { setup } from "../index.js"

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

export const FileRouter: Kiru.FC<FileRouterProps> = () => {
  fileRouterInstance.current?.dispose()
  const router = (fileRouterInstance.current = new FileRouterController())
  const $ = setup<FileRouterProps>()
  const config = $.derive((p) => p.config)

  router.init(config.peek())
  config.subscribe((config) => router.updateConfig(config))
  onCleanup(() => router.dispose())

  return () =>
    createElement(
      RouterContext,
      { value: router.contextValue },
      router.getChildren()
    )
}
