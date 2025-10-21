import * as kiru from "kiru"
import { Flame } from "./icon/Flame"
import { useAnchorPos } from "./hooks/useAnchorPos"
import { useSignal, Transition, useEffect, useLayoutEffect, useRef } from "kiru"
import { useDevTools } from "./hooks/useDevtools"
import { InspectComponent } from "./components/InspectComponent"
import { PageInfo } from "./icon/PageInfo"
import { SquareMouse } from "./icon/SquareMouse"
import { toggleElementToVnode } from "./store"
import { broadcastChannel } from "devtools-shared"

const handleToggleInspect = () => {
  toggleElementToVnode.value = !toggleElementToVnode.value
  broadcastChannel.send({
    type: "set-inspect-enabled",
    value: toggleElementToVnode.value,
  })
}

type Vec2 = {
  x: number
  y: number
}

type LerpedVec2Signal = kiru.Signal<Vec2> & {
  set: (value: Vec2, options?: { hard?: boolean }) => void
}

function useLerpedVec2(
  value: Vec2,
  options: { damping: number }
): LerpedVec2Signal {
  const { damping } = options
  const current = useSignal(value)
  const target = useRef(value)

  useEffect(() => {
    let frameId: number | null = null
    const callback: FrameRequestCallback = () => {
      const dist = Math.sqrt(
        Math.pow(target.current.x - current.value.x, 2) +
          Math.pow(target.current.y - current.value.y, 2)
      )
      if (dist < 5) {
        return
      }
      const nextX =
        current.value.x + (target.current.x - current.value.x) * damping
      const nextY =
        current.value.y + (target.current.y - current.value.y) * damping

      current.value = {
        x: nextX,
        y: nextY,
      }

      frameId = window.requestAnimationFrame(callback)
    }
    frameId = window.requestAnimationFrame(callback)
    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [value.x, value.y])

  return Object.assign(current, {
    set: (value: Vec2, options: { hard?: boolean }): void => {
      target.current = value
      if (options?.hard) {
        current.value = value
      }
    },
  }) as LerpedVec2Signal
}

export default function App() {
  const toggled = useSignal(false)
  const handleOpen = useDevTools()
  const { anchorCoords, anchorRef, viewPortRef, startMouse, snapSide } =
    useAnchorPos()
  const isHorizontalSnap =
    snapSide.value === "left" || snapSide.value === "right"
  const isMounted = useRef(false)

  const smoothedCoords = useLerpedVec2(anchorCoords.value, {
    damping: 0.4,
  })
  kiru.useWatch([anchorCoords], smoothedCoords.set)

  useLayoutEffect(() => {
    if (isMounted.current === false) {
      smoothedCoords.set(anchorCoords.value, {
        hard: true,
      })
    }

    isMounted.current = true
  }, [])

  return (
    <>
      <div
        ref={viewPortRef}
        className="w-full h-0 fixed top-0 left-0 z-[-9999] overflow-scroll pointer-events-none"
      />
      <div
        ref={anchorRef}
        draggable
        className={`flex ${isHorizontalSnap ? "flex-col" : ""} ${
          toggled.value ? "rounded-3xl" : "rounded-full"
        } p-1 gap-1 items-center will-change-transform bg-crimson`}
        style={{
          transform: `translate3d(${Math.round(
            smoothedCoords.value.x
          )}px, ${Math.round(smoothedCoords.value.y)}px, 0)`,
        }}
      >
        <Transition
          in={toggled.value}
          duration={{
            in: 40,
            out: 150,
          }}
          element={(state) => {
            if (state === "exited") return null
            const scale = state === "entered" ? "1" : "0.5"
            const opacity = state === "entered" ? "1" : "0"
            return (
              <>
                <button
                  title="Open Devtools"
                  onclick={handleOpen}
                  style={{ transform: `scale(${scale})`, opacity }}
                  className="transition text-white rounded-full p-1 hover:bg-[#0003]"
                >
                  <PageInfo width={16} height={16} />
                </button>
                <button
                  title="Toggle Component Inspection"
                  onclick={handleToggleInspect}
                  style={{ transform: `scale(${scale})`, opacity }}
                  className={`transition text-white rounded-full p-1 hover:bg-[#0003] ${
                    toggleElementToVnode.value ? "bg-[#0003]" : ""
                  }`}
                >
                  <SquareMouse width={16} height={16} />
                </button>
              </>
            )
          }}
        />
        <button
          className={
            "bg-crimson rounded-full p-1" +
            (startMouse.value ? " pointer-events-none" : "")
          }
          onclick={() => (toggled.value = !toggled.value)}
          tabIndex={-1}
        >
          <Flame />
        </button>
      </div>
      <InspectComponent />
    </>
  )
}
