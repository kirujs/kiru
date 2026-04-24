import { afterEach, beforeEach, describe, it } from "node:test"
import assert from "node:assert"
import { JSDOM } from "jsdom"
import type { AppHandle, ProfilingEvent } from "kiru"

class ResizeObserverMock {
  constructor(_: unknown) {}
  observe() {}
  disconnect() {}
}

class BroadcastChannelMock {
  addEventListener() {}
  postMessage() {}
  close() {}
}

const mountedApps: Array<{ unmount: () => void }> = []

beforeEach(() => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
  })
  const { window } = dom
  globalThis.window = window as unknown as Window & typeof globalThis
  globalThis.document = window.document
  globalThis.HTMLElement = window.HTMLElement
  globalThis.Element = window.Element
  globalThis.Node = window.Node
  globalThis.Event = window.Event
  globalThis.MouseEvent = window.MouseEvent
  globalThis.localStorage = window.localStorage
  globalThis.sessionStorage = window.sessionStorage
  globalThis.ResizeObserver = ResizeObserverMock as never
  globalThis.BroadcastChannel = BroadcastChannelMock as never
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    Number(setTimeout(() => cb(performance.now()), 0))
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id)
  ;(window as any).__kiru = {
    apps: [],
    emit() {},
    on() {},
    off() {},
    devtools: { untrack() {} },
  }
})

afterEach(() => {
  mountedApps.splice(0).forEach((app) => app.unmount())
  ;(globalThis as any).__sharedTestProfilingState?.value &&
    ((globalThis as any).__sharedTestProfilingState.value = [])
})

