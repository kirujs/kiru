import * as kiru from "kiru"

export function createMousePositionTracker() {
  const mousePosition = kiru.signal({ x: 0, y: 0 })
  const handleMouseMove = (e: MouseEvent) => {
    mousePosition.value = { x: e.clientX, y: e.clientY }
  }
  window.addEventListener("mousemove", handleMouseMove)

  return [
    mousePosition,
    () => window.removeEventListener("mousemove", handleMouseMove),
  ] as const
}
