import {
  AppContext,
  Store,
  computed,
  signal,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRequestUpdate,
  useState,
} from "kiru"
import { kiruGlobal, mountedApps } from "../state"
import {
  applyObjectChangeFromKeys,
  ChevronIcon,
  FileLink,
  Filter,
  getNodeName,
  TriangleAlertIcon,
} from "devtools-shared"
import { HMRAccept } from "../../../lib/dist/hmr"
import { cloneTree } from "../utils"
import { ValueEditor } from "devtools-shared/src/ValueEditor"

const stores = signal<Record<string, Store<any, any>>>({})
const expandedItems = signal<Store<any, any>[]>([])
kiruGlobal?.stores?.subscribe((newStores) => {
  stores.value = newStores
  expandedItems.value = expandedItems.value.filter((s) =>
    Object.values(stores.value).includes(s)
  )
})

const filterValue = signal("")
const filterTerms = computed(() =>
  filterValue.value
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 0)
)
function keyMatchesFilter(key: string) {
  return filterTerms.value.every((term) => key.toLowerCase().includes(term))
}

export function StoresTabView() {
  const storeEntries = Object.entries(stores.value)
  if (storeEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
        <TriangleAlertIcon />
        <h2 className="text-lg italic">No stores detected</h2>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 items-start">
      <Filter value={filterValue} className="sticky top-0" />
      <div className="flex flex-col gap-2 w-full">
        {storeEntries
          .filter(([name]) => keyMatchesFilter(name))
          .map(([name, store]) => (
            <StoreView key={name} name={name} store={store} />
          ))}
      </div>
    </div>
  )
}

type StoreViewProps = {
  name: string
  store: Store<any, any>
}

function StoreView({ name, store }: StoreViewProps) {
  const expanded = expandedItems.value.includes(store)
  const requestUpdate = useRequestUpdate()
  const { value } = getStoreInternals(store)

  useLayoutEffect(() => {
    const unsubscribe = store.subscribe(() => requestUpdate())
    return () => unsubscribe()
  }, [])

  const handleToggle = useCallback(() => {
    if (expanded) {
      expandedItems.value = expandedItems.value.filter((s) => s !== store)
    } else {
      expandedItems.value = [...expandedItems.value, store]
    }
  }, [expanded])

  return (
    <div className="flex flex-col">
      <button
        onclick={handleToggle}
        className={
          "flex items-center gap-2 justify-between p-2 border border-white border-opacity-10 cursor-pointer" +
          (expanded
            ? " bg-white bg-opacity-5 text-neutral-100 rounded-t"
            : " hover:bg-white hover:bg-opacity-10 text-neutral-400 rounded")
        }
      >
        {name}
        <div className="flex gap-2">
          <FileLink fn={store} onclick={(e) => e.stopPropagation()} />
          <ChevronIcon
            className={`transition-all` + (expanded ? " rotate-90" : "")}
          />
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 p-2 border border-white border-opacity-10">
          <ValueEditor
            data={{ value }}
            mutable={true}
            objectRefAcc={[]}
            onChange={(keys, changedValue) => {
              const next = structuredClone({ value })
              applyObjectChangeFromKeys(next, keys, changedValue)
              store.setState(next.value)
            }}
          />
          <StoreSubscribers store={store} />
        </div>
      )}
    </div>
  )
}

function StoreSubscribers({ store }: { store: Store<any, any> }) {
  const apps = mountedApps.value
  if (apps.length === 0) return null

  return (
    <>
      {apps.map((app) => (
        <StoreSubscriberAppTree store={store} app={app} />
      ))}
    </>
  )
}

type NodeState = {
  update: () => void
  slices: {
    sliceFn: Function | null
    eq: ((prev: any, next: any, compare: any) => boolean) | undefined
    value: any
  }[]
}

type NodeStateMap = WeakMap<Kiru.VNode, NodeState>

type InternalStoreState = {
  value: any
  subscribers: Set<Kiru.VNode | Function>
  nodeStateMap: NodeStateMap
}

const $HMR_ACCEPT = Symbol.for("kiru.hmrAccept")
const getStoreInternals = (store: Store<any, any>) => {
  if ($HMR_ACCEPT in store) {
    return (
      store[$HMR_ACCEPT] as HMRAccept<{
        current: InternalStoreState
      }>
    ).provide().current
  }
  throw new Error("Unable to get store subscribers")
}

