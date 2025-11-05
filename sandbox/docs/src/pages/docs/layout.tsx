import { useEffect, useMemo, useRef, useState } from "kiru"
import { className as cls } from "kiru/utils"
import { useFileRouter } from "kiru/router"
import { Container } from "$/components/atoms/Container"
import { SidebarContent } from "$/components/SidebarContent"
import { DocItem, docMeta } from "$/docs-meta"
import { useHashChangeDispatcher } from "$/hooks/useHashChangeDispatcher"

export default function DocsLayout({ children }: { children: JSX.Children }) {
  const router = useFileRouter()
  const sectionIds = useMemo(() => {
    let pageData: DocItem | null = null
    for (const docItem of docMeta) {
      if (docItem.href === router.state.path) {
        pageData = docItem
        break
      }
      if (docItem.pages) {
        const res = docItem.pages.find(
          (page) => page.href === router.state.path
        )
        if (res) {
          pageData = res
          break
        }
      }
    }
    if (!pageData) return []
    return pageData.sections?.map(({ id }) => id) ?? []
  }, [router.state.path])
  useHashChangeDispatcher(sectionIds)

  return (
    <Container className="flex gap-8 pt-(--navbar-height) min-h-screen">
      <aside className="hidden sm:block min-w-[200px] max-h-[calc(100vh-2.5rem-60px)] sticky top-20 p-1 overflow-y-auto">
        <div>
          <SidebarContent />
          <ActiveLinkTrackerSlidingThing />
        </div>
      </aside>
      <article className="prose prose-invert grow py-5 w-full max-w-none sm:max-w-[calc(100%-200px-2rem)]">
        {children}
      </article>
    </Container>
  )
}

const ASIDE_PADDING = 0

function ActiveLinkTrackerSlidingThing() {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const setPos = () => {
      if (!ref.current) return
      const parent = document.querySelector("aside")!
      const parentRect = parent.getBoundingClientRect()
      const el = parent.querySelector(
        'a[href="' + window.location.pathname + window.location.hash + '"]'
      )
      if (!el) return
      const tgtRect = el.getBoundingClientRect()
      // adding 1px to account for box sizing !== line height
      ref.current.style.top =
        tgtRect.top -
        parentRect.top +
        parent.scrollTop -
        ASIDE_PADDING +
        1 +
        "px"
      ref.current.style.height = tgtRect.height + "px"
    }
    setPos()
    window.addEventListener("resize", setPos)
    window.addEventListener("hashchange", setPos)
    return () => {
      window.removeEventListener("resize", setPos)
      window.removeEventListener("hashchange", setPos)
    }
  }, [globalThis.window?.location.pathname, globalThis.window?.location.hash])

  return (
    <div
      ref={ref}
      className={cls(
        "bg-neutral-50 w-[2px] h-4 block absolute left-0 top-0",
        mounted ? "opacity-100 transition-all" : "opacity-0"
      )}
    ></div>
  )
}
