// @ts-check
import { pipeline } from "builderman"
import { logBuildermanStartup } from "./scripts/builderman/config.mjs"
import { e2e } from "./scripts/builderman/e2e.mjs"
import { packagesBuild, packagesTest } from "./scripts/builderman/packages.mjs"
import { pipelineHooks } from "./scripts/builderman/shared.mjs"

logBuildermanStartup()

const [, , command, ...args] = process.argv
if (!["build", "dev", "test"].includes(command)) {
  console.error(`Invalid command: ${command}`)
  process.exit(1)
}

const result = await pipeline([
  packagesBuild,
  packagesTest,
  ...(args.includes("--skip-e2e") ? [] : [e2e]),
]).run({
  command,
  ...pipelineHooks,
})

console.log(result)
if (!result.ok) {
  process.exitCode = 1
}
