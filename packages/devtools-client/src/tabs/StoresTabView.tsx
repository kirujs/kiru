import {
  AppContext,
  Store,
  signal,
  useEffect,
  useLayoutEffect,
  useRequestUpdate,
  useState,
} from "kaioken"
import { kaiokenGlobal, useDevtoolsStore } from "../store"
import { ChevronIcon, FileLink, getNodeName } from "devtools-shared"
import { HMRAccept } from "../../../lib/dist/hmr"
import { cloneTree } from "../utils"
import { ValueEditor } from "devtools-shared/src/ValueEditor"

type StoreSelection = {
  name: string
  store: Store<any, any>
}
const stores = signal<Record<string, Store<any, any>>>({})
kaiokenGlobal?.stores.subscribe((newStores) => {
  stores.value = newStores
})

export function StoresTabView() {
  const storeEntries = Object.entries(stores.value)
  if (storeEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-lg italic text-neutral-400">No stores detected</h2>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start">
      <div className="flex flex-col gap-2 w-full">
        {storeEntries.map(([name, store]) => (
          <StoreView key={name} selection={{ name, store }} />
        ))}
      </div>
    </div>
  )
}

function StoreView({ selection }: { selection: StoreSelection }) {
  const [expanded, setExpanded] = useState(false)
  const requestUpdate = useRequestUpdate()
  useLayoutEffect(() => {
    const unsubscribe = selection.store.subscribe(() => requestUpdate())
    return () => unsubscribe()
  }, [])

  return (
    <div className="flex flex-col">
      <div
        onclick={() => setExpanded(!expanded)}
        className={
          "flex items-center gap-2 justify-between px-2 py-1 border border-white border-opacity-10 cursor-pointer" +
          (expanded
            ? " bg-white bg-opacity-5 text-neutral-100 rounded-t"
            : " hover:bg-white hover:bg-opacity-10 text-neutral-400 rounded")
        }
      >
        {selection.name}
        <div className="flex gap-2">
          <FileLink fn={selection.store} onclick={(e) => e.stopPropagation()} />
          <ChevronIcon
            className={`transition-all` + (expanded ? " rotate-90" : "")}
          />
        </div>
      </div>
      {expanded && <StoreSubscribers store={selection.store} />}
    </div>
  )
}

function StoreSubscribers({ store }: { store: Store<any, any> }) {
  const {
    value: { apps },
  } = useDevtoolsStore()

  if (apps.length === 0) return null

  return (
    <>
      {apps.map((app) => {
        if (!app.mounted || !app.rootNode) return null
        return <StoreSubscriberAppTree store={store} app={app} />
      })}
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

type NodeStateMap = WeakMap<Kaioken.VNode, NodeState>

type InternalStoreState = {
  value: any
  subscribers: Set<Kaioken.VNode | Function>
  nodeStateMap: NodeStateMap
}

const $HMR_ACCEPT = Symbol.for("kaioken.hmrAccept")
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
  const { subscribers, nodeStateMap, value } = getStoreInternals(store)
  const root = app.rootNode!.child

  useEffect(() => {
    const handleUpdate = (appCtx: AppContext) => {
      if (appCtx !== app) return
      requestUpdate()
    }
    kaiokenGlobal?.on("update", handleUpdate)
    return () => kaiokenGlobal?.off("update", handleUpdate)
  }, [])

  if (!root) return null

  const clonedTree = cloneTree(root, (node) => subscribers.has(node as any)) as
    | KNodeTreeNode
    | undefined

  return (
    <div className="flex flex-col gap-2 p-2 rounded-b border border-white border-opacity-10">
      <b>{app.name}</b>
      <ValueEditor
        data={{ value }}
        mutable={false}
        objectRefAcc={[]}
        onChange={() => {}}
      />
      {clonedTree && (
        <ul className="pl-8">
          <TreeNodeView node={clonedTree} nodeStateMap={nodeStateMap} />
        </ul>
      )}
    </div>
  )
}

type KNodeTreeNode = {
  ref: Kaioken.VNode
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
          <div
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
          </div>
          {expanded && sliceComputations && (
            <div className="flex flex-col gap-2 p-2 bg-[#1a1a1a]">
              {sliceComputations.map((sliceCompute) => (
                <div className="flex flex-col gap-2">
                  <div className="p-2 bg-black bg-opacity-30 text-sm">
                    <h5 className="border-b border-white border-opacity-10">
                      Slice:
                    </h5>
                    <pre className="text-neutral-400">
                      {JSON.stringify(sliceCompute.value, null, 2)}
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
