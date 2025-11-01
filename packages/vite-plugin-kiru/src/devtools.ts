import type { ViteDevServer, IndexHtmlTransformResult } from "vite"
import devtoolsClientBuild from "kiru-devtools-client"
import devtoolsHostBuild from "kiru-devtools-host"
import type { DevtoolsOptions } from "./types.js"
import { ANSI } from "./ansi.js"

export function setupDevtools(
  server: ViteDevServer,
  options: Required<DevtoolsOptions>,
  dtHostScriptPath: string,
  log: (...data: any[]) => void
) {
  const { pathname: dtClientPathname } = options

  log(`Serving devtools host at ${ANSI.magenta(dtHostScriptPath)}`)
  server.middlewares.use(dtHostScriptPath, (_, res) => {
    res.setHeader("Content-Type", "application/javascript")
    res.end(devtoolsHostBuild, "utf-8")
  })

  log(`Serving devtools client at ${ANSI.magenta(dtClientPathname)}`)
  server.middlewares.use(dtClientPathname, (_, res) => {
    res.end(devtoolsClientBuild, "utf-8")
  })
}

export function createDevtoolsHtmlTransform(
  dtClientPathname: string,
  dtHostScriptPath: string
): IndexHtmlTransformResult {
  return {
    html: "",
    tags: [
      {
        tag: "script",
        children: `window.__KIRU_DEVTOOLS_PATHNAME__ = "${dtClientPathname}";`,
      },
      {
        tag: "script",
        attrs: {
          type: "module",
          src: dtHostScriptPath,
        },
      },
    ],
  }
}
