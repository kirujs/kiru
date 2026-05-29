// @ts-check
import { task, pipeline } from "builderman"
import { pnpm } from "@builderman/resolvers-pnpm"
import { packageTestConcurrency } from "./config.mjs"
import { noopCmd, pkgCache } from "./shared.mjs"

/** @typedef {{ name: string, dir: string, buildDeps?: string[], testRun?: string, hasTest?: boolean, buildOnly?: boolean }} PkgDef */

/** @type {Map<string, { build: import('builderman').Task, test?: import('builderman').Task }>} */
const registry = new Map()

/**
 * @param {PkgDef} def
 * @param {{
 *   buildCache?: object
 *   buildCommand?: object
 *   testCache?: object
 *   testCacheFromBuild?: (build: import('builderman').Task) => object
 *   testCommand?: Partial<Omit<import('builderman').CommandConfig, 'cache' | 'dependencies' | 'run'>>
 *   dev?: object
 * }} [overrides]
 */
function definePackage(def, overrides = {}) {
  const {
    name,
    dir,
    buildDeps = [],
    testRun = "pnpm test",
    hasTest = true,
    buildOnly = false,
  } = def

  const buildDepTasks = buildDeps.map((key) => {
    const entry = registry.get(key)
    if (!entry) throw new Error(`definePackage: unknown buildDep "${key}"`)
    return entry.build
  })

  const buildTask = task({
    name,
    cwd: dir,
    commands: {
      build: overrides.buildCommand ?? {
        run: "pnpm build",
        cache: overrides.buildCache ?? pkgCache(dir),
        ...(buildDepTasks.length ? { dependencies: buildDepTasks } : {}),
      },
      ...(overrides.dev ? { dev: overrides.dev } : {}),
      test: noopCmd,
    },
  })

  let testTask
  if (hasTest && !buildOnly) {
    const testCache =
      overrides.testCacheFromBuild?.(buildTask) ??
      overrides.testCache ??
      pkgCache(dir)
    testTask = task({
      name: `${name}:test`,
      cwd: dir,
      commands: {
        build: noopCmd,
        test: {
          run: testRun,
          cache: testCache,
          dependencies: [buildTask],
          ...overrides.testCommand,
        },
      },
    })
  }

  registry.set(name, { build: buildTask, test: testTask })
  return { build: buildTask, test: testTask }
}

const { build: runtime } = definePackage({
  name: "runtime",
  dir: "packages/runtime",
})

const { build: lib, test: libTest } = definePackage(
  {
    name: "lib",
    dir: "packages/lib",
    buildDeps: ["runtime"],
    testRun: "pnpm exec node ./scripts/test.mjs",
  },
  {
    buildCache: {
      inputs: ["src", pnpm.package()],
      outputs: ["dist"],
    },
    dev: {
      run: "pnpm dev",
      readyWhen: (output) => output.includes("Watching for file changes."),
    },
    testCacheFromBuild: (build) => ({
      inputs: [
        "src",
        "scripts/test.mjs",
        "package.json",
        build.artifact("build"),
        pnpm.package(),
      ],
      outputs: ["dist-test"],
    }),
    testCommand: { env: { NODE_ENV: "development" } },
  }
)

const { build: adapterContract } = definePackage({
  name: "adapter-contract",
  dir: "packages/adapter-contract",
})

const { build: fileRoutes, test: fileRoutesTest } = definePackage({
  name: "file-routes",
  dir: "packages/file-routes",
})

const { build: devtoolsHost } = definePackage(
  { name: "devtools-host", dir: "packages/devtools-host", hasTest: false },
  {
    buildCache: {
      inputs: ["src", lib.artifact("build"), pnpm.package()],
      outputs: ["dist"],
    },
    dev: {
      run: "pnpm dev",
      readyWhen: (output) => output.includes("Build complete!"),
    },
  }
)

const { build: adapterNode, test: adapterNodeTest } = definePackage({
  name: "adapter-node",
  dir: "packages/adapter-node",
})

const { build: adapterBun } = definePackage(
  {
    name: "adapter-bun",
    dir: "packages/adapter-bun",
    buildOnly: true,
    hasTest: false,
  },
  {
    buildCommand: {
      run: "pnpm build",
      cache: pkgCache("packages/adapter-bun"),
      dependencies: [adapterNode],
    },
  }
)

const { build: adapterCloudflare } = definePackage({
  name: "adapter-cloudflare",
  dir: "packages/adapter-cloudflare",
  buildOnly: true,
  hasTest: false,
})

const packagesBuildWave1 = pipeline([lib, adapterContract]).toTask({
  name: "packages:build:wave1",
  dependencies: [runtime],
  maxConcurrency: 2,
})

const packagesBuildWave2 = pipeline([
  fileRoutes,
  devtoolsHost,
  adapterCloudflare,
]).toTask({
  name: "packages:build:wave2",
  dependencies: [packagesBuildWave1],
  maxConcurrency: 3,
})

const packagesBuildAdapters = pipeline([adapterNode, adapterBun]).toTask({
  name: "packages:build:adapters",
  dependencies: [packagesBuildWave1],
  maxConcurrency: 2,
})

const packagesBuildPostWave1 = pipeline([
  packagesBuildWave2,
  packagesBuildAdapters,
]).toTask({
  name: "packages:build:post-wave1",
  dependencies: [packagesBuildWave1],
  maxConcurrency: 2,
})

const vitePluginCacheConfig = {
  inputs: [
    "src",
    lib.artifact("build"),
    fileRoutes.artifact("build"),
    devtoolsHost.artifact("build"),
    runtime.artifact("build"),
    adapterNode.artifact("build"),
    pnpm.package(),
  ],
  outputs: ["dist"],
}

const vitePlugin = task({
  name: "vite-plugin-kiru",
  cwd: "packages/vite-plugin-kiru",
  commands: {
    build: {
      run: "pnpm build",
      cache: vitePluginCacheConfig,
      dependencies: [packagesBuildPostWave1, runtime],
    },
    test: noopCmd,
    dev: {
      run: "pnpm dev",
      dependencies: [lib, devtoolsHost],
    },
  },
})

const vitePluginTest = task({
  name: "vite-plugin-kiru:test",
  cwd: "packages/vite-plugin-kiru",
  commands: {
    build: noopCmd,
    test: {
      run: "pnpm test",
      cache: vitePluginCacheConfig,
      dependencies: [vitePlugin],
    },
  },
})

export const packagesBuild = pipeline([
  runtime,
  packagesBuildWave1,
  packagesBuildPostWave1,
  vitePlugin,
]).toTask({
  name: "packages:build",
})

/** Alias for e2e scheduling — same task as packagesBuild. */
export const packagesForE2e = packagesBuild

export const packagesTest = pipeline(
  [
    registry.get("runtime")?.test,
    libTest,
    fileRoutesTest,
    registry.get("adapter-contract")?.test,
    adapterNodeTest,
    vitePluginTest,
  ].filter((t) => !!t)
).toTask({
  name: "packages:test",
  dependencies: [packagesBuild],
  maxConcurrency: packageTestConcurrency,
})

export {
  runtime,
  lib,
  fileRoutes,
  devtoolsHost,
  adapterContract,
  adapterNode,
  adapterBun,
  adapterCloudflare,
  vitePlugin,
}
