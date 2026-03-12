import * as kiru from "kiru"
import { className as cls, getVNodeApp, isVNodeDeleted } from "kiru/utils"
import {
  buildViewerRoot,
  collectFromRoot,
  createDraggableController,
  createResizableController,
  disposeCache,
  emptyCache,
  ExternalLinkIcon,
  ResizeGripIcon,
  CloseIcon,
  ValueViewer,
  devtoolsState,
  isDevtoolsApp,
  kiruGlobal,
  computeComponentHash,
  findComponentByHash,
} from "devtools-shared"
import {
  COMPONENT_INFO_MIN_HEIGHT,
  COMPONENT_INFO_MIN_WIDTH,
  DRAG_SNAP_PADDING,
} from "../constants"
import {
  componentInfoPanels,
  widgetStackTop,
  WIDGET_Z_BASE,
  type ComponentInfoPanelState,
} from "../state"
import { SelectionBox } from "../components/selection-box"

const COMPONENT_INFO_POSITION_STORAGE_KEY =
  "kiru.devtools.componentInfoPosition"
const COMPONENT_INFO_SIZE_STORAGE_KEY = "kiru.devtools.componentInfoSize"
const PULSE_DURATION = 300

interface ComponentInfoWidgetProps {
  state: kiru.TransitionState
}

function getPropsForViewer(component: Kiru.VNode): Record<string, unknown> {
  const props = { ...(component.props as Record<string, unknown>) }
  delete props.children
  return props
}

function disposeViewerRoot(root: ReturnType<typeof buildViewerRoot>) {
  const cache = emptyCache()
  collectFromRoot(root, "props", cache)
  disposeCache(cache)
}

function collectDomNodes(
  firstChild: Kiru.VNode | null,
  elements: Set<Element> = new Set()
): Set<Element> {
  let child: Kiru.VNode | null = firstChild
  while (child) {
    if (child.dom && child.dom instanceof Element) {
      elements.add(child.dom)
    } else if (child.child) {
      collectDomNodes(child.child, elements)
    }
    child = child.sibling
  }
  return elements
}

function getComponentBoundingBox(component: Kiru.VNode) {
  if (!component.child) return null
  const elements = collectDomNodes(component.child)
  if (elements.size === 0) return null

  let minLeft = Infinity,
    minTop = Infinity,
    maxRight = -Infinity,
    maxBottom = -Infinity

  for (const element of elements) {
    const { top, left, width, height } = element.getBoundingClientRect()
    minLeft = Math.min(minLeft, left)
    minTop = Math.min(minTop, top)
    maxRight = Math.max(maxRight, left + width)
    maxBottom = Math.max(maxBottom, top + height)
  }

  const width = maxRight - minLeft
  const height = maxBottom - minTop
  return { top: minTop, left: minLeft, width, height }
}

