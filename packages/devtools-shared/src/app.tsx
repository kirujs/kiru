import * as kiru from "kiru"
import { AppsIcon, FolderTreeIcon, GaugeIcon, CogIcon } from "./components"

interface TabViewProps {
  active: boolean
  children: JSX.Children
}

const APP_TABS = {
  Apps: {
    Icon: AppsIcon,
    View: () => <div>Apps</div>,
  },
  FileRouter: {
    Icon: FolderTreeIcon,
    View: () => <div>FileRouter</div>,
  },
  Profiling: {
    Icon: GaugeIcon,
    View: () => <div>Profiling</div>,
  },
  Settings: {
    Icon: CogIcon,
    View: () => <div>Settings</div>,
  },
}

const selectedTabId = kiru.signal<keyof typeof APP_TABS>("Apps")
const selectedTab = kiru.computed(() => APP_TABS[selectedTabId.value])

export function DevtoolsApp() {
  return (
    <>
      <nav className="flex flex-col gap-2 justify-between p-2 bg-neutral-400 bg-opacity-5 border border-white border-opacity-10 rounded">
        <div className="flex flex-col gap-2">
          {Object.keys(APP_TABS).map((key) => (
            <TabButton key={key} id={key as keyof typeof APP_TABS} />
          ))}
        </div>
      </nav>
      <main className="flex flex-col flex-1 max-h-[calc(100vh-1rem)] overflow-y-auto">
        <kiru.Derive from={selectedTab}>
          {(selectedTab) => <selectedTab.View />}
        </kiru.Derive>
      </main>
    </>
  )
}

function TabButton({ id }: { id: keyof typeof APP_TABS }) {
  const { Icon } = APP_TABS[id]
  return (
    <button
      key={id}
      onclick={() => (selectedTabId.value = id)}
      className={
        "flex items-center px-2 py-1 gap-2 rounded border text-xs border-white border-opacity-10" +
        (selectedTabId.value === id
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
