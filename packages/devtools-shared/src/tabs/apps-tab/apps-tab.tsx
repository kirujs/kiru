import * as kiru from "kiru"
import { devtoolsState } from "../../state"
import { getNodeName } from "../../utils"
import { getVNodeApp } from "kiru/utils"
import { MouseIcon, ResizableSplit } from "../../components"
import { SelectedAppGraphView } from "./selected-app-graph"
import { SelectedNodeView } from "./selected-node"

const { apps, selectedApp } = devtoolsState

const toggleComponentSelection = () => {
  devtoolsState.componentSelection.value = {
    enabled: !devtoolsState.componentSelection.value.enabled,
    componentNode: null,
  }
}

const componentSelectionEnabled = kiru.computed(
  () => devtoolsState.componentSelection.value.enabled
)

export function AppsTabView() {
  const app = selectedApp.value
  return (
    <>
      <div className="flex items-center justify-between gap-4 p-2 bg-neutral-400 bg-opacity-5 border border-white border-opacity-10 rounded">
        <div className="flex items-center gap-4">
          <select
            className="px-2 py-1 bg-neutral-800 text-neutral-100 rounded border border-white border-opacity-10"
            value={app?.name ?? ""}
            onchange={(e) =>
              (selectedApp.value =
                apps.peek().find((a) => a.name === e.currentTarget.value) ??
                null)
            }
          >
            <option value="" disabled>
              Select App
            </option>
            <kiru.For each={apps}>
              {(app) => (
                <option key={app.id} value={app.name}>
                  {app.name}
                </option>
              )}
            </kiru.For>
          </select>
          <button
            title="Toggle Component Inspection"
            onclick={toggleComponentSelection}
            className={`p-1 rounded ${
              componentSelectionEnabled.value ? "bg-neutral-900" : ""
            }`}
          >
            <MouseIcon />
          </button>
        </div>
      </div>
      <ResizableSplit minContainerWidth={100} className="min-w-[480px]">
        <SelectedAppGraphView />
        <SelectedNodeView />
      </ResizableSplit>
    </>
  )
}
