import { AppContext, useEffect, useRequestUpdate } from "kiru"
import { isVNodeDeleted } from "kiru/utils"
import { applyObjectChangeFromKeys, getNodeName } from "./utils"
import { NodeDataSection } from "./NodeDataSection"
import { ValueEditor } from "./ValueEditor"
import { RefreshIcon } from "./icons"
import { FileLink } from "./FileLink"
import { broadcastChannel } from "./broadcastChannel"

type SelectedNodeViewProps = {
  selectedApp: AppContext
  selectedNode: Kiru.VNode & { type: Function }
  setSelectedNode: (node: (Kiru.VNode & { type: Function }) | null) => void
  kiruGlobal: typeof window.__kiru
}

export function SelectedNodeView({
  selectedApp,
  selectedNode,
  setSelectedNode,
  kiruGlobal,
}: SelectedNodeViewProps) {
  const update = useRequestUpdate()

  useEffect(() => {
    const handleUpdate = (appCtx: AppContext) => {
      if (appCtx !== selectedApp) return
      if (isVNodeDeleted(selectedNode)) {
        setSelectedNode(null)
      } else {
        update()
      }
    }

    kiruGlobal?.on("update", handleUpdate)
    return () => kiruGlobal?.off("update", handleUpdate)
  }, [])

  const refresh = () => {
    const w = window.opener
    if (!selectedNode || !w) {
      console.error("invalid refresh state", { w, selectedNode })
      return
    }
    w.__devtoolsNodeUpdatePtr = selectedNode
    broadcastChannel.send({ type: "update-node" })
    console.debug("[kiru]: sent refresh message", selectedNode)
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

type DisplayGroupHook = Kiru.Hook<{
  name: "devtools:useHookDebugGroup"
  displayName: string
  action: "start" | "end"
}>
type HookGroupNode = {
  parent: HookGroupNode | null
  name: string
  children: (Kiru.Hook<any> | HookGroupNode)[]
  [hookGroupSymbol]: true
}
function isDisplayGroupHook(hook: Kiru.Hook<any>): hook is DisplayGroupHook {
  return hook.name === "devtools:useHookDebugGroup"
}
function isHookGroupNode(
  node: HookGroupNode | Kiru.Hook<any>
): node is HookGroupNode {
  return hookGroupSymbol in node
}

const hookGroupSymbol = Symbol.for("devtools.hookGroup")
function makeHookTree(node: Kiru.VNode) {
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
  node: HookGroupNode | Kiru.Hook<any>
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
  const { name, dev, cleanup, ...rest } = node as Kiru.Hook<{}>
  const devtools = dev?.devtools
  const data = typeof devtools?.get === "function" ? devtools.get() : rest

  const handleChange = (keys: string[], value: unknown) => {
    if (!selectedApp || !devtools?.set || !devtools?.get) return
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
