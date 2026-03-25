import { task, pipeline } from "builderman"
import { pnpm } from "@builderman/resolvers-pnpm"

const lib = task({
  name: "lib",
  cwd: "packages/lib",
  commands: {
    build: {
      run: "pnpm build",
      cache: {
        inputs: ["src", pnpm.package()],
        outputs: ["dist"],
      },
    },
    dev: {
      run: "pnpm dev",
      readyWhen: (output) => output.includes("Watching for file changes."),
    },
    test: {
      run: "pnpm test",
      cache: {
        inputs: ["src", pnpm.package()],
        outputs: ["dist"],
      },
      env: {
        NODE_ENV: "development",
      },
    },
  },
})

const headlessUi = task({
  name: "headless-ui",
  cwd: "packages/headless-ui",
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
      readyWhen: (output) => output.includes("Watching for file changes."),
    },
    test: {
      run: "pnpm test",
      cache: {
        inputs: ["src", lib.artifact("build"), pnpm.package()],
        outputs: ["dist"],
      },
      env: {
        NODE_ENV: "development",
      },
    },
    env: {
      NODE_ENV: "development",
    },
  },
})

const createDevtoolsTask = (name) =>
  task({
    name,
    cwd: `packages/${name}`,
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

// const devtoolsClient = createDevtoolsTask(
//   "devtools-client",
//   "packages/devtools-client"
// )
const devtoolsHost = createDevtoolsTask(
  "devtools-host",
  "packages/devtools-host"
)
// const devtools = pipeline([devtoolsClient, devtoolsHost]).toTask({
//   name: "devtools",
//   dependencies: [lib],
// })

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
          //devtoolsClient.artifact("build"),
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

const e2eCSR = task({
  name: "e2e:csr",
  cwd: "e2e/csr",
  commands: {
    build: {
      run: "pnpm build",
      cache: {
        inputs: [
          "src",
          lib.artifact("build"),
          vitePlugin.artifact("build"),
          pnpm.package(),
        ],
        outputs: ["dist"],
      },
    },
    test: {
      run: "pnpm test",
      cache: {
        inputs: [
          "src",
          lib.artifact("build"),
          vitePlugin.artifact("build"),
          pnpm.package(),
        ],
        outputs: ["dist"],
      },
    },
  },
  dependencies: [lib],
  env: {
    NODE_ENV: "development",
  },
})

const e2eSSG = task({
  name: "e2e:ssg",
  cwd: "e2e/ssg",
  commands: {
    build: {
      run: "pnpm build",
      cache: {
        inputs: [
          "src",
          lib.artifact("build"),
          vitePlugin.artifact("build"),
          pnpm.package(),
        ],
        outputs: ["dist"],
      },
    },
    test: {
      run: "pnpm test",
      cache: {
        inputs: [
          "src",
          lib.artifact("build"),
          vitePlugin.artifact("build"),
          pnpm.package(),
        ],
        outputs: ["dist"],
      },
    },
  },
  // github can't run two cypress tests in parallel
  dependencies: (process.env.GITHUB ? [e2eCSR] : []).concat(lib),
  env: {
    NODE_ENV: "development",
  },
})

const argv = process.argv.slice(2)
const command = argv[0]
const includeE2E = command !== "test" || argv.includes("--e2e")
if (!includeE2E) {
  console.log("~~~~~ Skipping E2E tests")
}

const result = await pipeline([
  lib,
  headlessUi,
  devtoolsHost,
  vitePlugin,
  ...(includeE2E ? [e2eCSR, e2eSSG] : []),
]).run({
  command,
  onTaskBegin: (taskName) => console.log(`~~~~~ Task begin: ${taskName}`),
  onTaskSkipped: (taskName, _, __, reason) =>
    console.log(`~~~~~ Task skipped: ${taskName} - reason: ${reason}`),
  onTaskComplete: (taskName) => console.log(`~~~~~ Task complete: ${taskName}`),
})

//console.log(JSON.stringify(result, null, 2))
console.log(result)
if (!includeE2E) {
  console.log("~~~~~ E2E tests skipped")
}
