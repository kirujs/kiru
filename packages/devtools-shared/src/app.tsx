import * as kiru from "kiru"
import { AppsIcon, FolderTreeIcon, GaugeIcon, CogIcon } from "./components"
import { AppsTabView, ProfilingTabView } from "./tabs"
import { devtoolsState } from "./state"
import { APP_TABS } from "./constants"
import { trapFocus } from "./utils"

const selectedTab = kiru.computed(
  () => APP_TABS[devtoolsState.devtoolsTab.value]
)

console.log("boop")

interface DevtoolsAppProps {
  rootRef: Kiru.RefObject<HTMLButtonElement | null>
}

export function DevtoolsApp({ rootRef }: DevtoolsAppProps) {
  return (
    <button ref={rootRef} className="flex gap-2 cursor-default">
      <nav className="flex flex-col gap-2 justify-between">
        <div className="flex flex-col gap-2">
          {Object.keys(APP_TABS).map((key) => (
            <TabButton key={key} id={key as keyof typeof APP_TABS} />
          ))}
        </div>
      </nav>
      <main className="flex flex-col flex-1 max-h-[calc(100vh-1rem)] overflow-y-auto p-2 bg-neutral-400/5 rounded">
        <kiru.Derive from={selectedTab}>
          {(selectedTab) => <selectedTab.View />}
        </kiru.Derive>
      </main>
    </button>
  )
}

function TabButton({ id }: { id: keyof typeof APP_TABS }) {
  const { Icon } = APP_TABS[id]
  return (
    <button
      key={id}
      onclick={() => (devtoolsState.devtoolsTab.value = id)}
      className={
        "flex items-center px-2 py-1 gap-2 rounded border text-xs border-white border-opacity-10" +
        (devtoolsState.devtoolsTab.value === id
          ? " bg-white bg-opacity-5 text-neutral-100"
          : " hover:bg-white hover:bg-opacity-10 text-neutral-400")
      }
      title={id}
    >
      <Icon className="text-primary" />
      <span className="hidden sm:inline">{id}</span>
    </button>
  )
}
