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
