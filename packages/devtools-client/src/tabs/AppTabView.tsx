import {
  assert,
  broadcastChannel,
  BroadcastChannelMessage,
  SelectedNodeView,
} from "devtools-shared"
import { useRequestUpdate, useEffect, AppContext } from "kiru"
import { AppVDomView } from "../components/AppVDomView"
import { FiftyFiftySplitter } from "../components/FiftyFiftySplitter"
import { SquareMouse } from "../icons/SquareMouse"
import {
  toggleElementToVnode,
  kiruGlobal,
  selectedApp,
  selectedNode,
  mountedApps,
  inspectComponent,
} from "../state"

const handleToggleInspect = () => {
  toggleElementToVnode.value = !toggleElementToVnode.value
  broadcastChannel.send({
    type: "set-inspect-enabled",
    value: toggleElementToVnode.value,
  })
}

export function AppTabView() {
  const app = selectedApp.value
  const node = selectedNode.value
  const requestUpdate = useRequestUpdate()

  useEffect(() => {
    const handleUpdate = (_app: AppContext) => {
      if (_app !== app) return
      requestUpdate()
    }
    kiruGlobal?.on("update", handleUpdate)
    return () => kiruGlobal?.off("update", handleUpdate)
  }, [selectedApp])

  useEffect(() => {
    const handleSelectNode = (e: MessageEvent<BroadcastChannelMessage>) => {
      if (e.data.type !== "select-node") return
      assert(window.__devtoolsSelection, "no selection ptr")
      const { app, node } = window.__devtoolsSelection
      window.__devtoolsSelection = null
      selectedApp.value = app
      selectedNode.value = node as any
      inspectComponent.value = node
      toggleElementToVnode.value = false
    }
    broadcastChannel.addEventListener(handleSelectNode)
    return () => broadcastChannel.removeEventListener(handleSelectNode)
  }, [selectedApp])

  return (
    <>
      <div className="flex items-center justify-between gap-4 p-2 bg-neutral-400 bg-opacity-5 border border-white border-opacity-10 rounded">
        <div className="flex items-center gap-4">
          <select
            className="px-2 py-1 bg-neutral-800 text-neutral-100 rounded border border-white border-opacity-10"
            value={app?.name ?? ""}
            onchange={(e) =>
              (selectedApp.value =
                mountedApps
                  .peek()
                  .find((a) => a.name === e.currentTarget.value) ?? null)
            }
          >
            <option value="" disabled>
              Select App
            </option>
            {mountedApps.value.map((app) => (
              <option key={app.id} value={app.name}>
                {app.name}
              </option>
            ))}
          </select>
          <button
            title="Toggle Component Inspection"
            onclick={handleToggleInspect}
            className={`p-1 rounded ${
              toggleElementToVnode.value ? "bg-neutral-900" : ""
            }`}
          >
            <SquareMouse />
          </button>
        </div>
      </div>
      <FiftyFiftySplitter>
        {app && <AppVDomView />}
        {node && app && (
          <SelectedNodeView
            selectedApp={app}
            selectedNode={node}
            setSelectedNode={(n) => (selectedNode.value = n)}
            kiruGlobal={kiruGlobal}
          />
        )}
      </FiftyFiftySplitter>
    </>
  )
}
