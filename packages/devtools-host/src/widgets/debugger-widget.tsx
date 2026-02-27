import * as kiru from "kiru"
import { className as cls, latest } from "kiru/utils"
import type { DebuggerEntry } from "../../../lib/dist/globalContext"
import {
  createDraggableController,
  createResizableController,
  kiruGlobal,
  ResizeGripIcon,
  ValueViewer,
  buildViewerRoot,
  emptyCache,
  collectFromRoot,
  disposeCache,
  devtoolsState,
} from "devtools-shared"
import {
  DRAG_SNAP_PADDING,
  DEBUGGER_MIN_WIDTH,
  DEBUGGER_MIN_HEIGHT,
} from "../constants"
const DEBUGGER_POSITION_STORAGE_KEY = "kiru.devtools.debuggerPosition"
const DEBUGGER_SIZE_STORAGE_KEY = "kiru.devtools.debuggerSize"

interface DebuggerWidgetProps {
  state: kiru.TransitionState
}
export const DebuggerWidget: Kiru.FC<DebuggerWidgetProps> = () => {
  const dragController = createDraggableController({
    key: DEBUGGER_POSITION_STORAGE_KEY,
    storage: sessionStorage,
    allowFloat: true,
    snapDistance: 50,
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    getPadding: () => [DRAG_SNAP_PADDING, DRAG_SNAP_PADDING],
  })

  const resizeController = createResizableController({
    key: DEBUGGER_SIZE_STORAGE_KEY,
    storage: sessionStorage,
    minSize: [DEBUGGER_MIN_WIDTH, DEBUGGER_MIN_HEIGHT],
  })

  kiru.onMount(() => {
    dragController.init()
    resizeController.init()
    return () => {
      dragController.dispose()
      resizeController.dispose()
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

  return ({ state }) => (
    <div
      ref={containerRef}
      className={cls(
        "z-50 fixed rounded-lg p-0.5 flex flex-col gap-2 select-none overflow-hidden",
        "bg-neutral-900 opacity-75 hover:opacity-100 shadow-lg"
      )}
      style={{
        minWidth: `${DEBUGGER_MIN_WIDTH}px`,
        minHeight: `${DEBUGGER_MIN_HEIGHT}px`,
        cursor: resizeController.isResizing.value
          ? "se-resize"
          : dragController.isDragging.value
          ? "grabbing"
          : "grab",
      }}
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
        <DebuggerView />
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

const DebuggerView: Kiru.FC = () => {
  const debuggerEntries = kiru.signal<DebuggerEntry[]>([])

  kiru.onMount(() => {
    const unsub = kiruGlobal().devtools!.debugger.subscribe((newEntries) => {
      debuggerEntries.value = Array.from(newEntries)
    })
    return () => unsub()
  })

  return () => (
    <div className="flex flex-col gap-2 p-2">
      {debuggerEntries.value.map((entry) => (
        <SignalCard
          // @ts-ignore ligma
          key={`${entry.label}:${entry.signal.$id}`}
          label={entry.label}
          signal={entry.signal}
        />
      ))}
    </div>
  )
}

const SignalCard: Kiru.FC<{ label: string; signal: Kiru.Signal<any> }> = ({
  label,
  signal,
}) => {
  const settings = devtoolsState.viewerSettings.peek()

  // For plain objects, spread keys at the root so the viewer shows properties
  // directly. For everything else (primitives, arrays, null) wrap under "value"
  // so buildViewerRoot always receives a Record<string, unknown>.
  const toRootData = (val: unknown): Record<string, unknown> =>
    val !== null && typeof val === "object" && !Array.isArray(val)
      ? (val as Record<string, unknown>)
      : { value: val }

  const viewerRootSig = kiru.signal(
    buildViewerRoot(toRootData(signal.peek()), label, emptyCache(), settings)
  )

  kiru.onMount(() => {
    const unsub = signal.subscribe((newValue) => {
      // Collect signals from the current root into prevCache so buildViewerRoot
      // can reuse collapse/page state, then dispose whatever wasn't reused.
      const prevCache = emptyCache()
      collectFromRoot(viewerRootSig.peek(), label, prevCache)
      viewerRootSig.value = buildViewerRoot(
        toRootData(newValue),
        label,
        prevCache,
        settings
      )
      disposeCache(prevCache)
    })
    return () => {
      unsub()
      const c = emptyCache()
      collectFromRoot(viewerRootSig.peek(), label, c)
      disposeCache(c)
    }
  })

  return () => (
    <div className="rounded border border-neutral-700 text-xs">
      <div className="px-2 py-1 border-b border-neutral-700 font-medium text-neutral-300">
        {label}
      </div>
      <ValueViewer root={viewerRootSig.value} />
    </div>
  )
}
