import type { PageConfig } from "./types"

export interface DefaultComponentModule {
  default: Kiru.FC
}

export interface PageModule {
  default: Kiru.FC
  config?: PageConfig
  __KIRU_STATIC_PROPS__?: Record<
    string,
    { data: unknown; error: string | null }
  >
}

export interface ViteImportMap {
  [fp: string]: () => Promise<DefaultComponentModule>
}

export interface FormattedViteImportMapEntry<T = DefaultComponentModule> {
  load: () => Promise<T>
  module?: T
  specificity: number
  segments: string[]
  absolutePath: string
}

export interface FormattedViteImportMap<T = DefaultComponentModule> {
  [key: string]: FormattedViteImportMapEntry<T>
}

export interface RouteMatch {
  route: string
  pageEntry: FormattedViteImportMapEntry<PageModule>
  params: Record<string, string>
  routeSegments: string[]
}
