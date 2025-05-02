import { AppContext, createStore, signal } from "kaioken"
import { isDevtoolsApp } from "./utils"
import { broadcastChannel } from "devtools-shared"

export let kaiokenGlobal: typeof window.__kaioken
let runAnyway = true
if ("window" in globalThis) {
  if (window.opener) {
    kaiokenGlobal = window.opener.__kaioken
  } else if (runAnyway) {
    kaiokenGlobal = window.__kaioken
  }
}

export const toggleElementToVnode = signal(false)
broadcastChannel.addEventListener((e) => {
  if (e.data.type === "set-inspect-enabled") {
    toggleElementToVnode.value = e.data.value
  }
})

const initialApps = (kaiokenGlobal?.apps ?? []).filter(
  (app) => !isDevtoolsApp(app)
)
const initialApp = (initialApps[0] ?? null) as AppContext | null

export const useDevtoolsStore = createStore(
  {
    apps: initialApps,
    selectedElement: null as Element | null,
    selectedApp: initialApp,
    selectedNode: null as (Kaioken.VNode & { type: Function }) | null,
    popupWindow: null as Window | null,
  },
  (set) => ({
    addApp: (app: AppContext) => {
      set((state) => ({ ...state, apps: [...state.apps, app] }))
    },
    setApps: (apps: Array<AppContext>) => {
      set((state) => ({ ...state, apps }))
    },
    removeApp: (app: AppContext) => {
      set((state) => ({ ...state, apps: state.apps.filter((a) => a !== app) }))
    },
    setSelectedElement: (element: Element | null) => {
      set((state) => ({ ...state, selectedElement: element }))
    },
    setSelectedApp: (app: AppContext | null) => {
      set((state) => ({ ...state, selectedApp: app }))
    },
    setSelectedNode: (node: (Kaioken.VNode & { type: Function }) | null) => {
      set((state) => ({ ...state, selectedNode: node }))
    },
  })
)

kaiokenGlobal?.on("mount", (app) => {
  if (isDevtoolsApp(app)) return
  useDevtoolsStore.methods.addApp(app)
  const selected = useDevtoolsStore.getState().selectedApp
  if (!selected) {
    useDevtoolsStore.methods.setSelectedApp(app)
  }
})
kaiokenGlobal?.on("unmount", (app) => {
  useDevtoolsStore.methods.removeApp(app)
  let nextSelected: AppContext | null = useDevtoolsStore.getState().selectedApp
  if (useDevtoolsStore.getState().selectedApp === app) {
    nextSelected = null
  }

  if (nextSelected === null) {
    const apps = useDevtoolsStore.getState().apps
    if (apps.length > 0) {
      nextSelected = apps[0]
    }
  }
  useDevtoolsStore.methods.setSelectedApp(nextSelected)
})
