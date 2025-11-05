import { CodePreviewData } from "$/types"
import { isLinkActive } from "$/utils"
import { Portal, Transition, useCallback, useRef, useState } from "kiru"
import { Link, useFileRouter } from "kiru/router"

function clearTimeoutRef(timeoutRef: Kiru.MutableRefObject<number>) {
  if (timeoutRef.current !== -1) {
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = -1
  }
}

export function CodePreview({
  data,
  text,
}: {
  data: CodePreviewData
  text?: string
}) {
  const router = useFileRouter()
  const linkRef = useRef<any>(null)
  const linkBounds = useRef<DOMRect | null>(null)
  const [open, setOpen] = useState(false)
  const previewHovered = useRef(false)
  const hideTimeout = useRef(-1)

  const handleOpen = useCallback(() => {
    clearTimeoutRef(hideTimeout)
    linkBounds.current = linkRef.current?.getBoundingClientRect() || null
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    if (previewHovered.current) return
    clearTimeoutRef(hideTimeout)
    hideTimeout.current = window.setTimeout(() => setOpen(false), 250)
  }, [])

  return (
    <>
      {isLinkActive(data.link.href, router.state.path) ? (
        <button
          className="preview-button"
          ariaLabel="Show code preview"
          ref={linkRef}
          onfocus={handleOpen}
          onblur={handleClose}
          onpointerenter={handleOpen}
          onpointerleave={handleClose}
        >
          {text ?? data.link.text}
        </button>
      ) : (
        <Link
          to={data.link.href}
          ref={linkRef}
          onfocus={handleOpen}
          onblur={handleClose}
          onpointerenter={handleOpen}
          onpointerleave={handleClose}
        >
          {text ?? data.link.text}
        </Link>
      )}

      <Portal container={() => document.getElementById("portal-root")!}>
        <Transition
          in={open}
          element={(state) => {
            if (state === "exited") return null
            if (!linkBounds.current) return null
            const x = linkBounds.current.x
            const y = linkBounds.current.y + window.scrollY
            const width = linkBounds.current.width
            const height = linkBounds.current.height
            const opacity = state === "entered" ? "1" : "0"

            const linkCenterX = x + width / 2
            let previewOffsetX = Math.min(
              linkCenterX - 200,
              window.innerWidth - 420
            )
            if (previewOffsetX < 10) previewOffsetX = 10

            return (
              <div className="transition-opacity" style={{ opacity }}>
                <div
                  onpointerenter={() => (
                    clearTimeoutRef(hideTimeout),
                    (previewHovered.current = true)
                  )}
                  onpointerleave={() => {
                    previewHovered.current = false
                    handleClose()
                  }}
                  style={{
                    transform: `translate(${previewOffsetX}px, calc(${y + height}px + .5rem))`,
                  }}
                  className="preview-content"
                >
                  <div className="not-prose">
                    <data.element />
                  </div>
                </div>
              </div>
            )
          }}
        />
      </Portal>
    </>
  )
}
