import path from "node:path"
import { glob } from "tinyglobby"
import {
  appendUrlSegment,
  parseDirSegment,
  pathHasPrivateSegment,
  urlSegmentsToPath,
} from "./pathFromSegments.js"
import { fileNameMatchesPagePattern } from "./pageFileMatch.js"
import type { FileRouteDirNode, FileRoutesOptions, ScanPagesResult } from "./types.js"
import { DEFAULT_PAGE_FILES } from "./types.js"

const LAYOUT_RE = /^layout\.(tsx|ts|jsx|js|mdx)$/
const MIDDLEWARE_RE = /^middleware\.ts$/
const ERROR_RE = /^error\.(tsx|ts|jsx|js|mdx)$/
const NOT_FOUND_RE = /^not-found\.(tsx|ts|jsx|js|mdx)$/

function createDirNode(
  name: string,
  dirPath: string,
  urlSegments: string[]
): FileRouteDirNode {
  return {
    name,
    dirPath,
    urlSegments,
    children: new Map(),
  }
}

function getOrCreateChild(
  parent: FileRouteDirNode,
  segment: string,
  dirPath: string
): FileRouteDirNode {
  let child = parent.children.get(segment)
  if (!child) {
    const parsed = parseDirSegment(segment)
    child = createDirNode(
      segment,
      dirPath,
      appendUrlSegment(parent.urlSegments, parsed)
    )
    parent.children.set(segment, child)
  }
  return child
}

export async function scanPagesDir(
  options: FileRoutesOptions
): Promise<ScanPagesResult> {
  const pagesDir = path.resolve(options.pagesDir).replace(/\\/g, "/")
  const pageFiles = options.pageFiles ?? [...DEFAULT_PAGE_FILES]
  const root = createDirNode("", pagesDir, [])

  const patterns = [
    "**/*",
    "!**/_*/**",
    "!**/_*",
  ]

  const files = await glob(patterns, {
    cwd: pagesDir,
    onlyFiles: true,
    absolute: true,
  })

  const routes = new Map<string, string>()

  for (const absFile of files) {
    const rel = path.posix.relative(pagesDir, absFile.replace(/\\/g, "/"))
    const parts = rel.split("/")
    if (pathHasPrivateSegment(parts.slice(0, -1))) continue

    const fileName = parts[parts.length - 1]!
    const dirParts = parts.slice(0, -1)

    let node = root
    let currentDir = pagesDir
    for (const segment of dirParts) {
      currentDir = path.posix.join(currentDir, segment)
      node = getOrCreateChild(node, segment, currentDir)
    }

    if (fileNameMatchesPagePattern(fileName, pageFiles)) {
      if (node.page) {
        throw new Error(
          `[file-routes] Multiple leaf files in ${node.dirPath}: ${path.basename(node.page)} and ${fileName}`
        )
      }
      node.page = absFile.replace(/\\/g, "/")
      const routePath = urlSegmentsToPath(node.urlSegments)
      if (routes.has(routePath)) {
        throw new Error(
          `[file-routes] Duplicate route path ${routePath} (${routes.get(routePath)} and ${absFile})`
        )
      }
      routes.set(routePath, node.page)
      continue
    }

    if (LAYOUT_RE.test(fileName)) {
      if (node.layout) {
        throw new Error(`[file-routes] Multiple layout files in ${node.dirPath}`)
      }
      node.layout = absFile.replace(/\\/g, "/")
      continue
    }

    if (MIDDLEWARE_RE.test(fileName)) {
      if (node.middleware) {
        throw new Error(`[file-routes] Multiple middleware files in ${node.dirPath}`)
      }
      node.middleware = absFile.replace(/\\/g, "/")
      continue
    }

    if (ERROR_RE.test(fileName)) {
      if (node.error) {
        throw new Error(`[file-routes] Multiple error files in ${node.dirPath}`)
      }
      node.error = absFile.replace(/\\/g, "/")
      continue
    }

    if (NOT_FOUND_RE.test(fileName)) {
      if (node.notFound) {
        throw new Error(`[file-routes] Multiple not-found files in ${node.dirPath}`)
      }
      node.notFound = absFile.replace(/\\/g, "/")
    }
  }

  return { root, routes }
}
