import { ElementProps } from "kiru"
import { NodeListItem } from "./NodeListItem"
import { useKeyboardControls } from "../hooks/KeyboardControls"
import { appTreeSearch, inspectComponent, selectedApp } from "../state"

const handleSearch: ElementProps<"input">["oninput"] = (e) => {
  appTreeSearch.value = e.target.value
  if (inspectComponent.value) inspectComponent.value = null
}

export function AppVDomView() {
  const { searchRef } = useKeyboardControls()
  const app = selectedApp.value

  return (
    <div className="flex-grow p-2 sticky top-0">
      <div className="flex gap-4 pb-2 border-b-2 border-neutral-800 mb-2 items-center">
        <input
          ref={searchRef}
          className="bg-[#171616] px-1 py-2 w-full focus:outline focus:outline-primary"
          placeholder="Search for component"
          type="text"
          value={appTreeSearch}
          oninput={handleSearch}
        />
      </div>
      {app?.rootNode && <NodeListItem node={app.rootNode} />}
    </div>
  )
}
