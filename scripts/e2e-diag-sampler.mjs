#!/usr/bin/env node
/**
 * Background CPU/memory/port sampler for KIRU_E2E_DIAG runs.
 * Usage: node scripts/e2e-diag-sampler.mjs &
 */
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { diagDir, isDiagEnabled } from "../e2e/shared/e2e-diag.mjs"
import { e2ePorts } from "../e2e/shared/ports.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const intervalMs = Number(process.env.KIRU_E2E_DIAG_INTERVAL_MS) || 500
const outFile = path.join(diagDir(), "sampler.jsonl")

/** @type {os.CpuInfo[] | null} */
let prevCpus = null

function cpuUsagePct() {
  const cpus = os.cpus()
  if (!prevCpus) {
    prevCpus = cpus
    return 0
  }
  let idle = 0
  let total = 0
  for (let i = 0; i < cpus.length; i++) {
    const t = cpus[i].times
    const p = prevCpus[i].times
    const idleD = t.idle - p.idle
    const totalD =
      t.user -
      p.user +
      (t.nice - p.nice) +
      (t.sys - p.sys) +
      (t.idle - p.idle) +
      (t.irq - p.irq)
    idle += idleD
    total += totalD
  }
  prevCpus = cpus
  if (total <= 0) return 0
  return Math.round((1 - idle / total) * 1000) / 10
}

/** @param {object} obj @param {number[]} acc */
function collectPorts(obj, acc = []) {
  if (typeof obj === "number") {
    acc.push(obj)
    return acc
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) {
      if (typeof v === "number") acc.push(v)
      else if (v && typeof v === "object") collectPorts(v, acc)
    }
  }
  return acc
}

const probePorts = [...new Set(collectPorts(e2ePorts))]

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port, timeout: 80 }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function activeDevPorts() {
  let n = 0
  const open = []
  for (const port of probePorts) {
    if (await portOpen(port)) {
      n++
      open.push(port)
    }
  }
  return { n, open }
}

async function sample() {
  const total = os.totalmem()
  const free = os.freemem()
  const { n, open } = await activeDevPorts()
  const line = JSON.stringify({
    ts: Date.now(),
    freemem: free,
    totalmem: total,
    memUsedPct: Math.round((1 - free / total) * 1000) / 10,
    cpuPct: cpuUsagePct(),
    activeDevPorts: n,
    openPorts: open,
    loadavg: os.loadavg(),
  })
  fs.appendFileSync(outFile, `${line}\n`, "utf8")
}

if (!isDiagEnabled()) {
  console.error("[e2e-diag-sampler] KIRU_E2E_DIAG is not set; exiting")
  process.exit(0)
}

console.log(`[e2e-diag-sampler] writing ${outFile} every ${intervalMs}ms`)
const timer = setInterval(() => {
  void sample()
}, intervalMs)
void sample()

process.on("SIGINT", () => {
  clearInterval(timer)
  process.exit(0)
})
process.on("SIGTERM", () => {
  clearInterval(timer)
  process.exit(0)
})
