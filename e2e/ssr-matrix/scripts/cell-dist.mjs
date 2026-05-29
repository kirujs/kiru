import { MATRIX_CELL_IDS } from "./cells.mjs"

/** Per-cell build output so matrix cells can run in parallel. */
export function cellDistRoot(cellId) {
  return `dist/cells/${cellId}`
}

/** Unique HMR websocket port per matrix cell (8040–8052). */
export function cellHmrPort(cellId) {
  const index = MATRIX_CELL_IDS.indexOf(cellId)
  if (index < 0) {
    throw new Error(`Unknown matrix cell id for HMR port: ${cellId}`)
  }
  return 8040 + index
}

export function cellClientOutDir(cellId) {
  return `${cellDistRoot(cellId)}/client`
}

export function cellServerIndex(cellId) {
  return `${cellDistRoot(cellId)}/server/index.js`
}

export function cellWranglerConfig(cellId) {
  return `wrangler.${cellId}.toml`
}
