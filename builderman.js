// @ts-check
import { task, pipeline } from "builderman"
import { pnpm } from "@builderman/resolvers-pnpm"

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

const vitePlugin = task({
  name: "vite-plugin-kiru",
  cwd: "packages/vite-plugin-kiru",
  commands: {
    build: {
      run: "pnpm build",
      cache: {
        inputs: [
          "src",
          lib.artifact("build"),
          devtoolsHost.artifact("build"),
          pnpm.package(),
        ],
        outputs: ["dist"],
      },
    },
    dev: {
      run: "pnpm dev",
      dependencies: [lib, devtoolsHost],
    },
  },
})

const E2ECachConfig = {
  inputs: [
    "src",
    lib.artifact("build"),
    vitePlugin.artifact("build"),
    pnpm.package(),
  ],
  outputs: ["dist"],
}

const sharedE2EConfig = {
  commands: {
    build: { run: "pnpm build", cache: E2ECachConfig },
    test: { run: "pnpm test", cache: E2ECachConfig },
  },
  dependencies: [lib, vitePlugin],
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

const e2e = pipeline([csrTest, ssgTest, ssrTest]).toTask({
  name: "e2e",
  maxConcurrency: 1,
  dependencies: [lib, vitePlugin],
})

const [, , command, ...args] = process.argv
if (!["build", "dev", "test"].includes(command)) {
  console.error(`Invalid command: ${command}`)
  process.exit(1)
}

const result = await pipeline([
  lib,
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
