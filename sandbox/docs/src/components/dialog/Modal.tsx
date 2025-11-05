import { useRef, type TransitionState, useEffect } from "kiru"
import { Backdrop } from "./Backdrop"
import { trapFocus } from "$/utils"

type ModalProps = {
  state: TransitionState
  close: () => void
  className?: string
  sender?: Event | null
  children: JSX.Children
}

export function Modal({
  state,
  close,
  sender,
  className = "",
  children,
}: ModalProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  const opacity = state === "entered" ? "1" : "0"
  const scale = state === "entered" ? 1 : 0.85
  const translateY = state === "entered" ? -50 : -65

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (state == "exited") return null

  function handleKeyDown(e: KeyboardEvent) {
    const outerEl = wrapperRef.current
    if (state === "exited" || !outerEl) return
    if (e.key === "Escape") {
      e.preventDefault()
      return handleClose()
    }
    trapFocus(outerEl, e)
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
        className={`modal-content p-4 ${className}`}
        style={{
          transform: `translate(-50%, ${translateY}%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </Backdrop>
  )
}
