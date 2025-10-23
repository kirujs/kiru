import type { PageConfig } from "./types"

export interface PageModule {
  default: Kiru.FC
  config?: PageConfig
}

export interface LayoutModule {
  default: Kiru.FC
}

export interface VitePagesImportMap {
  [fp: string]: () => Promise<PageModule>
}

export interface ViteLayoutsImportMap {
  [fp: string]: () => Promise<LayoutModule>
}

export interface LayoutInfo {
  path: string
  module: () => Promise<LayoutModule>
}
