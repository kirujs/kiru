import {
  broadcastChannel,
  BroadcastChannelMessage,
  SelectedNodeView,
} from "devtools-shared"
import { useRequestUpdate, useEffect, AppContext } from "kaioken"
import { AppVDomView } from "../components/AppVDomView"
import { FiftyFiftySplitter } from "../components/FiftyFiftySplitter"
import { Select } from "../components/Select"
import { SquareMouse } from "../icons/SquareMouse"
import { inspectComponent } from "../signal"
import { toggleElementToVnode, useDevtoolsStore, kaiokenGlobal } from "../store"

const handleToggleInspect = () => {
  toggleElementToVnode.value = !toggleElementToVnode.value
  broadcastChannel.send({
    type: "set-inspect-enabled",
    value: toggleElementToVnode.value,
  })
}

export function AppTabView() {
  const {
    value: { apps, selectedApp, selectedNode },
    setSelectedApp,
    setSelectedNode,
  } = useDevtoolsStore(({ apps, selectedApp, selectedNode }) => ({
    apps,
    selectedApp,
    selectedNode,
  }))

  const requestUpdate = useRequestUpdate()
  useEffect(() => {
    const handleUpdate = (appCtx: AppContext) => {
      if (appCtx !== selectedApp) return
      requestUpdate()
    }
    kaiokenGlobal?.on("update", handleUpdate)
    return () => kaiokenGlobal?.off("update", handleUpdate)
  }, [selectedApp])

  useEffect(() => {
    const handleSelectNode = (e: MessageEvent<BroadcastChannelMessage>) => {
      if (e.data.type !== "select-node") return
      if (!window.__devtoolsSelection) {
        console.error("no selection ptr")
        return
      }
      const { app, node } = window.__devtoolsSelection
      window.__devtoolsSelection = null
      setSelectedApp(app)
      setSelectedNode(node as any)
      inspectComponent.value = node
      toggleElementToVnode.value = false
    }
    broadcastChannel.addEventListener(handleSelectNode)
    return () => broadcastChannel.removeEventListener(handleSelectNode)
  }, [selectedApp])

  return (
    <>
      <div className="flex items-center justify-between gap-4 p-2 bg-neutral-400 bg-opacity-5 border border-neutral-400 border-opacity-5 rounded">
        <div className="flex items-center gap-4">
          <Select
            className="px-2 py-1 bg-neutral-800 text-neutral-100 rounded border border-white border-opacity-10"
            options={[
              { text: "Select App", key: "", disabled: true },
              ...apps.map((app) => app.name),
            ]}
            value={selectedApp?.name ?? ""}
            onChange={(name) =>
              setSelectedApp(apps.find((a) => a.name === name)!)
            }
          />
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
        {selectedApp && <AppVDomView />}
        {selectedNode && selectedApp && (
          <SelectedNodeView
            selectedApp={selectedApp}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            kaiokenGlobal={kaiokenGlobal}
          />
        )}
      </FiftyFiftySplitter>
    </>
  )
}
