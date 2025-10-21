import {
  AppViewIcon,
  CogIcon,
  GaugeIcon,
  GlobeIcon,
  SettingsProvider,
  StoresViewIcon,
} from "devtools-shared"
import { signal } from "kiru"
import { AppTabView } from "./tabs/AppTabView"
import { StoresTabView } from "./tabs/StoresTabView"
import { SettingsEditor } from "devtools-shared/src/Settings"
import { ProfilingTabView } from "./tabs/ProfilingTabView"
import { SWRTabView } from "./tabs/SWRTabView"
import { selectedNode } from "./state"

type TabViewProps = { active: boolean; children: JSX.Element }

const TabView = (props: TabViewProps) => {
  return (
    <main
      className="flex flex-col flex-1 max-h-[calc(100vh-1rem)] overflow-y-auto"
      style={props.active ? {} : { display: "none" }}
    >
      {props.children}
    </main>
  )
}

const APP_TABS = {
  Apps: {
    Icon: AppViewIcon,
    View: AppTabView,
  },
  Stores: {
    Icon: StoresViewIcon,
    View: StoresTabView,
  },
  SWR: {
    Icon: GlobeIcon,
    View: SWRTabView,
  },
  Profiling: {
    Icon: GaugeIcon,
    View: ProfilingTabView,
  },
  Settings: {
    Icon: CogIcon,
    View: SettingsEditor,
  },
}

const selectedTab = signal<keyof typeof APP_TABS>("Apps")

let prevSelectedNode = selectedNode.peek()
selectedNode.subscribe((node) => {
  if (node !== prevSelectedNode && node !== null) {
    selectedTab.value = "Apps"
  }
  prevSelectedNode = node
})

export function App() {
  return (
    <SettingsProvider>
      <nav className="flex flex-col gap-2 justify-between p-2 bg-neutral-400 bg-opacity-5 border border-white border-opacity-10 rounded">
        <div className="flex flex-col gap-2">
          {Object.keys(APP_TABS).map((key) => (
            <TabButton key={key} title={key as keyof typeof APP_TABS} />
          ))}
        </div>
      </nav>
      {Object.entries(APP_TABS).map(([title, { View }]) => (
        <TabView key={title} active={selectedTab.value === title}>
          <View />
        </TabView>
      ))}
    </SettingsProvider>
  )
}

function TabButton({ title }: { title: keyof typeof APP_TABS }) {
  const { Icon } = APP_TABS[title]
  return (
    <button
      key={title}
      onclick={() => {
        selectedTab.value = title
      }}
      className={
        "flex items-center px-2 py-1 gap-2 rounded border text-xs border-white border-opacity-10" +
        (selectedTab.value === title
          ? " bg-white bg-opacity-5 text-neutral-100"
          : " hover:bg-white hover:bg-opacity-10 text-neutral-400")
      }
      title={title}
    >
      <Icon className="text-primary" />
      <span className="hidden sm:inline">{title}</span>
    </button>
  )
}
