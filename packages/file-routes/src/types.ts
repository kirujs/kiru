export const DEFAULT_PAGE_FILES = [
  "page.{tsx,ts,jsx,js}",
  "index.{tsx,ts,jsx,js}",
] as const

export type FileRoutesOptions = {
  /** Absolute path to the pages directory. */
  pagesDir: string
  /** Absolute path to the generated routes module. */
  outFile: string
  /** Glob patterns relative to each directory for leaf routes. */
  pageFiles?: string[]
}

export type FileRouteDirNode = {
  /** Directory segment name; empty string for the pages root. */
  name: string
  /** Absolute path to this directory. */
  dirPath: string
  /** URL path segments contributed by ancestors (excluding route groups). */
  urlSegments: string[]
  layout?: string
  middleware?: string
  error?: string
  notFound?: string
  page?: string
  children: Map<string, FileRouteDirNode>
}

export type ScanPagesResult = {
  root: FileRouteDirNode
  /** route path → page file abs path */
  routes: Map<string, string>
}
