import { codegenRouteTree } from "./codegenRouteTree.js"
import { scanPagesDir } from "./scanPagesDir.js"
import { validateTree } from "./validateTree.js"
import type { FileRoutesOptions } from "./types.js"

export type { FileRouteDirNode, FileRoutesOptions, ScanPagesResult } from "./types.js"
export {
  DEFAULT_ERROR_FILES,
  DEFAULT_LAYOUT_FILES,
  DEFAULT_NOT_FOUND_FILES,
  DEFAULT_PAGE_FILES,
} from "./types.js"
export { scanPagesDir } from "./scanPagesDir.js"
export { validateTree } from "./validateTree.js"
export { codegenRouteTree } from "./codegenRouteTree.js"
export {
  parseDirSegment,
  urlSegmentsToPath,
  appendUrlSegment,
} from "./pathFromSegments.js"

export type GenerateFileRoutesOptions = FileRoutesOptions & {
  /** Path to module exporting `extendRoutes` (merged into generated tree). */
  extend?: string
}

export type GenerateFileRoutesResult = {
  source: string
  routes: Map<string, string>
}

export async function generateFileRoutes(
  options: GenerateFileRoutesOptions
): Promise<GenerateFileRoutesResult> {
  const { root, routes } = await scanPagesDir(options)
  validateTree(root)
  const { source } = codegenRouteTree(root, options, options.extend)
  return { source, routes }
}
