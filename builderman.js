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
      cache: libCacheConfig,
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

const adapterNode = task({
  name: "adapter-node",
  cwd: "packages/adapter-node",
  commands: {
    build: {
      run: "pnpm build",
      cache: pkgCache("packages/adapter-node"),
      dependencies: [lib, runtime],
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
      dependencies: [adapterNode, lib, runtime],
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
      dependencies: [lib, runtime],
    },
  },
})

const vitePluginCacheConfig = {
  inputs: [
    "src",
    lib.artifact("build"),
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
      dependencies: [lib, devtoolsHost, runtime, adapterCloudflare],
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

const adapterDeps = [lib, vitePlugin, runtime, adapterNode, adapterBun, adapterCloudflare]

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

const ssgTest = task({
  ...sharedE2EConfig,
  name: "e2e:ssg",
  cwd: "e2e/ssg",
})

const ssrTest = task({
  ...sharedE2EConfig,
  name: "e2e:ssr",
  cwd: "e2e/ssr",
})

const ssrBunTest = task({
  ...sharedE2EConfig,
  name: "e2e:ssr-bun",
  cwd: "e2e/ssr-bun",
})

const ssrWorkerTest = task({
  ...sharedE2EConfig,
  name: "e2e:ssr-worker",
  cwd: "e2e/ssr-worker",
})

const e2e = pipeline([csrTest, ssgTest, ssrTest, ssrBunTest, ssrWorkerTest]).toTask({
  name: "e2e",
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
