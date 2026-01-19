import { task, pipeline } from "builderman"

const lib = task({
    name: "lib",
    cwd: "packages/lib",
    commands: {
      build: "pnpm build",
      dev: {
        run: "pnpm dev",
        readyWhen: (output) => output.includes("Watching for file changes."),
      },
    },
  }),
  devtools = ["client", "host"].map((name) => {
    name = `devtools-${name}`
    return task({
      name,
      cwd: `packages/${name}`,
      commands: {
        build: "pnpm build",
        dev: {
          run: "pnpm dev",
          readyWhen: (output) => output.includes("Build complete!"),
        },
      },
      dependencies: [lib],
    })
  }),
  vitePlugin = task({
    name: "vite-plugin-kiru",
    cwd: "packages/vite-plugin-kiru",
    commands: {
      build: "pnpm build",
      dev: "pnpm dev",
    },
    dependencies: [lib, ...devtools],
  }),
  kiruTest = task({
    name: "test-kiru",
    cwd: "packages/lib",
    commands: {
      test: {
        run: "pnpm test",
        env: {
          NODE_ENV: "development",
        },
      },
    },
    dependencies: [],
  }),
  csrTest = task({
    name: "e2e:csr",
    cwd: "e2e/csr",
    commands: {
      test: {
        run: "pnpm test",
        env: {
          NODE_ENV: "development",
        },
      },
    },
    dependencies: [kiruTest],
  }),
  ssgTest = task({
    name: "e2e:ssg",
    cwd: "e2e/ssg",
    commands: {
      test: {
        run: "pnpm test",
        env: {
          NODE_ENV: "development",
        },
      },
    },
    // github can't run two cypress tests in parallel
    dependencies: process.env.GITHUB ? [csrTest] : [],
  })

const argv = process.argv.slice(2)
const command = argv[0]

const result = await pipeline([
  lib,
  ...devtools,
  vitePlugin,
  kiruTest,
  csrTest,
  ssgTest,
]).run({
  command,
  onTaskBegin: (taskName) => console.log(`~~~~~ Task begin: ${taskName}`),
  onTaskSkipped: (taskName) => console.log(`~~~~~ Task skipped: ${taskName}`),
  onTaskComplete: (taskName) => console.log(`~~~~~ Task complete: ${taskName}`),
})

if (result.ok) {
  console.log("~~~~~ Pipeline complete")
} else {
  console.error("~~~~~ Pipeline failed")
}
