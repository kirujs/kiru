import type { PageConfig } from "./types"

export interface DefaultComponentModule {
  default: Kiru.FC
}

export interface PageModule {
  default: DefaultComponentModule
  config?: PageConfig
}

export interface ViteImportMap {
  [fp: string]: () => Promise<DefaultComponentModule>
}

export interface FormattedViteImportMap {
  [key: string]: {
    load: () => Promise<DefaultComponentModule>
    specificity: number
    segments: string[]
    filePath?: string
  }
}

export interface RouteMatch {
  route: string
  pageEntry: FormattedViteImportMap[string]
  params: Record<string, string>
  routeSegments: string[]
}
