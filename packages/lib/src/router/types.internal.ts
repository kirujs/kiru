import type { FileRouterContextType } from "./context"
import type { PageConfig } from "./types"

export interface CurrentPage {
  component: Kiru.FC<any>
  config?: PageConfig
  route: string
}

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
  specificity: number
  segments: string[]
  absolutePath: string
  folderPath: string
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

export interface DevtoolsInterface {
  getPages: () => FormattedViteImportMap<PageModule>
  getLayouts: () => FormattedViteImportMap
  navigate: FileRouterContextType["navigate"]
  reload: FileRouterContextType["reload"]
  invalidate: FileRouterContextType["invalidate"]
  subscribe: (
    cb: (page: CurrentPage | null, props: Record<string, unknown>) => void
  ) => () => void
}
