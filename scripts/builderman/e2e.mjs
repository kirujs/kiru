// @ts-check
import { task, pipeline } from "builderman"
import { cypressConcurrency, e2eDiagFilter, e2eGitHubOpts } from "./config.mjs"
import {
  cypressProfileEnv,
  ensureSharedCypressBinary,
} from "./cypress-profile.mjs"
import { e2ePorts } from "../../e2e/shared/ports.mjs"
import {
  createE2eCacheConfig,
  createE2eCyCaches,
  matrixCellCache,
} from "./cache.mjs"
import {
  packagesForE2e,
  packagesTest,
  lib,
  vitePlugin,
  runtime,
  adapterNode,
  adapterBun,
  adapterCloudflare,
} from "./packages.mjs"
import { noopCmd } from "./shared.mjs"

ensureSharedCypressBinary()

const E2ECachConfig = createE2eCacheConfig({
  lib,
  vitePlugin,
  runtime,
  adapterNode,
  adapterBun,
  adapterCloudflare,
})
const { e2eCyOnlyCache, csrCyCache, ssrCyCache } =
  createE2eCyCaches(E2ECachConfig)

/** @type {Array<[string, string, number]>} */
const SSR_SHARDS = [
  ["loaders", "cypress.shard-loaders.config.ts", e2ePorts.ssr.loaders.dev],
  [
    "streaming",
    "cypress.shard-streaming.config.ts",
    e2ePorts.ssr.streaming.dev,
  ],
  ["actions", "cypress.shard-actions.config.ts", e2ePorts.ssr.actions.dev],
  ["tier3", "cypress.tier3.config.ts", e2ePorts.ssr.prod],
  ["core", "cypress.shard-core.config.ts", e2ePorts.ssr.core.dev],
]

/** @type {Array<[string, string, number]>} */
const CSR_SHARDS = [
  ["core", "cypress.shard-core.config.ts", e2ePorts.csr.core.dev],
  ["features", "cypress.shard-features.config.ts", e2ePorts.csr.features.dev],
  ["advanced", "cypress.shard-advanced.config.ts", e2ePorts.csr.advanced.dev],
]

const CY_APPS = [
  {
    name: "e2e:file-routes",
    cwd: "e2e/file-routes",
    port: e2ePorts.fileRoutes.dev,
  },
  {
    name: "e2e:file-routes-ssr",
    cwd: "e2e/file-routes-ssr",
    port: e2ePorts.fileRoutesSsr.dev,
  },
  {
    name: "e2e:compile-opts",
    cwd: "e2e/compile-opts",
    port: e2ePorts.compileOpts.dev,
  },
  { name: "e2e:primitive", cwd: "e2e/primitive", port: e2ePorts.primitive.dev },
  { name: "e2e:dom", cwd: "e2e/dom", port: e2ePorts.dom.dev },
]

/** @param {string | number} profileId */
function cypressEnv(profileId) {
  return { NODE_ENV: "development", ...cypressProfileEnv(profileId) }
}

/** @param {string} name @param {string} configFile @param {number} profileId */
function csrCyShard(name, configFile, profileId) {
  return task({
    name: `e2e:csr:cy-${name}`,
    cwd: "e2e/csr",
    commands: {
      build: noopCmd,
      test: {
        run: `pnpm exec cypress run --config-file ${configFile}`,
        cache: { ...csrCyCache, inputs: [...csrCyCache.inputs, configFile] },
      },
    },
    env: cypressEnv(profileId),
  })
}

/** @param {string} name @param {string} cwd */
function e2eAppBuild(name, cwd) {
  return task({
    name,
    cwd,
    commands: {
      build: { run: "pnpm build", cache: E2ECachConfig },
      test: noopCmd,
    },
    env: { NODE_ENV: "development" },
  })
}

/** @param {string} name @param {string} cwd @param {import('builderman').Task} buildTask @param {number} profileId */
function e2eCypressApp(name, cwd, buildTask, profileId) {
  return task({
    name,
    cwd,
    commands: {
      build: noopCmd,
      test: {
        run: "pnpm exec cypress run",
        cache: e2eCyOnlyCache,
      },
    },
    dependencies: [buildTask],
    env: cypressEnv(profileId),
  })
}

