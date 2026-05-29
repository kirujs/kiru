import { pnpm } from "@builderman/resolvers-pnpm"

export const noopCmd = {
  run: 'node -e "process.exit(0)"',
  cache: { inputs: [], outputs: [] },
}

/** @param {string} pkgDir */
export function pkgCache(pkgDir) {
  return {
    inputs: ["src", pnpm.package()],
    outputs: ["dist"],
    cwd: pkgDir,
  }
}

export const pipelineHooks = {
  onTaskBegin: (taskName) => console.log(`~~~~~ Task begin: ${taskName}`),
  onTaskSkipped: (taskName, _, __, reason) =>
    console.log(`~~~~~ Task skipped: ${taskName} - reason: ${reason}`),
  onTaskComplete: (taskName) => console.log(`~~~~~ Task complete: ${taskName}`),
}
