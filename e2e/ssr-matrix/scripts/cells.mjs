/** @typedef {"node" | "bun" | "cloudflare"} MatrixAdapter */

/** @typedef {"vite" | "bun-vite"} MatrixBuild */

/**
 * @typedef {object} MatrixCell
 * @property {string} id
 * @property {"node" | "bun" | "wrangler"} runtime
 * @property {MatrixAdapter} adapter
 * @property {string} serverEntry
 * @property {MatrixBuild} build
 * @property {boolean} [frameworkHealth] `/api/health` wired outside Kiru
 * @property {(port: number) => { command: string, args: string[], shell?: boolean }} start
 */

/** All matrix cells (Node/Bun full grid + Worker fetch/hono/elysia). */
export const MATRIX_CELL_IDS = [
  "node-fetch",
  "node-hono",
  "node-express",
  "node-fastify",
  "node-elysia",
  "bun-fetch",
  "bun-hono",
  "bun-express",
  "bun-fastify",
  "bun-elysia",
  "worker-fetch",
  "worker-hono",
  "worker-elysia",
]

/** @type {MatrixCell[]} */
export const cells = [
  {
    id: "node-fetch",
    runtime: "node",
    adapter: "node",
    serverEntry: "./src/servers/node-fetch.ts",
    build: "vite",
    frameworkHealth: false,
    start() {
      return { command: "node", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "node-hono",
    runtime: "node",
    adapter: "node",
    serverEntry: "./src/servers/node-hono.ts",
    build: "vite",
    frameworkHealth: true,
    start() {
      return { command: "node", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "node-express",
    runtime: "node",
    adapter: "node",
    serverEntry: "./src/servers/node-express.ts",
    build: "vite",
    frameworkHealth: true,
    start() {
      return { command: "node", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "node-fastify",
    runtime: "node",
    adapter: "node",
    serverEntry: "./src/servers/node-fastify.ts",
    build: "vite",
    frameworkHealth: true,
    start() {
      return { command: "node", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "node-elysia",
    runtime: "node",
    adapter: "node",
    serverEntry: "./src/servers/node-elysia.ts",
    build: "vite",
    frameworkHealth: true,
    start() {
      return { command: "node", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "bun-fetch",
    runtime: "bun",
    adapter: "bun",
    serverEntry: "./src/servers/bun-fetch.ts",
    build: "bun-vite",
    frameworkHealth: false,
    start() {
      return { command: "bun", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "bun-hono",
    runtime: "bun",
    adapter: "bun",
    serverEntry: "./src/servers/bun-hono.ts",
    build: "bun-vite",
    frameworkHealth: true,
    start() {
      return { command: "bun", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "bun-express",
    runtime: "bun",
    adapter: "bun",
    serverEntry: "./src/servers/bun-express.ts",
    build: "bun-vite",
    frameworkHealth: true,
    start() {
      return { command: "bun", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "bun-fastify",
    runtime: "bun",
    adapter: "bun",
    serverEntry: "./src/servers/bun-fastify.ts",
    build: "bun-vite",
    frameworkHealth: true,
    start() {
      return { command: "bun", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "bun-elysia",
    runtime: "bun",
    adapter: "bun",
    serverEntry: "./src/servers/bun-elysia.ts",
    build: "bun-vite",
    frameworkHealth: true,
    start() {
      return { command: "bun", args: ["dist/server/index.js"] }
    },
  },
  {
    id: "worker-fetch",
    runtime: "wrangler",
    adapter: "cloudflare",
    serverEntry: "./src/servers/worker-fetch.ts",
    build: "vite",
    frameworkHealth: true,
    start(port) {
      return { command: "wrangler-dev", args: [String(port)] }
    },
  },
  {
    id: "worker-hono",
    runtime: "wrangler",
    adapter: "cloudflare",
    serverEntry: "./src/servers/worker-hono.ts",
    build: "vite",
    frameworkHealth: true,
    start(port) {
      return { command: "wrangler-dev", args: [String(port)] }
    },
  },
  {
    id: "worker-elysia",
    runtime: "wrangler",
    adapter: "cloudflare",
    serverEntry: "./src/servers/worker-elysia.ts",
    build: "vite",
    frameworkHealth: true,
    start(port) {
      return { command: "wrangler-dev", args: [String(port)] }
    },
  },
]

/**
 * @param {string} [cellId]
 * @returns {MatrixCell}
 */
export function getCellConfig(cellId) {
  const id = cellId ?? process.env.KIRU_MATRIX_CELL ?? "node-fetch"
  const cell = cells.find((c) => c.id === id)
  if (!cell) {
    throw new Error(
      `Unknown KIRU_MATRIX_CELL="${id}". Valid: ${cells.map((c) => c.id).join(", ")}`
    )
  }
  return cell
}
