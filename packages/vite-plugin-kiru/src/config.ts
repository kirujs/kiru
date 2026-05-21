import path from "node:path"
import type { ESBuildOptions, ResolvedConfig } from "vite"
import type { KiruPluginOptions, FileLinkFormatter } from "./types.js"
import {
  defaultRoutesModuleForFileRoutes,
  resolveFileRoutesOption,
  resolveFileRoutesPaths,
  type ResolvedFileRoutes,
} from "./fileRoutesConfig.js"
import type { SsgPrerenderCache } from "./ssgPrerender.js"
import {
  resolveModulePattern,
  resolveSingleModulePattern,
  sortSiteConfigPaths,
} from "./resolveModulePattern.js"

const DEFAULT_MAX_CONCURRENT_RENDERS = 10

export function resolveMaxConcurrentRenders(
  value: number | undefined
): number {
  const n = value ?? DEFAULT_MAX_CONCURRENT_RENDERS
  if (n !== Infinity && (!Number.isFinite(n) || n < 1)) {
    throw new Error(
      "[vite-plugin-kiru]: router.ssg.build.maxConcurrentRenders must be a positive number or Infinity"
    )
  }
  return n
}

export const defaultEsBuildOptions: ESBuildOptions = {
  jsx: "automatic",
  jsxImportSource: "kiru",
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
  /** `routeId` → Vite module id for pages that export `serverLoader`. */
  loaderModulesByRouteId: Map<string, string>
  /** Populated in `closeBundle` after the client bundle when `router.ssg` is enabled. */
  ssgPrerenderCache: SsgPrerenderCache | null
  router: {
    ssg: null | {
      /** User pattern (may be a glob); also emitted to `kiru-route-manifest.json`. */
      routesModule: string
      /** Resolved absolute path to the routes module file. */
      routesModuleAbs: string
      /** User pattern when set; otherwise default discovery at build time. */
      siteModule: string | null
      /** Resolved site config paths (from glob or literal); `null` → plugin defaults. */
      siteModuleAbsPaths: string[] | null
      /** Parallel static route renders during `vite build` prerender. */
      maxConcurrentRenders: number
    }
    serverEntry: string | null
    /** Resolved absolute path to the SSR server entry. */
    serverEntryAbs: string | null
    remote: string | null
    adapter: "node" | "bun" | "cloudflare"
    fileRoutes: ResolvedFileRoutes | null
  }
}

export async function resolveRouterModulePaths(
  state: PluginState,
  projectRoot: string
): Promise<void> {
  if (state.router.fileRoutes) {
    await resolveFileRoutesPaths(state.router.fileRoutes, projectRoot)
  }
  if (state.router.ssg) {
    state.router.ssg.routesModuleAbs = await resolveSingleModulePattern(
      state.router.ssg.routesModule,
      projectRoot,
      "router.ssg.routes"
    )
    if (state.router.ssg.siteModule) {
      const paths = await resolveModulePattern(
        state.router.ssg.siteModule,
        projectRoot,
        "router.ssg.siteModule"
      )
      state.router.ssg.siteModuleAbsPaths = sortSiteConfigPaths(paths)
    } else {
      state.router.ssg.siteModuleAbsPaths = null
    }
  }
  if (state.router.serverEntry) {
    state.router.serverEntryAbs = await resolveSingleModulePattern(
      state.router.serverEntry,
      projectRoot,
      "router.serverEntry"
    )
  } else {
    state.router.serverEntryAbs = null
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

  const fileRoutes = resolveFileRoutesOption(
    opts.router?.fileRoutes,
    process.cwd().replace(/\\/g, "/")
  )
  const ssg = opts.router?.ssg
  let routesModule =
    ssg === true
      ? "./src/routes.ts"
      : typeof ssg === "object"
        ? ssg.routes
        : null
  if (fileRoutes && ssg) {
    if (!routesModule || ssg === true) {
      routesModule = defaultRoutesModuleForFileRoutes(fileRoutes)
    }
  }
  const siteModule = typeof ssg === "object" ? (ssg.siteModule ?? null) : null
  const maxConcurrentRenders = resolveMaxConcurrentRenders(
    typeof ssg === "object" ? ssg.build?.maxConcurrentRenders : undefined
  )

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
    staticProps: {},
    remotePaths: [],
    loaderModulesByRouteId: new Map(),
    ssgPrerenderCache: null,
    router: {
      ssg: routesModule
        ? {
            routesModule,
            routesModuleAbs: "",
            siteModule,
            siteModuleAbsPaths: null,
            maxConcurrentRenders,
          }
        : null,
      serverEntry: opts.router?.serverEntry ?? null,
      serverEntryAbs: null,
      remote: opts.router?.remote ?? null,
      adapter: opts.router?.adapter ?? "node",
      fileRoutes,
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

  const outDir = (config.build.outDir ??
    config.environments?.client?.build?.outDir ??
    "dist") as string
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
    loaderModulesByRouteId:
      state.loaderModulesByRouteId ?? new Map<string, string>(),
    ssgPrerenderCache: state.ssgPrerenderCache ?? null,
    router: {
      ssg: state.router?.ssg ?? null,
      serverEntry: state.router?.serverEntry ?? null,
      serverEntryAbs: state.router?.serverEntryAbs ?? null,
      remote: state.router?.remote ?? null,
      adapter: state.router?.adapter ?? "node",
      fileRoutes: state.router?.fileRoutes ?? null,
    },
  } satisfies PluginState
}
