import path from "node:path"
import { resolveSingleModulePattern } from "./resolveModulePattern.js"
import { DEFAULT_PAGE_FILES } from "@kirujs/file-routes"

export type ResolvedFileRoutes = {
  pagesDir: string
  pagesDirAbs: string
  outFile: string
  outFileAbs: string
  pageFiles: string[]
  extend?: string
  extendAbs?: string
}

export type FileRoutesPluginOption =
  | boolean
  | {
      dir?: string
      outFile?: string
      pageFiles?: string[]
      extend?: string
    }

export function resolveFileRoutesOption(
  value: FileRoutesPluginOption | undefined,
  projectRoot: string
): ResolvedFileRoutes | null {
  if (!value) return null
  const config = value === true ? {} : value
  const pagesDir = config.dir ?? "./src/pages"
  const outFile = config.outFile ?? "./src/routes.gen.ts"
  const pagesDirAbs = path.resolve(projectRoot, pagesDir).replace(/\\/g, "/")
  const outFileAbs = path.resolve(projectRoot, outFile).replace(/\\/g, "/")
  return {
    pagesDir,
    pagesDirAbs,
    outFile,
    outFileAbs,
    pageFiles: config.pageFiles ?? [...DEFAULT_PAGE_FILES],
    extend: config.extend,
    extendAbs: undefined,
  }
}

export function reconcileFileRoutesPaths(
  fileRoutes: ResolvedFileRoutes,
  projectRoot: string
): void {
  fileRoutes.pagesDirAbs = path
    .resolve(projectRoot, fileRoutes.pagesDir)
    .replace(/\\/g, "/")
  fileRoutes.outFileAbs = path
    .resolve(projectRoot, fileRoutes.outFile)
    .replace(/\\/g, "/")
}

export async function resolveFileRoutesPaths(
  fileRoutes: ResolvedFileRoutes,
  projectRoot: string
): Promise<void> {
  reconcileFileRoutesPaths(fileRoutes, projectRoot)
  if (fileRoutes.extend) {
    fileRoutes.extendAbs = await resolveSingleModulePattern(
      fileRoutes.extend,
      projectRoot,
      "router.fileRoutes.extend"
    )
  }
}

/** Default routes module when file routes are enabled. */
export function defaultRoutesModuleForFileRoutes(
  fileRoutes: ResolvedFileRoutes
): string {
  return fileRoutes.outFile
}
