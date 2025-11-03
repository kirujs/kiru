import { AppContext, signal } from "kiru"
import { broadcastChannel, isDevtoolsApp } from "devtools-shared"

export let kiruGlobal!: typeof window.__kiru
let allowStandalone = false
if ("window" in globalThis) {
  if (window.opener) {
    kiruGlobal = window.opener.__kiru
  } else if (allowStandalone) {
    kiruGlobal = window.__kiru
  }
}

export const toggleElementToVnode = signal(false)
broadcastChannel.addEventListener((e) => {
  if (e.data.type === "set-inspect-enabled") {
    toggleElementToVnode.value = e.data.value
  }
})

const initialApps = (kiruGlobal?.apps ?? []).filter(
  (app) => !isDevtoolsApp(app)
)

export const mountedApps = signal<AppContext[]>(initialApps)
export const selectedElement = signal<Element | null>(null)
export const selectedApp = signal<AppContext | null>(initialApps[0] ?? null)
export const selectedNode = signal<(Kiru.VNode & { type: Function }) | null>(
  null
)

kiruGlobal?.on("mount", (app) => {
  if (isDevtoolsApp(app)) return
  mountedApps.value = [...mountedApps.peek(), app]
  if (selectedApp.peek() === null) {
    selectedApp.value = app
  }
})

kiruGlobal?.on("unmount", (app) => {
  mountedApps.value = mountedApps.peek().filter((a) => a !== app)
  if (selectedApp.peek() === app) {
    selectedApp.value = mountedApps.peek()[0] ?? null
  }
})

type KeyboardMapEntry = {
  vNode: Kiru.VNode
  setCollapsed: (value: Kiru.StateSetter<boolean>) => void
}
export const keyboardMap = signal(new Map<string, KeyboardMapEntry>())
export const inspectComponent = signal<Kiru.VNode | null>(null)
export const appTreeSearch = signal("")