function StoreSubscriberAppTree({
  store,
  app,
}: {
  store: Store<any, any>
  app: AppContext
}) {
  const requestUpdate = useRequestUpdate()
  const { subscribers, nodeStateMap } = getStoreInternals(store)
  const root = app.rootNode!.child

  useEffect(() => {
    const handleUpdate = (appCtx: AppContext) => {
      if (appCtx !== app) return
      requestUpdate()
    }
    kiruGlobal?.on("update", handleUpdate)
    return () => kiruGlobal?.off("update", handleUpdate)
  }, [])

  if (!root) return null

  const clonedTree = cloneTree(root, (node) =>
    subscribers.has(node as any)
  ) as KNodeTreeNode | null

  return (
    <div className="flex flex-col gap-2 p-2 rounded-b border border-white border-opacity-10">
      <b>{app.name}</b>
      {clonedTree && (
        <ul className="pl-8">
          <TreeNodeView node={clonedTree} nodeStateMap={nodeStateMap} />
        </ul>
      )}
    </div>
  )
}

type KNodeTreeNode = {
  ref: Kiru.VNode
  child?: KNodeTreeNode
  sibling?: KNodeTreeNode
}

function TreeNodeView({
  node,
  nodeStateMap,
}: {
  node: KNodeTreeNode
  nodeStateMap: NodeStateMap
}) {
  const [expanded, setExpanded] = useState(false)
  const nodeState = nodeStateMap.get(node.ref)
  const sliceComputations = nodeState?.slices ?? []

  return (
    <>
      <li className="flex flex-col gap-2">
        <div
          className={
            "flex flex-col border border-white border-opacity-10 rounded" +
            (expanded
              ? " bg-white bg-opacity-5 text-neutral-100"
              : " hover:bg-white hover:bg-opacity-10 text-neutral-400")
          }
        >
          <button
            onclick={() => setExpanded(!expanded)}
            className="flex gap-2 p-2 justify-between cursor-pointer"
          >
            <span>{"<" + getNodeName(node.ref) + " />"}</span>
            <div className="flex gap-2 items-center">
              <FileLink
                fn={node.ref.type as Function}
                onclick={(e) => e.stopPropagation()}
              />
              <ChevronIcon
                className={`transition-all` + (expanded ? " rotate-90" : "")}
              />
            </div>
          </button>
          {expanded && (
            <div className="flex flex-col gap-2 p-2 bg-[#1a1a1a]">
              {sliceComputations.length === 0 && (
                <div className="p-2 bg-black bg-opacity-30 text-sm">
                  <h5 className="border-b border-white border-opacity-10">
                    No slices
                  </h5>
                </div>
              )}
              {sliceComputations.map((sliceCompute) => (
                <div className="flex flex-col gap-2">
                  <div className="p-2 bg-black bg-opacity-30 text-sm">
                    <h5 className="border-b border-white border-opacity-10">
                      Slice:
                    </h5>
                    <pre className="text-neutral-400">
                      <ValueEditor
                        data={{ value: sliceCompute.value }}
                        mutable={false}
                        objectRefAcc={[]}
                        onChange={() => {}}
                      />
                    </pre>
                  </div>
                  <div className="p-2 bg-black bg-opacity-30 text-sm">
                    <h5 className="border-b border-white border-opacity-10">
                      SliceFn:
                    </h5>
                    <pre className="text-neutral-400">
                      {sliceCompute.sliceFn
                        ? sliceCompute.sliceFn.toString()
                        : "null"}
                    </pre>
                  </div>
                  {sliceCompute.eq && (
                    <div className="p-2 bg-black bg-opacity-30 text-sm">
                      <h5 className="border-b border-white border-opacity-10">
                        eq:
                      </h5>
                      <pre className="text-neutral-400">
                        {sliceCompute.eq.toString()}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {node.child && (
          <ul className="pl-8 flex flex-col gap-2">
            <TreeNodeView node={node.child} nodeStateMap={nodeStateMap} />
          </ul>
        )}
      </li>
      {node.sibling && (
        <TreeNodeView node={node.sibling} nodeStateMap={nodeStateMap} />
      )}
    </>
  )
}
