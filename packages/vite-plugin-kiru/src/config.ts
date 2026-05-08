import path from "node:path"
import type { ESBuildOptions, ResolvedConfig } from "vite"
import type { KiruPluginOptions, FileLinkFormatter } from "./types.js"

export const defaultEsBuildOptions: ESBuildOptions = {
  jsxInject: `import { createElement as _jsx, Fragment as _jsxFragment } from "kiru"`,
  jsx: "transform",
  jsxFactory: "_jsx",
  jsxFragment: "_jsxFragment",
  loader: "tsx",
  include: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
}

export interface PluginState {
  isProduction: boolean
  isBuild: boolean
  isSSRBuild: boolean
  devtoolsEnabled: boolean
  loggingEnabled: boolean
  projectRoot: string
  includedPaths: string[]
  outDir: string
  baseOutDir: string
  fileLinkFormatter: FileLinkFormatter
  dtClientPathname: string
  dtHostScriptPath: string
  manifestPath: string
  features: {
    staticHoisting: boolean
  }
  staticProps: Record<string, Record<string, Record<string, any>>>
  remotePaths: string[]
  router: {
    ssg: null | {
      routesModule: string
    }
    serverEntry: string | null
    remote: string | null
  }
}

export function createPluginState(
  opts: KiruPluginOptions = {}
): Partial<PluginState> {
  let fileLinkFormatter: FileLinkFormatter = (path: string, line: number) =>
    `vscode://file/${path}:${line}`

  let dtClientPathname = "/__devtools__"
  if (typeof opts.devtools === "object") {
    //dtClientPathname = opts.devtools.dtClientPathname ?? dtClientPathname
    fileLinkFormatter = opts.devtools.formatFileLink ?? fileLinkFormatter
  }

  // Validate devtools pathname
  if (!dtClientPathname.startsWith("/")) {
    throw new Error(
      "[vite-plugin-kiru]: devtools.dtClientPathname must start with '/'"
    )
  }

  const ssg = opts.router?.ssg
  const routesModule =
    ssg === true ? "./src/routes.ts" : typeof ssg === "object" ? ssg.routes : null

  return {
    projectRoot: process.cwd().replace(/\\/g, "/"),
    includedPaths: [],
    fileLinkFormatter,
    dtClientPathname,
    dtHostScriptPath: "/__devtools_host__.js",
    manifestPath: "vite-manifest.json",
    loggingEnabled: opts.loggingEnabled === true,
    features: {
      staticHoisting: opts.experimental?.staticHoisting === true,
    },
    router: {
      ssg: routesModule ? { routesModule } : null,
      serverEntry: opts.router?.serverEntry ?? null,
      remote: opts.router?.remote ?? null,
    },
  }
}

export function updatePluginState(
  state: Partial<PluginState>,
  config: ResolvedConfig,
  opts: KiruPluginOptions
): PluginState {
  const isProduction = config.isProduction ?? false
  const isBuild = config.command === "build"
  const isSSRBuild = !!config.build?.ssr
  const devtoolsEnabled = opts.devtools !== false && !isBuild && !isProduction

  const projectRoot =
    config.root.replace(/\\/g, "/") ?? process.cwd().replace(/\\/g, "/")
  const includedPaths = (opts.include ?? []).map((p) =>
    path.resolve(projectRoot, p).replace(/\\/g, "/")
  )

  const outDir = (config.build.outDir ?? "dist") as string
  const normalizedOut = outDir.replace(/\\/g, "/")
  const baseOutDir = normalizedOut.replace(/\/(server|client)$/i, "") || "dist"

  return {
    ...state,
    isProduction,
    isBuild,
    isSSRBuild,
    devtoolsEnabled,
    projectRoot,
    includedPaths,
    outDir,
    baseOutDir,
    // Ensure all required fields are present
    loggingEnabled: state.loggingEnabled ?? false,
    fileLinkFormatter: state.fileLinkFormatter!,
    dtClientPathname: state.dtClientPathname!,
    dtHostScriptPath: state.dtHostScriptPath!,
    manifestPath: state.manifestPath!,
    features: {
      staticHoisting: state.features?.staticHoisting ?? false,
    },
    staticProps: {},
    remotePaths: [],
    router: {
      ssg: state.router?.ssg ?? null,
      serverEntry: state.router?.serverEntry ?? null,
      remote: state.router?.remote ?? null,
    },
  } satisfies PluginState
}