describe("widget controller regressions", () => {
  it("drag controller updates transform and persists position on mouseup", async () => {
    const kiru = await import("kiru")
    const { createDraggableController } = await import(
      "../features/draggable-controller.js"
    )
    const controller = createDraggableController({
      key: "test:drag",
      storage: sessionStorage,
      allowFloat: true,
      snapDistance: 16,
      defaultPosition: { type: "floating", x: 0.5, y: 0.5 },
      getDraggableBounds: () => [1000, 700],
      getPadding: () => [8, 8],
    })

    const root = document.createElement("div")
    document.body.append(root)
    const DragHarness: Kiru.FC = () => {
      kiru.onMount(() => {
        controller.init()
        return () => controller.dispose()
      })
      return () =>
        kiru.createElement(
          "div",
          {
            ref: (el: Element | null) => {
              const host = el as HTMLDivElement | null
              controller.containerRef.value = host
              if (!host) return
              Object.defineProperty(host, "getBoundingClientRect", {
                value: () => ({
                  left: 20,
                  top: 30,
                  width: 240,
                  height: 160,
                  right: 260,
                  bottom: 190,
                }),
              })
            },
          },
          kiru.createElement("button", {
            ref: (el: Element | null) =>
              (controller.handleRef.value = el as HTMLButtonElement | null),
            id: "drag-handle",
          })
        )
    }
    const app = kiru.mount(kiru.createElement(DragHarness, {}), root)
    mountedApps.push(app)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const container = root.querySelector("div") as HTMLDivElement
    const handle = root.querySelector("#drag-handle") as HTMLButtonElement

    handle.dispatchEvent(
      new window.MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        clientX: 40,
        clientY: 60,
      })
    )
    window.dispatchEvent(
      new window.MouseEvent("mousemove", {
        bubbles: true,
        clientX: 280,
        clientY: 220,
      })
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }))

    assert.match(
      container.style.transform,
      /translate\(.+px, .+px\)/,
      "drag should update translated position"
    )
    assert.ok(
      sessionStorage.getItem("test:drag"),
      "dragged position should be saved for later widget restores"
    )
  })

  it("resize controller updates dimensions and persists size in mounted Kiru component", async () => {
    const kiru = await import("kiru")
    const { createResizableController } = await import(
      "../features/resizable-controller.js"
    )
    const controller = createResizableController({
      key: "test:resize",
      storage: sessionStorage,
      minSize: [320, 200],
      aspectRatio: 2,
    })
    const root = document.createElement("div")
    document.body.append(root)
    const ResizeHarness: Kiru.FC = () => {
      kiru.onMount(() => {
        controller.init()
        return () => controller.dispose()
      })
      return () =>
        kiru.createElement(
          "div",
          {
            ref: (el: Element | null) => {
              const host = el as HTMLDivElement | null
              controller.containerRef.value = host
              if (!host) return
              Object.defineProperty(host, "offsetWidth", {
                configurable: true,
                get: () => Number.parseFloat(host.style.width) || 320,
              })
              Object.defineProperty(host, "offsetHeight", {
                configurable: true,
                get: () => Number.parseFloat(host.style.height) || 160,
              })
            },
          },
          kiru.createElement("button", {
            ref: (el: Element | null) =>
              (controller.handleRef.value = el as HTMLButtonElement | null),
            id: "resize-handle",
          })
        )
    }
    const app = kiru.mount(kiru.createElement(ResizeHarness, {}), root)
    mountedApps.push(app)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const container = root.querySelector("div") as HTMLDivElement
    const handle = root.querySelector("#resize-handle") as HTMLButtonElement

    handle.dispatchEvent(
      new window.MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
      })
    )
    window.dispatchEvent(
      new window.MouseEvent("mousemove", {
        bubbles: true,
        clientX: 260,
        clientY: 180,
      })
    )
    window.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }))

    assert.notStrictEqual(container.style.width, "", "width should be set")
    assert.notStrictEqual(container.style.height, "", "height should be set")
    assert.ok(
      sessionStorage.getItem("test:resize"),
      "resized widget dimensions should be persisted"
    )
  })

  it("profiling state initializes chart datasets for mounted apps", async () => {
    const { initProfilingViewState, profilingViewState } = await import(
      "../tabs/profiling-tab/profiling-tab-state.js"
    )
    ;(globalThis as any).__sharedTestProfilingState = profilingViewState
    const app = { name: "sample-app" } as AppHandle
    const eventListeners = new Map<
      ProfilingEvent,
      Set<(app: AppHandle) => void>
    >()
    const updateListeners = new Set<(app: AppHandle) => void>()
    const fakeGlobal = {
      profilingContext: {
        appStats: new Map([[app, {}]]),
        mountDuration: () => 12.34,
        totalTicks: () => 7,
        averageTickDuration: () => 2.5,
        lastTickDuration: () => 1.25,
        addEventListener: (
          evt: ProfilingEvent,
          listener: (app: AppHandle) => void
        ) => {
          if (!eventListeners.has(evt)) eventListeners.set(evt, new Set())
          eventListeners.get(evt)!.add(listener)
        },
        removeEventListener: (
          evt: ProfilingEvent,
          listener: (app: AppHandle) => void
        ) => {
          eventListeners.get(evt)?.delete(listener)
        },
      },
      on: (evt: "mount" | "unmount" | "update", listener: any) => {
        if (evt === "update") updateListeners.add(listener)
      },
      off: (evt: "mount" | "unmount" | "update", listener: any) => {
        if (evt === "update") updateListeners.delete(listener)
      },
    } as unknown as typeof window.__kiru

    initProfilingViewState(fakeGlobal)
    assert.strictEqual(profilingViewState.value.length, 1)

    const [{ chartData, dispose }] = profilingViewState.value
    assert.strictEqual(
      chartData.value.datasets.length,
      7,
      "graph should have one dataset per profiling event"
    )

    eventListeners.get("update")?.forEach((listener) => listener(app))
    await new Promise((resolve) => setTimeout(resolve, 120))
    assert.ok(chartData.value.labels.length >= 2, "chart should tick over time")

    dispose()
    updateListeners.clear()
  })
})
