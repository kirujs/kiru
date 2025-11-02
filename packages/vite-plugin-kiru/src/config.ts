import path from "node:path"
import type { UserConfig, ESBuildOptions, ResolvedConfig } from "vite"
import type {
  KiruPluginOptions,
  SSGOptions,
  FileLinkFormatter,
  SSGBuildOptions,
} from "./types.js"
import {
  VIRTUAL_ENTRY_SERVER_ID,
  VIRTUAL_ENTRY_CLIENT_ID,
} from "./virtual-modules.js"

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
  ssgOptions:
    | (Required<SSGOptions> & { build: Required<SSGBuildOptions> })
    | null
  staticProps: Record<string, Record<string, Record<string, any>>>
}

export function createPluginState(
  opts: KiruPluginOptions = {}
): Partial<PluginState> {
  let fileLinkFormatter: FileLinkFormatter = (path: string, line: number) =>
    `vscode://file/${path}:${line}`

  let dtClientPathname = "/__devtools__"
  if (typeof opts.devtools === "object") {
    dtClientPathname = opts.devtools.dtClientPathname ?? dtClientPathname
    fileLinkFormatter = opts.devtools.formatFileLink ?? fileLinkFormatter
  }

  // Validate devtools pathname
  if (!dtClientPathname.startsWith("/")) {
    throw new Error(
      "[vite-plugin-kiru]: devtools.dtClientPathname must start with '/'"
    )
  }

  const state: Partial<PluginState> = {
    projectRoot: process.cwd().replace(/\\/g, "/"),
    includedPaths: [],
    fileLinkFormatter,
    dtClientPathname,
    dtHostScriptPath: "/__devtools_host__.js",
    manifestPath: "vite-manifest.json",
    loggingEnabled: opts.loggingEnabled === true,
    ssgOptions: null,
  }

  const { ssg } = opts
  if (ssg) {
    // Validate SSG options
    if (ssg.baseUrl && !ssg.baseUrl.startsWith("/")) {
      throw new Error("[vite-plugin-kiru]: ssg.baseUrl must start with '/'")
    }

    state.ssgOptions = {
      baseUrl: ssg?.baseUrl ?? "/",
      dir: ssg?.dir ?? "src/pages",
      document: ssg?.document ?? "document.tsx",
      page: ssg?.page ?? "index.{tsx,jsx}",
      layout: ssg?.layout ?? "layout.{tsx,jsx}",
      transition: ssg?.transition ?? false,
      build: {
        maxConcurrentRenders: ssg?.build?.maxConcurrentRenders ?? 100,
      },
    }
  }

  return state
}

export function createViteConfig(
  config: UserConfig,
  opts: KiruPluginOptions
): UserConfig {
  if (!opts.ssg) {
    return {
      ...config,
      esbuild: {
        ...defaultEsBuildOptions,
        ...config.esbuild,
      },
    }
  }
  const isSsrBuild = config.build?.ssr
  const rollup = (config.build as any)?.rollupOptions ?? {}
  let input = rollup.input

  if (!input) {
    input = isSsrBuild ? VIRTUAL_ENTRY_SERVER_ID : VIRTUAL_ENTRY_CLIENT_ID
  }

  const ssr = isSsrBuild === true ? true : config.build?.ssr
  const baseOut = config.build?.outDir ?? "dist"
  const desiredOutDir = isSsrBuild ? `${baseOut}/server` : `${baseOut}/client`

  return {
    ...config,
    appType: "custom",
    esbuild: {
      ...defaultEsBuildOptions,
      ...config.esbuild,
    },
    server: {},
    build: {
      ...config.build,
      ssr,
      manifest: "vite-manifest.json",
      ssrEmitAssets: true,
      ssrManifest: true,
      outDir: desiredOutDir,
      rollupOptions: {
        ...rollup,
        input,
      },
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
    ssgOptions: state.ssgOptions!,
    staticProps: {},
  } satisfies PluginState
}
