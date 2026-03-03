import * as kiru from "kiru"
import {
  createMousePositionTracker,
  ExternalLinkIcon,
  getFileLink,
  getNodeName,
  isDevtoolsApp,
  kiruGlobal,
} from "devtools-shared"
import { isComponentSelectorEnabled, selectedComponentForPanel } from "../state"

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

export const ComponentSelectorWidget: Kiru.FC<
  ComponentSelectorWidgetProps
> = () => {
  const [mousePos, disposeMousePositionTracker] = createMousePositionTracker()

  kiru.onCleanup(() => disposeMousePositionTracker())

  const currentComponentHover = kiru.signal<HoverInfo | null>(null)

  let pendingAnimationFrame: number | null = null

  const runUpdateCurrentComponentHover = () => {
    const enabled = isComponentSelectorEnabled.value,
      { x, y } = mousePos.value

    if (!enabled) {
      currentComponentHover.value = null
      return
    }

    const elements = document.elementsFromPoint(x, y)

    let searchResult: ComponentSearchResult | null = null
    for (const element of elements) {
      searchResult = findElementNearestComponentWithLink(element)
      if (searchResult) break
    }
    if (!searchResult) {
      currentComponentHover.value = null
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

    currentComponentHover.value = {
      name: getNodeName(searchResult.component),
      top: minTop,
      left: minLeft,
      width: width,
      height: height,
      link: searchResult.link,
      component: searchResult.component,
    }
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
    if (!isComponentSelectorEnabled.value || !currentComponentHover.value)
      return
    const { name, link, component } = currentComponentHover.value
    if (!link) return
    isComponentSelectorEnabled.value = false
    selectedComponentForPanel.value = { name, link, component, unmounted: false }
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
    const enabled = isComponentSelectorEnabled.value,
      info = currentComponentHover.value
    if (!enabled || !info || state === "exited") return null

    return (
      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          top: info.top + window.scrollY + "px",
          left: info.left + window.scrollX + "px",
          width: info.width + "px",
          height: info.height + "px",
          cursor: "pointer",
          opacity: state === "entered" ? 1 : 0,
          scale: state === "entered" ? 1 : 0,
          transition: "80ms ease-in-out",
          background:
            "linear-gradient(135deg, rgb(164 11 32 / 66%) 0%, rgb(82 14 47 / 80%) 80%)",
        }}
        title="Click to open in editor"
        onclick={handleClick}
        className="text-white flex items-center justify-center"
      >
        <span className="font-medium text-sm truncate max-w-full">
          {`<${info.name}>`}
        </span>
      </div>
    )
  }
}

interface ComponentSearchResult {
  elements: Set<Element>
  component: Kiru.VNode
  link: string
}

function findElementNearestComponentWithLink(
  el: Element
): ComponentSearchResult | null {
  if (!(el as any).__kiruNode) return null

  // find the nearest component
  let component: Kiru.VNode | null = null
  let n: Kiru.VNode | null = (el as any).__kiruNode
  while (n) {
    if (typeof n.type === "function") {
      component = n
      break
    }
    n = n.parent
  }
  if (!component) return null

  const link = getComponentFileLink(component)
  if (!link) return null

  // traverse & collect all of the first-of-branch elements
  const elements = collectDomNodes(component.child!)

  return { elements, component, link }
}

function getComponentFileLink(component: Kiru.VNode): string | null {
  const anyComponent = component as any
  // Try common places where the dev file link symbol may be attached.
  return (
    getFileLink(anyComponent.type) ??
    (anyComponent.component && getFileLink(anyComponent.component)) ??
    (anyComponent.component && getFileLink(anyComponent.component.type)) ??
    null
  )
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
