#!/usr/bin/env node
/**
 * Summarize repo-local Cypress profile disk use after parallel e2e runs.
 * Usage: node scripts/builderman/cypress-disk-usage.mjs
 */
import fs from "node:fs"
import path from "node:path"
import {
  profilesRoot,
  sharedBinaryCache,
} from "./cypress-profile.mjs"

/** @param {string} dir */
function dirSizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) total += dirSizeBytes(full)
    else if (entry.isFile()) total += fs.statSync(full).size
  }
  return total
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
}

/** @param {string} root */
function profileBreakdown(root) {
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const full = path.join(root, e.name)
      return { id: e.name, bytes: dirSizeBytes(full) }
    })
    .sort((a, b) => b.bytes - a.bytes)
}

const binaryBytes = dirSizeBytes(sharedBinaryCache)
const profiles = profileBreakdown(profilesRoot)
const profilesTotal = profiles.reduce((n, p) => n + p.bytes, 0)

console.log("Cypress local cache disk usage")
console.log("==============================")
console.log(`Shared binary (${sharedBinaryCache}): ${formatBytes(binaryBytes)}`)
console.log(
  `Profiles total (${profilesRoot}): ${formatBytes(profilesTotal)} (${profiles.length} dirs)`
)
for (const p of profiles) {
  console.log(`  ${p.id}: ${formatBytes(p.bytes)}`)
}
console.log(`Grand total: ${formatBytes(binaryBytes + profilesTotal)}`)
