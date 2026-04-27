import path from "node:path"
import { version as viteVersion } from "vite"
import type {
  UserConfig,
  ESBuildOptions,
  ResolvedConfig,
  OxcOptions,
} from "vite"
import type {
  KiruPluginOptions,
  SSGOptions,
  FileLinkFormatter,
  SSGBuildOptions,
  SSGSitemapOptions,
} from "./types.js"
import {
  VIRTUAL_ENTRY_SERVER_ID,
  VIRTUAL_ENTRY_CLIENT_ID,
} from "./virtual-modules.js"
import type { RolldownOptions, TransformOptions } from "rolldown"

export const defaultEsBuildOptions: ESBuildOptions = {
  jsxInject: `import { createElement as _jsx, Fragment as _jsxFragment } from "kiru"`,
  jsx: "transform",
  jsxFactory: "_jsx",
  jsxFragment: "_jsxFragment",
  loader: "tsx",
  include: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
}

export const defaultOxcOptions: OxcOptions = {
  // jsxInject: `import { createElement as _jsx, Fragment as _jsxFragment } from "kiru"`,
  jsx: {
    importSource: "kiru",
    pragma: "_jsx",
    pragmaFrag: "_jsxFragment",
    runtime: "automatic",
  },
  include: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
}

export const defaultRolldownTransformOptions = {
  jsx: {
    importSource: "kiru",
    pragma: "_jsx",
    pragmaFrag: "_jsxFragment",
    runtime: "automatic",
  },
} satisfies TransformOptions

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
  ssgOptions:
    | (Required<Omit<SSGOptions, "sitemap">> & {
        sitemap?: SSGSitemapOptions
        build: Required<SSGBuildOptions>
      })
    | null
  staticProps: Record<string, Record<string, Record<string, any>>>
}

const defaultSSGOptions: Required<Omit<SSGOptions, "sitemap">> & {
  build: Required<SSGBuildOptions>
} = {
  baseUrl: "/",
  dir: "src/pages",
  document: "document.{tsx,jsx}",
  page: "index.{tsx,jsx}",
  layout: "layout.{tsx,jsx}",
  transition: false,
  build: {
    maxConcurrentRenders: 100,
  },
}

/**
 * Without specifying manual chunks, we get the following warning when building sandbox/docs:
 * ```plaintext
 * Export "useComputed" of module "../../packages/lib/dist/signals/computed.js" was reexported through module "../../packages/lib/dist/signals/index.js" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings. This scenario is not well supported at the moment as it will produce a circular dependency between chunks and will likely lead to broken execution order.
Either change the import in "src/components/demos/CodeDemo.tsx" to point directly to the exporting module or reconfigure "output.manualChunks" to ensure these modules end up in the same chunk.
 *```
 * Apparently this change is sufficient and it does make sense to ensure these modules land in the same chunk.
 */

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

  const state: Partial<PluginState> = {
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
    ssgOptions: null,
  }

  const { ssg } = opts
  if (!ssg) return state

  if (ssg === true) {
    return {
      ...state,
      ssgOptions: defaultSSGOptions,
    }
  }
  if (ssg.baseUrl && !ssg.baseUrl.startsWith("/")) {
    throw new Error("[vite-plugin-kiru]: ssg.baseUrl must start with '/'")
  }

  const {
    baseUrl,
    dir,
    document,
    page,
    layout,
    transition,
    build: { maxConcurrentRenders },
  } = defaultSSGOptions

  return {
    ...state,
    ssgOptions: {
      ...ssg,
      baseUrl: ssg.baseUrl ?? baseUrl,
      dir: ssg.dir ?? dir,
      document: ssg.document ?? document,
      page: ssg.page ?? page,
      layout: ssg.layout ?? layout,
      transition: ssg.transition ?? transition,
      sitemap: ssg.sitemap,
      build: {
        maxConcurrentRenders:
          ssg.build?.maxConcurrentRenders ?? maxConcurrentRenders,
      },
    },
  }
}

export function createViteConfig(
  config: UserConfig,
  opts: KiruPluginOptions
): UserConfig {
  const isVite8 = viteVersion.startsWith("8")
  const rolldownOptions: RolldownOptions = {
    ...config.build?.rolldownOptions,
    transform: {
      ...config.build?.rolldownOptions?.transform,
      ...defaultRolldownTransformOptions,
    },
  }

  const versionOpts: UserConfig = isVite8
    ? {
        optimizeDeps: {
          rolldownOptions: {
            transform: { jsx: { ...defaultRolldownTransformOptions.jsx } },
          },
        },
        oxc: { ...defaultOxcOptions, ...config.oxc },
        build: { ...config.build, rolldownOptions },
      }
    : { esbuild: { ...defaultEsBuildOptions, ...config.esbuild } }

  console.log("[createViteConfig]", JSON.stringify(versionOpts))

  if (!opts.ssg) {
    return { ...config, ...versionOpts }
  }

  const ssr = config.build?.ssr
  const baseOut = config.build?.outDir ?? "dist"
  const desiredOutDir = ssr ? `${baseOut}/server` : `${baseOut}/client`

  if (isVite8) {
    let input = rolldownOptions?.input
    if (!input) {
      input = ssr ? VIRTUAL_ENTRY_SERVER_ID : VIRTUAL_ENTRY_CLIENT_ID
    }

    return {
      ...config,
      appType: "custom",
      server: {},
      build: {
        ...config.build,
        ssr,
        manifest: "vite-manifest.json",
        outDir: desiredOutDir,
        rolldownOptions: {
          ...rolldownOptions,
          output: {
            codeSplitting: ssr
              ? {}
              : {
                  groups: [
                    {
                      name: "kiru",
                      test: /node_modules[\\/]kiru([\\/].*)?/,
                    },
                  ],
                },
          },
        },
      },
    }
  }

  const rollupOpts = config.build?.rollupOptions ?? {}
  let input = rollupOpts?.input
  if (!input) {
    input = ssr ? VIRTUAL_ENTRY_SERVER_ID : VIRTUAL_ENTRY_CLIENT_ID
  }

  return {
    ...config,
    appType: "custom",
    ...versionOpts,
    server: {},
    build: {
      ...config.build,
      ssr,
      manifest: "vite-manifest.json",
      outDir: desiredOutDir,
      rollupOptions: {
        ...rollupOpts,
        // @ts-expect-error
        output: {
          manualChunks: ssr
            ? {}
            : { kiru: ["kiru", "kiru/router", "kiru/router/client"] },
        },
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
    features: {
      staticHoisting: state.features?.staticHoisting ?? false,
    },
    ssgOptions: state.ssgOptions!,
    staticProps: {},
  } satisfies PluginState
}
