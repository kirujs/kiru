import { lazy } from "kiru"

type AppRoute = {
  title: string
  component: Kiru.FC<any>
  fallthrough?: boolean
}

const FilteredListExample = lazy(() => import("shared/src/FilteredListExample"))
const BigListExample = lazy(() => import("shared/src/BigListExample"))
const ContextExample = lazy(() => import("shared/src/ContextExample"))
const ElementBindingsExample = lazy(
  () => import("shared/src/ElementBindingsExample")
)
const MemoExample = lazy(() => import("shared/src/MemoExample"))
const RouterExample = lazy(() => import("shared/src/RouterExample"))
const SignalsExample = lazy(() => import("shared/src/SignalsExample"))
const StoreExample = lazy(() => import("shared/src/StoreExample"))
const TransitionsExample = lazy(() => import("shared/src/TransitionsExample"))
const UseAsyncExample = lazy(() => import("shared/src/UseAsyncExample"))
const UseSyncExternalStoreExample = lazy(
  () => import("shared/src/UseSyncExternalStoreExample")
)
const UseFormExample = lazy(() => import("shared/src/UseFormExample"))

const SWRExample = lazy(() => import("shared/src/SWRExample"))
const WebComponentExample = lazy(() => import("shared/src/WebComponentExample"))

export const ROUTES: Record<string, AppRoute> = {
  "/keyed-list-example": {
    title: "Keyed list",
    component: lazy(() => import("shared/src/KeyedListExample")),
  },
  "/filtered-list-example": {
    title: "Filtered list",
    component: FilteredListExample,
  },
  "/big-list-example": {
    title: "Big list",
    component: BigListExample,
  },
  "/context-example": {
    title: "Context",
    component: ContextExample,
  },
  "/element-bindings-example": {
    title: "Element bindings",
    component: ElementBindingsExample,
  },
  "/memo-example": {
    title: "Memo",
    component: MemoExample,
  },
  "/router-example": {
    title: "Router",
    component: RouterExample,
    fallthrough: true,
  },
  "/signals-example": {
    title: "Signals",
    component: SignalsExample,
    fallthrough: true,
  },
  "/store-example": {
    title: "Store",
    component: StoreExample,
  },
  "/swr-example": {
    title: "SWR",
    component: SWRExample,
  },
  "/transitions-example": {
    title: "Transitions",
    component: TransitionsExample,
  },
  "/use-async-example": {
    title: "useAsync",
    component: UseAsyncExample,
  },
  "/use-sync-external-store-example": {
    title: "useSyncExternalStore",
    component: UseSyncExternalStoreExample,
  },
  "/use-form-example": {
    title: "useForm",
    component: UseFormExample,
  },
  "/web-component-example": {
    title: "Web Components",
    component: WebComponentExample,
  },
}
