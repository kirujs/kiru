// @ts-check
import { task, pipeline } from "builderman"
import { pnpm } from "@builderman/resolvers-pnpm"

const pkgCache = (pkgDir) => ({
  inputs: ["src", pnpm.package()],
  outputs: ["dist"],
  cwd: pkgDir,
})

const runtime = task({
  name: "runtime",
  cwd: "packages/runtime",
  commands: {
    build: { run: "pnpm build", cache: pkgCache("packages/runtime") },
    test: { run: "pnpm test", cache: pkgCache("packages/runtime") },
  },
})

const libCacheConfig = {
  inputs: ["src", pnpm.package()],
  outputs: ["dist"],
}
const lib = task({
  name: "lib",
  cwd: "packages/lib",
  commands: {
    build: {
      run: "pnpm build",
      cache: libCacheConfig,
      dependencies: [runtime],
    },
    dev: {
      run: "pnpm dev",
      readyWhen: (output) => output.includes("Watching for file changes."),
    },
    test: {
      run: "pnpm test",
      env: {
        NODE_ENV: "development",
      },
      cache: {
        inputs: ["src", "scripts/test.mjs", pnpm.package()],
        outputs: ["dist", "dist-test"],
      },
      dependencies: [runtime],
    },
  },
})

const devtoolsHost = task({
  name: "devtools-host",
  cwd: "packages/devtools-host",
  commands: {
    build: {
      run: "pnpm build",
      cache: {
        inputs: ["src", lib.artifact("build"), pnpm.package()],
        outputs: ["dist"],
      },
    },
    dev: {
      run: "pnpm dev",
      readyWhen: (output) => output.includes("Build complete!"),
    },
  },
})

const fileRoutes = task({
  name: "file-routes",
  cwd: "packages/file-routes",
  commands: {
    build: {
      run: "pnpm build",
      cache: pkgCache("packages/file-routes"),
      dependencies: [lib],
    },
    test: {
      run: "pnpm test",
      cache: pkgCache("packages/file-routes"),
      dependencies: [lib],
      env: { NODE_ENV: "development" },
    },
  },
})

const adapterContract = task({
  name: "adapter-contract",
  cwd: "packages/adapter-contract",
  commands: {
    build: {
      run: "pnpm build",
      cache: pkgCache("packages/adapter-contract"),
    },
    test: {
      run: "pnpm test",
      cache: pkgCache("packages/adapter-contract"),
    },
  },
})

const adapterNode = task({
  name: "adapter-node",
  cwd: "packages/adapter-node",
  commands: {
    build: {
      run: "pnpm build",
      cache: pkgCache("packages/adapter-node"),
      dependencies: [adapterContract, lib, runtime],
    },
    test: {
      run: "pnpm test",
      cache: pkgCache("packages/adapter-node"),
      dependencies: [adapterContract, lib, runtime],
    },
  },
})

const adapterBun = task({
  name: "adapter-bun",
  cwd: "packages/adapter-bun",
  commands: {
    build: {
      run: "pnpm build",
      cache: pkgCache("packages/adapter-bun"),
      dependencies: [adapterContract, adapterNode, lib, runtime],
    },
  },
})

const adapterCloudflare = task({
  name: "adapter-cloudflare",
  cwd: "packages/adapter-cloudflare",
  commands: {
    build: {
      run: "pnpm build",
      cache: pkgCache("packages/adapter-cloudflare"),
      dependencies: [adapterContract, lib, runtime],
    },
  },
})

const vitePluginCacheConfig = {
  inputs: [
    "src",
    lib.artifact("build"),
    fileRoutes.artifact("build"),
    devtoolsHost.artifact("build"),
    runtime.artifact("build"),
    adapterCloudflare.artifact("build"),
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
      dependencies: [lib, fileRoutes, devtoolsHost, runtime, adapterCloudflare],
    },
    test: {
      run: "pnpm test",
      cache: vitePluginCacheConfig,
    },
    dev: {
      run: "pnpm dev",
      dependencies: [lib, devtoolsHost],
    },
  },
})

const adapterDeps = [
  lib,
  fileRoutes,
  vitePlugin,
  runtime,
  adapterContract,
  adapterNode,
  adapterBun,
  adapterCloudflare,
]

