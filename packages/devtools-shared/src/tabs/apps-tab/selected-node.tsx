import * as kiru from "kiru"
import { devtoolsState } from "../../state"
const { selectedNode } = devtoolsState

export function SelectedNodeView() {
  const node = selectedNode.value
  return (
    <div>
      <h2>Selected Node</h2>
    </div>
  )
}
