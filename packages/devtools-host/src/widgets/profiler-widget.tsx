import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import {
  createDraggableController,
  createResizableController,
  ProfilingTabView,
  ResizeGripIcon,
} from "devtools-shared"
import {
  DRAG_SNAP_PADDING,
  PROFILER_MIN_WIDTH,
  PROFILER_MIN_HEIGHT,
} from "../constants"
const PROFILER_POSITION_STORAGE_KEY = "kiru.devtools.profilerPosition"
const PROFILER_SIZE_STORAGE_KEY = "kiru.devtools.profilerSize"

interface ProfilingWidgetProps {
  state: kiru.TransitionState
}
export const ProfilingWidget: Kiru.FC<ProfilingWidgetProps> = () => {
  const dragController = createDraggableController({
    key: PROFILER_POSITION_STORAGE_KEY,
    storage: sessionStorage,
    allowFloat: true,
    snapDistance: 50,
    getDraggableBounds: () => [window.innerWidth, window.innerHeight],
    getPadding: () => [DRAG_SNAP_PADDING, DRAG_SNAP_PADDING],
  })

  const resizeController = createResizableController({
    key: PROFILER_SIZE_STORAGE_KEY,
    storage: sessionStorage,
    minSize: [PROFILER_MIN_WIDTH, PROFILER_MIN_HEIGHT],
    aspectRatio: 2 / 1,
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
        minWidth: `${PROFILER_MIN_WIDTH}px`,
        minHeight: `${PROFILER_MIN_HEIGHT}px`,
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
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <ProfilingTabView pauseWhen={dragController.isDragging} />
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
