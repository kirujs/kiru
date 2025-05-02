import { AppContext, useEffect, useRequestUpdate } from "kaioken"
import { isVNodeDeleted } from "../../lib/dist/utils.js"
import { applyObjectChangeFromKeys, getNodeName } from "./utils"
import { NodeDataSection } from "./NodeDataSection"
import { ValueEditor } from "./ValueEditor"
import { RefreshIcon } from "./icons"
import { FileLink } from "./FileLink"

type SelectedNodeViewProps = {
  selectedApp: AppContext
  selectedNode: Kaioken.VNode & { type: Function }
  setSelectedNode: (node: (Kaioken.VNode & { type: Function }) | null) => void
  kaiokenGlobal: typeof window.__kaioken
}

export function SelectedNodeView({
  selectedApp,
  selectedNode,
  setSelectedNode,
  kaiokenGlobal,
}: SelectedNodeViewProps) {
  const requestUpdate = useRequestUpdate()

  useEffect(() => {
    const handleUpdate = (appCtx: AppContext) => {
      if (appCtx !== selectedApp) return
      if (isVNodeDeleted(selectedNode)) {
        setSelectedNode(null)
      } else {
        requestUpdate()
      }
    }

    kaiokenGlobal?.on("update", handleUpdate)
    return () => kaiokenGlobal?.off("update", handleUpdate)
  }, [])

  const refresh = () => {
    if (!selectedNode || !selectedApp?.mounted) return
    selectedApp.requestUpdate(selectedNode)
  }

  const nodeProps = { ...selectedNode.props } as Record<string, any>
  delete nodeProps.children

  const nodeHookTree = makeHookTree(selectedNode)

  return (
    <div className="flex-grow p-2 sticky top-0">
      <h2 className="flex justify-between items-center font-bold mb-2 pb-2 border-b-2 border-neutral-800">
        <div className="flex gap-2 items-center">
          {"<" + getNodeName(selectedNode) + ">"}
          <FileLink fn={selectedNode.type} />
        </div>
        <button onclick={refresh}>
          <RefreshIcon className="w-5 h-5" />
        </button>
      </h2>
      <NodeDataSection
        title="props"
        disabled={Object.keys(nodeProps).length === 0}
      >
        <ValueEditor
          data={nodeProps}
          onChange={() => {}}
          mutable={false}
          objectRefAcc={[]}
        />
      </NodeDataSection>
      <HookTreeDisplay node={nodeHookTree} selectedApp={selectedApp} />
    </div>
  )
}

type DisplayGroupHook = Kaioken.Hook<{
  name: "devtools:useHookDebugGroup"
  displayName: string
  action: "start" | "end"
}>
type HookGroupNode = {
  parent: HookGroupNode | null
  name: string
  children: (Kaioken.Hook<any> | HookGroupNode)[]
  [hookGroupSymbol]: true
}
function isDisplayGroupHook(hook: Kaioken.Hook<any>): hook is DisplayGroupHook {
  return hook.name === "devtools:useHookDebugGroup"
}
function isHookGroupNode(
  node: HookGroupNode | Kaioken.Hook<any>
): node is HookGroupNode {
  return hookGroupSymbol in node
}

const hookGroupSymbol = Symbol.for("devtools.hookGroup")
function makeHookTree(node: Kaioken.VNode) {
  const root: HookGroupNode = {
    parent: null,
    name: "hooks",
    children: [],
    [hookGroupSymbol]: true,
  }
  if (node.hooks?.length) {
    let currentParent = root
    for (let i = 0; i < node.hooks.length; i++) {
      const hook = node.hooks[i]
      if (isDisplayGroupHook(hook)) {
        switch (hook.action) {
          case "start":
            const node: HookGroupNode = {
              parent: currentParent,
              name: hook.displayName,
              children: [],
              [hookGroupSymbol]: true,
            }
            currentParent.children.push(node)
            currentParent = node
            break
          case "end":
            if (
              currentParent.name !== hook.displayName ||
              currentParent.parent === null
            ) {
              throw new Error("useHookDebugGroup:end called with no start")
            }
            currentParent = currentParent.parent
            break
        }
        continue
      }

      currentParent.children.push(hook)
    }
  }
  return root
}

function HookTreeDisplay({
  node,
  selectedApp,
  depth = 0,
}: {
  node: HookGroupNode | Kaioken.Hook<any>
  selectedApp: AppContext
  depth?: number
}) {
  if (isHookGroupNode(node)) {
    return (
      <NodeDataSection
        title={node.name}
        className={`bg-[#ffffff04] border border-[#fff1] flex flex-col gap-2 pl-6`}
        disabled={node.children.length === 0}
      >
        {node.children.map((child) => (
          <HookTreeDisplay
            node={child}
            selectedApp={selectedApp}
            depth={depth + 1}
          />
        ))}
      </NodeDataSection>
    )
  }
  const { name, dev, cleanup, ...rest } = node as Kaioken.Hook<{}>
  const devtools = dev?.devtools
  const data = typeof devtools?.get === "function" ? devtools.get() : rest

  const handleChange = (keys: string[], value: unknown) => {
    if (!selectedApp?.mounted || !devtools?.set || !devtools?.get) return
    const data = devtools.get()
    applyObjectChangeFromKeys(data, keys, value)
    devtools.set(data)
  }

  return (
    <div>
      <i className="text-neutral-300 text-sm">{name || "anonymous hook"}</i>
      <div className="p-2">
        <ValueEditor
          data={data}
          onChange={handleChange}
          mutable={!!devtools?.set}
          objectRefAcc={[]}
        />
      </div>
    </div>
  )
}
