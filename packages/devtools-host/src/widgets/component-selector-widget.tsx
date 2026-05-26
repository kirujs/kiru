import * as kiru from "kiru"
import {
  createMousePositionTracker,
  getFileLink,
  getNodeName,
  isDevtoolsApp,
  kiruGlobal,
  computeComponentHash,
} from "devtools-shared"
import {
  componentInfoPanels,
  isComponentSelectorEnabled,
  widgetStackTop,
} from "../state"
import { SelectionBox } from "../components/selection-box"
import { className as cls } from "kiru/utils"

interface HoverInfo {
  name: string
  top: number
  left: number
  width: number
  height: number
  link: string
  component: Kiru.VNode
}

interface ComponentSelectorWidgetProps {
  state: kiru.TransitionState
}

export const ComponentSelectorWidget: Kiru.Component<
  ComponentSelectorWidgetProps
> = () => {
  const [mousePos, disposeMousePositionTracker] = createMousePositionTracker()

  kiru.onCleanup(() => disposeMousePositionTracker())

  const currentComponentHover = kiru.signal<HoverInfo | null>(null)

  let pendingAnimationFrame: number | null = null

  const runUpdateCurrentComponentHover = () => {
    const enabled = isComponentSelectorEnabled(),
      { x, y } = mousePos()

    if (!enabled) {
      currentComponentHover.set(null)
      return
    }

    const elements = document.elementsFromPoint(x, y)

    let searchResult: ComponentSearchResult | null = null
    for (const element of elements) {
      const node = element.__kiruNode
      if (!node) continue
      searchResult = findNearestComponentWithLink(node)
      if (searchResult) break
    }
    if (!searchResult) {
      currentComponentHover.set(null)
      return
    }

    let minLeft = Infinity,
      minTop = Infinity,
      maxRight = -Infinity,
      maxBottom = -Infinity

    for (const element of searchResult.elements) {
      const {
        top: elTop,
        left: elLeft,
        width: elWidth,
        height: elHeight,
      } = element.getBoundingClientRect()

      minLeft = Math.min(minLeft, elLeft)
      minTop = Math.min(minTop, elTop)
      maxRight = Math.max(maxRight, elLeft + elWidth)
      maxBottom = Math.max(maxBottom, elTop + elHeight)
    }

    const width = maxRight - minLeft
    const height = maxBottom - minTop

    currentComponentHover.set({
      name: getNodeName(searchResult.component),
      top: minTop,
      left: minLeft,
      width: width,
      height: height,
      link: searchResult.link,
      component: searchResult.component,
    })
  }

  const updateCurrentComponentHover = () => {
    if (pendingAnimationFrame != null) return
    pendingAnimationFrame = requestAnimationFrame(() => {
      pendingAnimationFrame = null
      runUpdateCurrentComponentHover()
    })
  }

  kiru.effect(
    [isComponentSelectorEnabled, mousePos],
    updateCurrentComponentHover
  )

  const handleClick = (e: Kiru.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    const hover = currentComponentHover()
    if (!isComponentSelectorEnabled() || !hover) return
    const { name, link, component } = hover
    if (!link) return
    const hash = computeComponentHash(component)
    isComponentSelectorEnabled.set(false)

    componentInfoPanels.set((prev) => {
      const existingIndex = prev.findIndex(
        (panel) => panel.hash === hash && panel.link === link
      )
      if (existingIndex !== -1) {
        const existing = prev[existingIndex]
        const updated = {
          ...existing,
          pulseGeneration: (existing.pulseGeneration ?? 0) + 1,
        }
        const others = prev.filter((p) => p.id !== existing.id)
        return [...others, updated]
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          link,
          component,
          unmounted: false,
          hash,
          pulseGeneration: 0,
        },
      ]
    })
    widgetStackTop.set("componentInfo")
  }

  const onAppUpdate = (updatedApp: kiru.AppHandle) => {
    if (isDevtoolsApp(updatedApp)) return
    updateCurrentComponentHover()
  }

  kiruGlobal().on("update", onAppUpdate)
  window.addEventListener("resize", updateCurrentComponentHover)
  window.addEventListener("scroll", updateCurrentComponentHover)
  const mutationObserver = new MutationObserver(updateCurrentComponentHover)
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
  const resizeObserver = new ResizeObserver(updateCurrentComponentHover)
  resizeObserver.observe(document.body)

  kiru.onCleanup(() => {
    kiruGlobal().off("update", onAppUpdate)
    window.removeEventListener("resize", updateCurrentComponentHover)
    window.removeEventListener("scroll", updateCurrentComponentHover)
    mutationObserver.disconnect()
    resizeObserver.disconnect()
  })

  return ({ state }) => {
    const enabled = isComponentSelectorEnabled(),
      info = currentComponentHover()
    if (!enabled || !info || state === "exited") return null

    return (
      <SelectionBox
        top={info.top + window.scrollY}
        left={info.left + window.scrollX}
        width={info.width}
        height={info.height}
        className={cls(
          "text-white flex items-center justify-center",
          state === "entered" ? "opacity-100" : "opacity-90",
          state === "entered" ? "scale-100" : "scale-90"
        )}
        onclick={handleClick}
      >
        <span className="font-medium text-sm truncate max-w-full">
          {`<${info.name}>`}
        </span>
      </SelectionBox>
    )
  }
}

interface ComponentSearchResult {
  elements: Set<Element>
  component: Kiru.VNode
  link: string
}

function findNearestComponentWithLink(
  node: Kiru.VNode
): ComponentSearchResult | null {
  // find the nearest component
  let match: null | { component: Kiru.VNode; link: string } = null
  let n: Kiru.VNode | null = node
  while (n) {
    if (typeof n.type === "function") {
      const c = n,
        l = getFileLink(c.type)
      if (l) {
        match = { component: c, link: l }
        break
      }
    }
    n = n.parent
  }
  if (!match) return null

  return { ...match, elements: collectDomNodes(match.component.child!) }
}

function collectDomNodes(
  firstChild: Kiru.VNode,
  elements: Set<Element> = new Set()
): Set<Element> {
  let child: Kiru.VNode | null = firstChild
  while (child) {
    if (child.dom && child.dom instanceof Element) {
      elements.add(child.dom)
    } else if (child.child) {
      collectDomNodes(child.child, elements)
    }
    child = child.sibling
  }
  return elements
}
