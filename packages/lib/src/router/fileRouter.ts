import { createElement } from "../element.js"
import { RouterContext } from "./context.js"
import { FileRouterController } from "./fileRouterController.js"
import type { FileRouterConfig } from "./types.js"
import { fileRouterInstance } from "./globals.js"
import { onCleanup } from "../hooks/onCleanup.js"

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

export const FileRouter: Kiru.FC<FileRouterProps> = ({ config }) => {
  fileRouterInstance.current?.dispose()
  let router = (fileRouterInstance.current = new FileRouterController())
  let configStr = ""

  onCleanup(() => router.dispose())

  const onUpdate = (props: FileRouterProps) => {
    const newConfigStr = JSON.stringify(props.config)
    if (newConfigStr !== configStr) {
      config = props.config
      configStr = newConfigStr
      router.init(config)
    }
  }

  return (nextProps) => (
    onUpdate(nextProps),
    createElement(
      RouterContext.Provider,
      { value: router.contextValue },
      router.getChildren()
    )
  )
}
