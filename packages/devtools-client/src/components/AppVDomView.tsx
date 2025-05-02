import { ElementProps, signal } from "kaioken"
import { useDevtoolsStore } from "../store"
import { NodeListItem } from "./NodeListItem"
import { useKeyboardControls } from "../hooks/KeyboardControls"
import { SearchContext } from "../context"
import { inspectComponent } from "../signal"

const search = signal("")
const handleSearch: ElementProps<"input">["oninput"] = (e) => {
  search.value = e.target.value
  if (inspectComponent.value) inspectComponent.value = null
}

export function AppVDomView() {
  const { value: app } = useDevtoolsStore((state) => state.selectedApp)
  const { searchRef } = useKeyboardControls()

  return (
    <div className="flex-grow p-2 sticky top-0">
      <div className="flex gap-4 pb-2 border-b-2 border-neutral-800 mb-2 items-center">
        <input
          ref={searchRef}
          className="bg-[#171616] px-1 py-2 w-full focus:outline focus:outline-primary"
          placeholder="Search for component"
          type="text"
          value={search.value}
          oninput={handleSearch}
        />
      </div>
      <SearchContext.Provider value={search.value}>
        {app?.rootNode && <NodeListItem node={app.rootNode} />}
      </SearchContext.Provider>
    </div>
  )
}
