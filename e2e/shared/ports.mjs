/**
 * Fixed local ports per e2e app / Cypress shard so builderman can run suites in parallel.
 * Do not reuse a port — `freeListeningPort` kills listeners on that port (Windows).
 *
 * Blocks: dev 5173–5197, hmr 8003–8030, matrix hmr 8040–8052 (see cellHmrPort).
 */
export const e2ePorts = {
  csr: {
    core: { dev: 5173, hmr: 8003 },
    features: { dev: 5180, hmr: 8027 },
    advanced: { dev: 5181, hmr: 8028 },
  },
  ssg: { dev: 5174, hmr: 8030 },
  ssr: {
    core: { dev: 5192, hmr: 8022 },
    loaders: { dev: 5196, hmr: 8025 },
    streaming: { dev: 5197, hmr: 8029 },
    actions: { dev: 5195, hmr: 8026 },
    prod: 5193,
  },
  fileRoutes: { dev: 5175, hmr: 8015 },
  fileRoutesSsr: { dev: 5194, hmr: 8024, prod: 5194 },
  fileRoutesSsg: { dev: 5176, hmr: 8016 },
  compileOpts: { dev: 5177, hmr: 8017 },
  primitive: { dev: 5178, hmr: 8018 },
  dom: { dev: 5179, hmr: 8019 },
}

/** @param {number} fallback */
export function envDevPort(fallback) {
  const n = Number(process.env.KIRU_E2E_DEV_PORT)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** @param {number} fallback */
export function envHmrPort(fallback) {
  const n = Number(process.env.KIRU_E2E_HMR_PORT)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Collect `{ key, port }` from nested e2ePorts (leaf numbers and dev/hmr/prod fields). */
function collectPortAssignments(obj, prefix = "", acc = []) {
  if (typeof obj === "number") {
    acc.push({ key: prefix, port: obj })
    return acc
  }
  if (obj && typeof obj === "object") {
    for (const [name, value] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${name}` : name
      if (typeof value === "number") {
        acc.push({ key, port: value })
      } else if (value && typeof value === "object") {
        collectPortAssignments(value, key, acc)
      }
    }
  }
  return acc
}

/** Throws if the same port is used by different e2e apps/shards. */
export function assertNoPortCollisions() {
  const entries = collectPortAssignments(e2ePorts)
  /** @type {Map<number, string>} */
  const byPort = new Map()
  for (const { key, port } of entries) {
    const owner = key.replace(/\.(dev|hmr|prod)$/, "")
    const existing = byPort.get(port)
    if (existing) {
      const existingOwner = existing.replace(/\.(dev|hmr|prod)$/, "")
      if (existingOwner !== owner) {
        throw new Error(
          `[e2e/ports] port ${port} assigned to both ${existing} and ${key}`
        )
      }
    } else {
      byPort.set(port, key)
    }
  }
}

assertNoPortCollisions()
