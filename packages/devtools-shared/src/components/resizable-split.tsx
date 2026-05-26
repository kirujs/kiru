import * as kiru from "kiru"
import { className as cls } from "kiru/utils"
import {
  createElementBoundingTracker,
  createMousePositionTracker,
} from "../features"

interface ResizableSplitProps
  extends Omit<kiru.ElementProps<"div">, "children"> {
  children: [JSX.Element, JSX.Element]
  minContainerWidth?: number
}
export const ResizableSplit: Kiru.Component<ResizableSplitProps> = (props) => {
  const minContainerWidth = props.minContainerWidth ?? 250
  const cleanups: (() => void)[] = []
  const dispose = () => {
    cleanups.forEach((cleanup) => cleanup())
    cleanups.length = 0
  }

  const startMouse = kiru.signal<{ x: number; y: number } | null>(null)

  const prevFirstContainerWidth = kiru.signal(0)
  const firstContainerWidth = kiru.signal(0)
  const firstViewContainer = kiru.ref<HTMLDivElement>(null)
  const mainContainer = kiru.ref<HTMLDivElement>(null)

  const [mouse, disposeMousePosTracker] = createMousePositionTracker()
  const firstViewContainerBounding =
    createElementBoundingTracker(firstViewContainer)

  cleanups.push(disposeMousePosTracker)

  const onMouseDown = (e: Kiru.MouseEvent) => {
    e.preventDefault()
    startMouse.set({ ...mouse() })
    prevFirstContainerWidth.set(firstContainerWidth())
    console.log("onMouseDown", {
      startMouse: startMouse(),
      prevFirstContainerWidth: prevFirstContainerWidth(),
      firstContainerWidth: firstContainerWidth(),
    })
  }

  const onMouseUp = () => (startMouse.set(null))
  const onMouseMove = (e: MouseEvent) => {
    const mouse = startMouse()
    if (mouse === null || mainContainer.current == null) return

    const max = Math.max(
      prevFirstContainerWidth() + e.x - mouse.x,
      minContainerWidth
    )
    firstContainerWidth.set(
      Math.min(max, mainContainer.current.clientWidth - minContainerWidth)
    )
    console.log("onMouseMove", max, firstContainerWidth())
  }
  const onResize = () => {
    if (mainContainer.current == null) return
    if (
      mainContainer.current.clientWidth - minContainerWidth <
      firstContainerWidth()
    ) {
      firstContainerWidth.set(
        Math.max(
          mainContainer.current.clientWidth - minContainerWidth,
          minContainerWidth
        )
      )
    }
  }

  window.addEventListener("mouseup", onMouseUp)
  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("resize", onResize)
  cleanups.push(() => {
    window.removeEventListener("mouseup", onMouseUp)
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("resize", onResize)
  })

  kiru.onBeforeMount(() => {
    if (!mainContainer.current) return
    firstContainerWidth.set(mainContainer.current.clientWidth / 2)

    firstViewContainerBounding.init()
    return () => {
      firstViewContainerBounding.dispose()
    }
  })

  firstViewContainerBounding.state.width.subscribe((width) => {
    console.log("width", width)
  })

  kiru.onCleanup(() => dispose())

  return ({ children, className, ...props }: ResizableSplitProps) => {
    const [firstView, secondView] = Array.isArray(children) ? children : []
    return (
      <div
        className={cls(
          "flex-grow grid gap-2 items-start w-full relative",
          className != null
            ? kiru.isSignal(className)
              ? className()
              : className
            : undefined
        )}
        ref={mainContainer}
        style={{ gridTemplateColumns: `${firstContainerWidth}px 1fr` }}
        {...props}
      >
        <div ref={firstViewContainer} className="firstContainer w-full h-full">
          {firstView}
        </div>
        {firstViewContainerBounding.state.width() != 0 && (
          <div
            className="w-8 flex justify-center h-full absolute top-0 -translate-x-1/2 cursor-col-resize z-[9999]"
            style={{
              left: `${firstViewContainerBounding.state.width()}px`,
            }}
            onmousedown={onMouseDown}
          >
            <div className="dividerLine w-[5px] bg-neutral-800 h-full" />
          </div>
        )}
        <div className="secondContainer h-full">{secondView}</div>
      </div>
    )
  }
}
