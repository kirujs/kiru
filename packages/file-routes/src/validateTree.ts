import { isCatchAllToken } from "./pathFromSegments.js"
import type { FileRouteDirNode } from "./types.js"

export function validateTree(root: FileRouteDirNode): void {
  const paths = new Set<string>()
  walk(root, paths)
}

function walk(node: FileRouteDirNode, paths: Set<string>): void {
  if (node.page) {
    const segments = node.urlSegments
    for (let i = 0; i < segments.length; i++) {
      if (isCatchAllToken(segments[i]!) && i !== segments.length - 1) {
        throw new Error(
          `[file-routes] Catch-all segment "${segments[i]}" must be the last segment in ${node.page}`
        )
      }
    }
    const pathKey = segments.length === 0 ? "/" : "/" + segments.join("/")
    if (paths.has(pathKey)) {
      throw new Error(`[file-routes] Duplicate route path ${pathKey}`)
    }
    paths.add(pathKey)
  }

  for (const child of node.children.values()) {
    walk(child, paths)
  }
}
