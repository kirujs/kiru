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
} from "devtools-shared"
import {
  COMPONENT_INFO_MIN_HEIGHT,
  COMPONENT_INFO_MIN_WIDTH,
  DRAG_SNAP_PADDING,
} from "../constants"
import {
  selectedComponentForPanel,
  widgetStackTop,
  WIDGET_Z_BASE,
} from "../state"

const COMPONENT_INFO_POSITION_STORAGE_KEY =
  "kiru.devtools.componentInfoPosition"
const COMPONENT_INFO_SIZE_STORAGE_KEY = "kiru.devtools.componentInfoSize"

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

export const ComponentInfoWidget: Kiru.FC<ComponentInfoWidgetProps> = () => {
  const propsViewerRoot = kiru.signal<ReturnType<
    typeof buildViewerRoot
  > | null>(null)

  kiru.effect([selectedComponentForPanel], (selected) => {
    if (!selected) {
      const prev = propsViewerRoot.peek()
      if (prev) {
        disposeViewerRoot(prev)
        propsViewerRoot.value = null
      }
      return
    }
    if (selected.unmounted) return
    const prev = propsViewerRoot.peek()
    if (prev) {
      disposeViewerRoot(prev)
      propsViewerRoot.value = null
    }
    const settings = devtoolsState.viewerSettings.peek()
    const nodeProps = getPropsForViewer(selected.component)
    propsViewerRoot.value = buildViewerRoot(
      nodeProps,
      "props",
      emptyCache(),
      settings
    )
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
      const selected = selectedComponentForPanel.value
      if (!selected || selected.unmounted) return
      if (isDevtoolsApp(updatedApp)) return
      const vNodeApp = getVNodeApp(selected.component)
      if (vNodeApp && vNodeApp !== updatedApp) return
      if (isVNodeDeleted(selected.component)) {
        selectedComponentForPanel.value = {
          ...selected,
          unmounted: true,
        }
        return
      }
      const prev = propsViewerRoot.peek()
      if (!prev) return
      const settings = devtoolsState.viewerSettings.peek()
      const prevCache = emptyCache()
      collectFromRoot(prev, "props", prevCache)
      propsViewerRoot.value = buildViewerRoot(
        getPropsForViewer(selected.component),
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

  return ({ state }) => {
    const selected = selectedComponentForPanel.value
    return (
      <div
        ref={containerRef}
        className={cls(
          "fixed rounded-lg p-0.5 flex flex-col gap-2 select-none overflow-hidden",
          "bg-neutral-900 opacity-75 hover:opacity-100 shadow-lg"
        )}
        style={{
          zIndex:
            widgetStackTop.value === "componentInfo"
              ? WIDGET_Z_BASE + 1
              : WIDGET_Z_BASE,
          minWidth: `${COMPONENT_INFO_MIN_WIDTH}px`,
          minHeight: `${COMPONENT_INFO_MIN_HEIGHT}px`,
          cursor: resizeController.isResizing.value
            ? "se-resize"
            : dragController.isDragging.value
            ? "grabbing"
            : "grab",
        }}
        onclick={() => (widgetStackTop.value = "componentInfo")}
      >
        <div
          style={{
            transition: "80ms ease-in-out",
            opacity: state === "entered" ? 1 : 0,
            flex: 1,
            overflow: "auto",
            scrollbarWidth: "thin",
            minHeight: 0,
          }}
        >
          {selected && (
            <div className="flex flex-col text-sm">
              <div className="flex items-center justify-between gap-2 p-2">
                <a
                  href={selected.link}
                  className={cls(
                    "flex items-center justify-center gap-2",
                    "text-neutral-400 hover:text-neutral-200"
                  )}
                  onclick={(e: Kiru.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(selected.link)
                  }}
                  onmousedown={(e) => e.stopPropagation()}
                  title="Open in editor"
                >
                  {`<${selected.name}>`}
                  <ExternalLinkIcon className="w-4 h-4 shrink-0 pointer-events-none" />
                </a>
                <div className="flex items-center gap-2">
                  {selected.unmounted && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      Unmounted
                    </span>
                  )}
                  <button
                    type="button"
                    className="p-1 text-neutral-400 hover:text-neutral-200"
                    onclick={() => (selectedComponentForPanel.value = null)}
                    title="Close"
                  >
                    <CloseIcon className="w-4 h-4 shrink-0 pointer-events-none" />
                  </button>
                </div>
              </div>

              <div className="pt-2 px-4">
                <div className="mb-1.5 font-medium text-neutral-300 text-xs">
                  Props
                </div>
                <kiru.Derive from={propsViewerRoot}>
                  {(root) => {
                    if (!root) return null
                    if (root.children.length === 0) {
                      return (
                        <div className="text-neutral-500 text-xs italic py-1">
                          No props
                        </div>
                      )
                    }
                    return <ValueViewer root={root} className="text-xs" />
                  }}
                </kiru.Derive>
              </div>
            </div>
          )}
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
    )
  }
}