const E2ECachConfig = {
  inputs: [
    "src",
    lib.artifact("build"),
    vitePlugin.artifact("build"),
    runtime.artifact("build"),
    adapterNode.artifact("build"),
    adapterBun.artifact("build"),
    adapterCloudflare.artifact("build"),
    pnpm.package(),
  ],
  outputs: ["dist"],
}

const sharedE2EConfig = {
  commands: {
    build: { run: "pnpm build", cache: E2ECachConfig },
    test: { run: "pnpm test", cache: E2ECachConfig },
  },
  dependencies: adapterDeps,
  env: { NODE_ENV: "development" },
}

const csrTest = task({
  ...sharedE2EConfig,
  name: "e2e:csr",
  cwd: "e2e/csr",
})

/** Sharp image pipeline; excluded from default `e2e/csr` Cypress config. */
const csrImageTest = task({
  name: "e2e:csr:image",
  cwd: "e2e/csr",
  commands: {
    test: {
      run: "pnpm run test:image",
      cache: E2ECachConfig,
    },
  },
  dependencies: adapterDeps,
  env: { NODE_ENV: "development" },
})

const ssgTest = task({
  ...sharedE2EConfig,
  name: "e2e:ssg",
  cwd: "e2e/ssg",
})

/** Production build, hybrid/ISR verify scripts, then Cypress (tier1 + tier3). */
const ssrTest = task({
  name: "e2e:ssr",
  cwd: "e2e/ssr",
  commands: {
    build: { run: "pnpm build", cache: E2ECachConfig },
    test: {
      run: "pnpm run build && node ./scripts/verify-hybrid-prerender.mjs && node ./scripts/concurrent-request-context.mjs && pnpm run cy:run && pnpm exec cypress run --config-file cypress.tier3.config.ts",
      cache: E2ECachConfig,
    },
  },
  dependencies: adapterDeps,
  env: { NODE_ENV: "development" },
})

const fileRoutesTest = task({
  ...sharedE2EConfig,
  name: "e2e:file-routes",
  cwd: "e2e/file-routes",
})

const fileRoutesSsrTest = task({
  ...sharedE2EConfig,
  name: "e2e:file-routes-ssr",
  cwd: "e2e/file-routes-ssr",
})

const fileRoutesSsgTest = task({
  ...sharedE2EConfig,
  name: "e2e:file-routes-ssg",
  cwd: "e2e/file-routes-ssg",
})

const ssrMatrixTest = task({
  name: "e2e:ssr-matrix",
  cwd: "e2e/ssr-matrix",
  commands: {
    build: {
      run: 'node -e "process.exit(0)"',
      cache: {
        inputs: ["scripts", "src", "vite.config.ts", "wrangler.toml", pnpm.package()],
        outputs: [],
      },
    },
    test: {
      run: "pnpm test",
      cache: E2ECachConfig,
    },
  },
  dependencies: adapterDeps,
  env: { NODE_ENV: "development" },
})

// `pnpm test` at repo root runs lib unit tests (incl. *.test.tsx) via adapterDeps,
// then this pipeline: CSR Cypress, CSR image (Sharp), SSG/SSR/file-routes/matrix e2e.
const e2e = pipeline([
  csrTest,
  csrImageTest,
  ssgTest,
  ssrTest,
  fileRoutesTest,
  fileRoutesSsrTest,
  fileRoutesSsgTest,
  ssrMatrixTest,
]).toTask({
  name: "e2e",
  // One Cypress/vite server at a time (avoids port 5173/5174/5192 races on Windows).
  maxConcurrency: 1,
  dependencies: adapterDeps,
})

const [, , command, ...args] = process.argv
if (!["build", "dev", "test"].includes(command)) {
  console.error(`Invalid command: ${command}`)
  process.exit(1)
}

const result = await pipeline([
  runtime,
  lib,
  fileRoutes,
  adapterContract,
  adapterNode,
  adapterBun,
  adapterCloudflare,
  devtoolsHost,
  vitePlugin,
  ...(args.includes("--skip-e2e") ? [] : [e2e]),
]).run({
  command,
  onTaskBegin: (taskName) => console.log(`~~~~~ Task begin: ${taskName}`),
  onTaskSkipped: (taskName, _, __, reason) =>
    console.log(`~~~~~ Task skipped: ${taskName} - reason: ${reason}`),
  onTaskComplete: (taskName) => console.log(`~~~~~ Task complete: ${taskName}`),
})

console.log(result)
