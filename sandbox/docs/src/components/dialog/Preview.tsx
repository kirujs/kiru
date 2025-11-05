import { type TransitionState } from "kiru"

type PreviewProps = {
  state: TransitionState
  children: JSX.Children
}

export function Preview({ state, children }: PreviewProps) {
  if (state == "exited") return null
  const opacity = state === "entered" ? "1" : "0"
  const scale = state === "entered" ? 1 : 0.85
  const translateY = state === "entered" ? -50 : -65

  return (
    <div
      className={`preview-content p-4`}
      style={{
        opacity,
        transform: `translate(-50%, ${translateY}%) scale(${scale})`,
      }}
    >
      {children}
    </div>
  )
}
