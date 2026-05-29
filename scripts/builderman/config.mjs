import os from "node:os"
import { ensureSharedCypressBinary } from "./cypress-profile.mjs"

export const isGitHub = process.env.GITHUB === "true"

export const cpus = os.availableParallelism?.() ?? 8
export const defaultLocalE2eConcurrency = 8
export const e2eConcurrency = Math.max(
  1,
  Number(process.env.KIRU_E2E_CONCURRENCY) ||
    Math.min(cpus, defaultLocalE2eConcurrency)
)
/** Cypress parallel locally; strictly serial on GitHub Actions. */
export const cypressConcurrency = isGitHub ? 1 : e2eConcurrency

export const packageTestConcurrency = cpus

export const e2eDiag = process.env.KIRU_E2E_DIAG === "1"
export const e2eDiagFilter = process.env.KIRU_E2E_DIAG_FILTER

export function logBuildermanStartup() {
  ensureSharedCypressBinary()
  if (isGitHub) {
    console.log("Cypress tasks: serial (GITHUB=true)")
  }
  if (e2eDiag) {
    console.log("[e2e-diag] builderman startup", {
      cpus: os.cpus().length,
      freemem: os.freemem(),
      totalmem: os.totalmem(),
      cypressConcurrency,
      e2eConcurrency,
      filter: e2eDiagFilter ?? "full",
    })
  }
}

export const e2eGitHubOpts = isGitHub ? { maxConcurrency: 1 } : {}
