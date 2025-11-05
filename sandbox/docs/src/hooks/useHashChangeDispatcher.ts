import { customEvents } from "$/custom-events"
import { navEvent } from "$/state/navigationEvent"
import { useEffect, useRef, useState } from "kiru"
import { useFileRouter } from "kiru/router"
export const useHashChangeDispatcher = (sectionIds: string[]) => {
  const [currentSection, setCurrentSection] = useState<string>("")
  const router = useFileRouter()
  const hasScrolled = useRef(false)
  useEffect(() => {
    hasScrolled.current = false
  }, [router.state.path])

  function findSectionCompletelyInViewport() {
    for (const sectionId of sectionIds) {
      const el = document.getElementById(sectionId)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        return sectionId
      }
    }
    return ""
  }

  function findMostVisibleSection() {
    const state: Array<{ id: string; percent: number }> = []

    for (const sectionId of sectionIds) {
      const el = document.getElementById(sectionId)
      if (!el) continue

      const rect = el.getBoundingClientRect()

      const visibleTop = Math.max(rect.top, 0)
      const visibleBottom = Math.min(rect.bottom, window.innerHeight)

      const visibleHeight = visibleBottom - visibleTop
      const totalHeight = rect.height

      const percent = visibleHeight > 0 ? visibleHeight / totalHeight : 0
      state.push({ id: sectionId, percent })
    }

    const sorted = state.sort((a, b) => b.percent - a.percent)
    return sorted[0]?.id ?? ""
  }

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      // if it's a scroll event that was triggered by user navigation, don't do anything
      if (!e || (e.type === "scroll" && navEvent.peek())) return
      let sectionId = ""
      if (window.scrollY > 50) {
        if (
          window.scrollY + window.innerHeight >=
          document.body.offsetHeight - 10
        ) {
          // if we've scrolled to the bottom of the page (or within 10px), just select the last section
          sectionId = sectionIds[sectionIds.length - 1]
        } else {
          // otherwise, select based on visibility
          sectionId =
            findSectionCompletelyInViewport() || findMostVisibleSection()
        }
      }

      setCurrentSection(sectionId)
      dispatchHashChange(sectionId)
    }

    // // Run on initial mount to handle the case when the page is loaded scrolled partway down
    // if (!!window.location.hash) {
    //   handleScroll()
    // }

    window.addEventListener("scroll", handleScroll)
    window.addEventListener("resize", handleScroll)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
    }
  }, [sectionIds])

  return currentSection
}

let timeout: number | undefined
function dispatchHashChange(newHash: string) {
  clearTimeout(timeout)
  timeout = window.setTimeout(() => {
    const hash = newHash ? `#${newHash}` : ""
    if (hash !== "") {
      window.history.replaceState(null, "", hash)
    } else {
      window.history.replaceState(null, "", window.location.href.split("#")[0])
    }

    // Dispatch a hashchange event
    window.dispatchEvent(new customEvents.scrollHashChangeEvent())
  }, 50)
}
