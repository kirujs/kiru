import { lazy } from "kaioken"

type AppRoute = {
  title: string
  component: Kaioken.FC<any>
  fallthrough?: boolean
}

const KeyedListExample = lazy(() => import("./components/KeyedListExample"))
const FilteredListExample = lazy(
  () => import("./components/FilteredListExample")
)
const BigListExample = lazy(() => import("./components/BigListExample"))
const ContextExample = lazy(() => import("./components/ContextExample"))
const UseModelExample = lazy(() => import("./components/UseModelExample"))
const MemoExample = lazy(() => import("./components/MemoExample"))
const RouterExample = lazy(() => import("./components/RouterExample"))
const SignalsExample = lazy(() => import("./components/SignalsExample"))
const StoreExample = lazy(() => import("./components/StoreExample"))
const TransitionsExample = lazy(() => import("./components/TransitionsExample"))
const UseAsyncExample = lazy(() => import("./components/UseAsyncExample"))
const UseSyncExternalStoreExample = lazy(
  () => import("./components/UseSyncExternalStoreExample")
)
const UseFormExample = lazy(() => import("./components/UseFormExample"))

const SWRExample = lazy(() => import("./components/SWRExample"))

export const ROUTES: Record<string, AppRoute> = {
  "/keyed-list-example": {
    title: "Keyed list",
    component: KeyedListExample,
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
  "/use-model-example": {
    title: "useModel",
    component: UseModelExample,
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
}
