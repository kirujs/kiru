export const DEFAULT_PAGE_FILES = [
  "page.{tsx,ts,jsx,js}",
  "index.{tsx,ts,jsx,js}",
] as const

export const DEFAULT_LAYOUT_FILES = [
  "layout.{tsx,ts,jsx,js,mdx}",
] as const

export const DEFAULT_ERROR_FILES = [
  "error.{tsx,ts,jsx,js,mdx}",
] as const

export const DEFAULT_NOT_FOUND_FILES = [
  "not-found.{tsx,ts,jsx,js,mdx}",
] as const

export type FileRoutesOptions = {
  /** Absolute path to the pages directory. */
  pagesDir: string
  /** Absolute path to the generated routes module. */
  outFile: string
  /** Glob patterns relative to each directory for leaf routes. */
  pageFiles?: string[]
  /** Glob patterns for layout files in each directory. */
  layoutFiles?: string[]
  /** Glob patterns for error boundary files in each directory. */
  errorFiles?: string[]
  /** Glob patterns for not-found files in each directory. */
  notFoundFiles?: string[]
  /**
   * Emit `declare module "kiru/router" { interface RouteTree { ... } }`.
   * Disable for test fixtures so multiple generated files do not clash in the IDE.
   * @default true
   */
  augmentRouteTree?: boolean
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
  /** Absolute path to `scope.config.ts` / `scope.config.js`. */
  scopeConfig?: string
  /** Absolute path to `{page}.config.ts` paired with {@link page}. */
  pageConfig?: string
  children: Map<string, FileRouteDirNode>
}

export type ScanPagesResult = {
  root: FileRouteDirNode
  /** route path → page file abs path */
  routes: Map<string, string>
}
