import * as kiru from "kiru"
import { devtoolsState } from "../../state"
import { getNodeName } from "../../utils"
import { getVNodeApp } from "kiru/utils"
import { ResizableSplit } from "../../components"

const { componentSelection, apps, selectedApp, selectedNode } = devtoolsState

componentSelection.subscribe(({ componentNode }) => {
  selectedNode.value = componentNode
  selectedApp.value = componentNode ? getVNodeApp(componentNode) : null
})

export function AppsTabView() {
  return (
    <ResizableSplit minContainerWidth={100} className="min-w-[480px]">
      <div>First View</div>
      <div>Second View</div>
    </ResizableSplit>
  )
}