const ComponentInfoPanel: Kiru.FC<{
  panel: ComponentInfoPanelState
  index: number
  state: kiru.TransitionState
}> = () => {
  const propsViewerRoot = kiru.signal<ReturnType<
    typeof buildViewerRoot
  > | null>(null)

  const selectedHash = kiru.signal<string | null>(null)
  const panelId = kiru.signal<string | null>(null)
  const isHovered = kiru.signal(false)
  const isPulsing = kiru.signal(false)
  let lastPulseGeneration = -1

  kiru.effect(() => {
    const id = panelId.value
    if (!id) {
      const prev = propsViewerRoot.peek()
      if (prev) {
        disposeViewerRoot(prev)
        propsViewerRoot.value = null
      }
      return
    }

    const currentPanels = componentInfoPanels.value
    const current = currentPanels.find((p) => p.id === id)
    if (!current) {
      const prev = propsViewerRoot.peek()
      if (prev) {
        disposeViewerRoot(prev)
        propsViewerRoot.value = null
      }
      return
    }

    if (current.pulseGeneration !== lastPulseGeneration) {
      lastPulseGeneration = current.pulseGeneration
      if (current.pulseGeneration > 0) {
        isPulsing.value = true
        setTimeout(() => {
          if (lastPulseGeneration === current.pulseGeneration) {
            isPulsing.value = false
          }
        }, PULSE_DURATION)
      }
    }

    if (!current.unmounted) {
      const hash = computeComponentHash(current.component)
      selectedHash.value = hash
      if (current.hash !== hash) {
        componentInfoPanels.value = currentPanels.map((p) =>
          p.id === id ? { ...p, hash } : p
        )
      }
    }
    if (current.unmounted) return

    const prev = propsViewerRoot.peek()
    const prevCache = emptyCache()
    if (prev) {
      collectFromRoot(prev, "props", prevCache)
    }

    const settings = devtoolsState.viewerSettings.peek()
    const nodeProps = getPropsForViewer(current.component)
    const nextRoot = buildViewerRoot(nodeProps, "props", prevCache, settings)
    propsViewerRoot.value = nextRoot
    disposeCache(prevCache)
  })

  kiru.onCleanup(() => {
    const root = propsViewerRoot.peek()
    if (root) {
      disposeViewerRoot(root)
      propsViewerRoot.value = null
    }
  })

  const dragController = createDraggableController({
    key: COMPONENT_INFO_POSITION_STORAGE_KEY,
    storage: sessionStorage,
    allowFloat: true,
    snapDistance: 50,
    defaultPosition: { type: "floating", x: 0.5, y: 0.5 },
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    getPadding: () => [DRAG_SNAP_PADDING, DRAG_SNAP_PADDING],
  })

  const resizeController = createResizableController({
    key: COMPONENT_INFO_SIZE_STORAGE_KEY,
    storage: sessionStorage,
    minSize: [COMPONENT_INFO_MIN_WIDTH, COMPONENT_INFO_MIN_HEIGHT],
  })

  kiru.onMount(() => {
    dragController.init()
    resizeController.init()

    const onAppUpdate = (updatedApp: kiru.AppHandle) => {
      const id = panelId.value
      if (!id) return

      const currentPanels = componentInfoPanels.value
      const current = currentPanels.find((p) => p.id === id)
      if (!current) return
      if (isDevtoolsApp(updatedApp)) return
      const vNodeApp = getVNodeApp(current.component)
      if (vNodeApp && vNodeApp !== updatedApp) return

      if (current.unmounted) {
        const hash = selectedHash.value
        if (!hash) return
        const remounted = findComponentByHash(updatedApp.rootNode, hash)
        if (!remounted) return
        componentInfoPanels.value = currentPanels.map((p) =>
          p.id === id ? { ...p, component: remounted, unmounted: false } : p
        )
        return
      }

      if (isVNodeDeleted(current.component)) {
        componentInfoPanels.value = currentPanels.map((p) =>
          p.id === id ? { ...p, unmounted: true } : p
        )
        return
      }

      const prev = propsViewerRoot.peek()
      if (!prev) return
      const settings = devtoolsState.viewerSettings.peek()
      const prevCache = emptyCache()
      collectFromRoot(prev, "props", prevCache)
      propsViewerRoot.value = buildViewerRoot(
        getPropsForViewer(current.component),
        "props",
        prevCache,
        settings
      )
      disposeCache(prevCache)
    }

    kiruGlobal().on("update", onAppUpdate)
    return () => {
      dragController.dispose()
      resizeController.dispose()
      kiruGlobal().off("update", onAppUpdate)
    }
  })

  const containerRef = (current: HTMLElement | null) => {
    dragController.containerRef.value = current
    dragController.handleRef.value = current
    resizeController.containerRef.value = current
  }

  const resizeHandleRef = (current: HTMLElement | null) => {
    resizeController.handleRef.value = current
  }

  return ({ panel, state }) => {
    if (!panelId.value) {
      panelId.value = panel.id
    }

    const currentPanels = componentInfoPanels.value
    const current = currentPanels.find((p) => p.id === panel.id)
    if (!current) return null

    const bringToFront = () => {
      const panels = componentInfoPanels.value
      const target = panels.find((p) => p.id === panel.id)
      if (!target) return
      componentInfoPanels.value = [
        ...panels.filter((p) => p.id !== panel.id),
        target,
      ]
      widgetStackTop.value = "componentInfo"
    }
    const hovered = isHovered.value
    const pulsing = isPulsing.value
    const overlayBox =
      hovered && !current.unmounted
        ? getComponentBoundingBox(current.component)
        : null

    return (
      <>
        {overlayBox && (
          <SelectionBox
            top={overlayBox.top + window.scrollY}
            left={overlayBox.left + window.scrollX}
            width={overlayBox.width}
            height={overlayBox.height}
            className={cls(
              "pointer-events-none",
              state === "entered" ? "opacity-100" : "opacity-90"
            )}
          />
        )}
        <div
          ref={containerRef}
          className="fixed p-0.5 flex flex-col gap-2 select-none z-index-1001"
          style={{
            zIndex:
              widgetStackTop.value === "componentInfo"
                ? WIDGET_Z_BASE + 1
                : WIDGET_Z_BASE,
            minWidth: `${COMPONENT_INFO_MIN_WIDTH}px`,
            minHeight: `${COMPONENT_INFO_MIN_HEIGHT}px`,
            opacity: state === "entered" ? 1 : 0,
            cursor: resizeController.isResizing.value
              ? "se-resize"
              : dragController.isDragging.value
                ? "grabbing"
                : "grab",
          }}
          onclick={bringToFront}
          onmousedown={bringToFront}
          onmouseenter={() => (isHovered.value = true)}
          onmouseleave={() => (isHovered.value = false)}
        >
          <div
            style={{
              transition: "80ms ease-in-out",
              opacity: pulsing ? 1 : 0.75,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              boxShadow: pulsing ? "0 0 8px crimson" : undefined,
            }}
            className="rounded-lg bg-neutral-900 opacity-75 hover:opacity-100! shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 p-2 shrink-0">
              <a
                href={current.link}
                className={cls(
                  "flex items-center justify-center gap-2",
                  "text-neutral-400 hover:text-neutral-200"
                )}
                onclick={(e: Kiru.MouseEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open(current.link)
                }}
                onmousedown={(e) => e.stopPropagation()}
                title="Open in editor"
              >
                {`<${current.name}>`}
                <ExternalLinkIcon className="w-4 h-4 shrink-0 pointer-events-none" />
              </a>
              <div className="flex items-center gap-2">
                {current.unmounted && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    Unmounted
                  </span>
                )}
                <button
                  type="button"
                  className="p-1 text-neutral-400 hover:text-neutral-200"
                  onclick={() => {
                    componentInfoPanels.value =
                      componentInfoPanels.value.filter((p) => p.id !== panel.id)
                  }}
                  title="Close"
                >
                  <CloseIcon className="w-4 h-4 shrink-0 pointer-events-none" />
                </button>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto text-sm pt-2 px-4 pb-4 mb-6"
              style={{ minHeight: 0 }}
            >
              <div className="mb-1.5 font-medium text-neutral-300 text-xs">
                Props
              </div>
              <kiru.Show when={propsViewerRoot}>
                {(root) => {
                  if (root.children.length === 0) {
                    return (
                      <div className="text-neutral-500 text-xs italic py-1">
                        No props
                      </div>
                    )
                  }
                  return <ValueViewer root={root} className="text-xs" />
                }}
              </kiru.Show>
            </div>
          </div>
          <div
            ref={resizeHandleRef}
            style={{
              position: "absolute",
              bottom: "4px",
              right: "4px",
              width: "16px",
              height: "16px",
              cursor: "se-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ResizeGripIcon className="text-neutral-500" />
          </div>
        </div>
      </>
    )
  }
}

export const ComponentInfoWidget: Kiru.FC<ComponentInfoWidgetProps> = ({
  state,
}) => (
  <kiru.For each={componentInfoPanels}>
    {(panel, index) => (
      <ComponentInfoPanel
        key={panel.id}
        panel={panel}
        index={index}
        state={state}
      />
    )}
  </kiru.For>
)
