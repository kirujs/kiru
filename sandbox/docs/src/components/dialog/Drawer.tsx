import { useRef, type TransitionState, useEffect } from "kiru"
import { Backdrop } from "./Backdrop"
import { isClickEventFromKeyboard, trapFocus } from "$/utils"

type DrawerProps = {
  state: TransitionState
  close: () => void
  side: "bottom" | "left" | "right"
  sender?: Event | null
  children: JSX.Children
}

export function Drawer({ state, close, side, sender, children }: DrawerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  if (state == "exited") return null
  const opacity = state === "entered" ? "1" : "0"
  const translateX =
    side === "right"
      ? state === "entered"
        ? 0
        : 100
      : side === "left"
        ? state === "entered"
          ? 0
          : -100
        : 0
  const translateY = side === "bottom" ? (state === "entered" ? 0 : 100) : 0

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)

    // if the drawer was opened via keyboard 'click', focus the first internal element
    if (sender && isClickEventFromKeyboard(sender)) {
      const firstFocussable = wrapperRef.current!.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      if (firstFocussable && firstFocussable instanceof HTMLElement) {
        firstFocussable.focus()
      }
    }

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      handleClose()
    }

    wrapperRef.current && trapFocus(wrapperRef.current, e)
  }

  function handleClose() {
    if (sender && sender.target && sender.target instanceof HTMLElement)
      sender.target.focus()
    close()
  }

  return (
    <Backdrop
      ref={wrapperRef}
      onclick={(e) => e.target === wrapperRef.current && handleClose()}
      style={{ opacity }}
    >
      <div
        className="drawer-content"
        data-side={side}
        style={{ transform: `translate(${translateX}%, ${translateY}%)` }}
      >
        {children}
      </div>
    </Backdrop>
  )
}