/** @param {{ name: string, cwd: string, port: number }} spec */
function cypressApp({ name, cwd, port }) {
  return task({
    name,
    cwd,
    commands: {
      build: noopCmd,
      test: {
        run: "pnpm exec cypress run",
        cache: e2eCyOnlyCache,
      },
    },
    env: cypressEnv(port),
  })
}

const ssgBuild = e2eAppBuild("e2e:ssg:build", "e2e/ssg")
const fileRoutesSsgBuild = e2eAppBuild(
  "e2e:file-routes-ssg:build",
  "e2e/file-routes-ssg"
)
const ssgTest = e2eCypressApp("e2e:ssg", "e2e/ssg", ssgBuild, e2ePorts.ssg.dev)
const fileRoutesSsgTest = e2eCypressApp(
  "e2e:file-routes-ssg",
  "e2e/file-routes-ssg",
  fileRoutesSsgBuild,
  e2ePorts.fileRoutesSsg.dev
)

const ssrBuild = task({
  name: "e2e:ssr:build",
  cwd: "e2e/ssr",
  commands: {
    build: { run: "pnpm build", cache: E2ECachConfig },
    test: {
      run: "node ./scripts/ensure-ssr-build.mjs",
      cache: E2ECachConfig,
    },
  },
  env: { NODE_ENV: "development" },
})

/** @param {string} name @param {string} configFile @param {number} profileId */
function ssrCyShard(name, configFile, profileId) {
  return task({
    name: `e2e:ssr:cy-${name}`,
    cwd: "e2e/ssr",
    commands: {
      build: noopCmd,
      test: {
        run: `pnpm exec cypress run --config-file ${configFile}`,
        cache: { ...ssrCyCache, inputs: [...ssrCyCache.inputs, configFile] },
      },
    },
    dependencies: [ssrBuild],
    env: cypressEnv(profileId),
  })
}

const ssrVerify = task({
  name: "e2e:ssr:verify",
  cwd: "e2e/ssr",
  commands: {
    build: noopCmd,
    test: {
      run: "node ./scripts/verify-hybrid-prerender.mjs && node ./scripts/concurrent-request-context.mjs",
      cache: {
        inputs: [...E2ECachConfig.inputs, "scripts"],
        outputs: [],
      },
    },
  },
  dependencies: [ssrBuild],
  env: { NODE_ENV: "development" },
})

const e2eViteBuilds = pipeline([ssgBuild, fileRoutesSsgBuild]).toTask({
  name: "e2e:vite-builds",
  dependencies: [packagesForE2e],
  maxConcurrency: 4,
})

/** @param {{ ssrOnly?: boolean }} [opts] */
function cypressLeaves({ ssrOnly = false } = {}) {
  const leaves = [
    e2eViteBuilds,
    ssrBuild,
    ssrVerify,
    ...SSR_SHARDS.map(([name, configFile, profileId]) =>
      ssrCyShard(name, configFile, profileId)
    ),
  ]
  if (!ssrOnly) {
    leaves.push(
      ...CSR_SHARDS.map(([name, configFile, profileId]) =>
        csrCyShard(name, configFile, profileId)
      ),
      ssgTest,
      ...CY_APPS.map(cypressApp),
      fileRoutesSsgTest
    )
  }
  return leaves
}

function buildCypressE2e(ssrOnly) {
  return pipeline(cypressLeaves({ ssrOnly })).toTask({
    name: "e2e:cypress",
    dependencies: [packagesForE2e],
    maxConcurrency: cypressConcurrency,
  })
}

const ssrMatrixTest = task({
  name: "e2e:ssr-matrix",
  cwd: "e2e/ssr-matrix",
  commands: {
    build: noopCmd,
    test: {
      run: "node ./scripts/matrix.mjs",
      cache: matrixCellCache,
    },
  },
  env: { NODE_ENV: "development" },
})

export const e2e =
  e2eDiagFilter === "ssr"
    ? pipeline([buildCypressE2e(true)]).toTask({
        name: "e2e",
        dependencies: [packagesTest],
        ...e2eGitHubOpts,
      })
    : pipeline([buildCypressE2e(false), ssrMatrixTest]).toTask({
        name: "e2e",
        dependencies: [packagesTest],
        ...e2eGitHubOpts,
      })
