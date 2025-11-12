import type { FileRouterContextType } from "./context"
import type { PageConfig } from "./types"
import type { NavGuardBuilder } from "./guard"

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

export interface GuardModule {
  guard: NavGuardBuilder
}

export interface ViteImportMap {
  [fp: string]: () => Promise<DefaultComponentModule>
}

export interface FormattedViteImportMapEntry<T = DefaultComponentModule> {
  filePath: string
  load: () => Promise<T>
  params: string[]
  route: string
  segments: string[]
  specificity: number
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
  invalidate: FileRouterContextType["invalidate"]
  navigate: FileRouterContextType["navigate"]
  reload: FileRouterContextType["reload"]
  subscribe: (
    cb: (page: CurrentPage | null, props: Record<string, unknown>) => void
  ) => () => void
}
