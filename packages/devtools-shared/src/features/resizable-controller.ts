import * as kiru from "kiru"

type Vec2 = [width: number, height: number]

interface ResizableControllerConfig {
  storage: Storage
  key: string
  minSize?: Vec2
  /** Desired width/height ratio. When set, height is always derived from width. */
  aspectRatio?: number
}

interface ResizableController {
  containerRef: kiru.Signal<HTMLElement | null>
  handleRef: kiru.Signal<HTMLElement | null>
  isResizing: kiru.Signal<boolean>
  init: () => void
  dispose: () => void
}

export function createResizableController(
  config: ResizableControllerConfig
): ResizableController {
  const cleanups: (() => void)[] = []
  const dispose = () => cleanups.forEach((c) => c())

  const containerRef = kiru.signal<HTMLElement | null>(null)
  const handleRef = kiru.signal<HTMLElement | null>(null)
  const isResizing = kiru.signal(false)

  const [minW, minH] = config.minSize ?? [0, 0]
  const ar = config.aspectRatio ?? null

  const onHandleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()

    isResizing.value = true
    document.body.style.cursor = "se-resize"
    document.body.style.userSelect = "none"

    const container = containerRef.value!
    const startX = e.clientX
    const startY = e.clientY
    const startW = container.offsetWidth
    const startH = container.offsetHeight

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (ar !== null) {
        // Project (dx, dy) onto the aspect-ratio diagonal (ar, 1) so that
        // dragging at any angle feels natural when a ratio is locked.
        const t = (dx * ar + dy) / (ar * ar + 1)
        let w = Math.max(minW, startW + t * ar)
        let h = w / ar
        if (h < minH) {
          h = minH
          w = h * ar
        }
        container.style.width = `${w}px`
        container.style.height = `${h}px`
      } else {
        container.style.width = `${Math.max(minW, startW + dx)}px`
        container.style.height = `${Math.max(minH, startH + dy)}px`
      }
    }

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      isResizing.value = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      config.storage.setItem(
        config.key,
        JSON.stringify({ w: container.offsetWidth, h: container.offsetHeight })
      )
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const init = () => {
    const handle = handleRef.value!
    if (!handle) return console.error("resize handle not found", new Error().stack)
    const container = containerRef.value!
    if (!container) return console.error("resize container not found", new Error().stack)

    const stored = loadSizeFromStorage(config.storage, config.key)
    if (stored) {
      const w = stored[0]
      const h = ar !== null ? w / ar : stored[1]
      container.style.width = `${w}px`
      container.style.height = `${h}px`
    }

    handle.addEventListener("mousedown", onHandleMouseDown)
    cleanups.push(() => handle.removeEventListener("mousedown", onHandleMouseDown))
  }

  return { containerRef, handleRef, isResizing, init, dispose }
}

function loadSizeFromStorage(storage: Storage, key: string): Vec2 | null {
  const str = storage.getItem(key)
  if (!str) return null
  try {
    const p = JSON.parse(str)
    if (typeof p.w === "number" && typeof p.h === "number") return [p.w, p.h]
  } catch {}
  return null
}
