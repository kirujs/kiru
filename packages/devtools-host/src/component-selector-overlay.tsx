import * as kiru from "kiru"
import {
  createMousePositionTracker,
  devtoolsState,
  getNodeName,
} from "devtools-shared"
import { isOverlayShown } from "./state"
const { componentSelection } = devtoolsState

const selectorEnabled = kiru.computed(() => componentSelection.value.enabled)

export function ComponentSelectorOverlay() {
  const [mousePos, disposeMousePositionTracker] = createMousePositionTracker()

  kiru.onCleanup(() => disposeMousePositionTracker())

  const currentComponentHover = kiru.signal<null | {
    elements: Set<Element>
    component: Kiru.VNode
  }>(null)

  const updateCurrentComponentHover = () => {
    const { x, y } = mousePos.value
    if (!selectorEnabled.value) return

    const [_, element] = document.elementsFromPoint(x, y)
    currentComponentHover.value = element
      ? findElementNearestComponent(element)
      : null
  }

  kiru.effect(() => updateCurrentComponentHover())

  const handleClick = (e: Kiru.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    if (!selectorEnabled.value || !currentComponentHover.value) return
    devtoolsState.componentSelection.value = {
      enabled: false,
      componentNode: currentComponentHover.value.component,
    }
    openDevtoolsView()
  }

  window.addEventListener("resize", updateCurrentComponentHover)
  kiru.onCleanup(() => {
    window.removeEventListener("resize", updateCurrentComponentHover)
  })

  return () => {
    const enabled = selectorEnabled.value,
      component = currentComponentHover.value
    if (!enabled || !component) return null

    const name = getNodeName(component.component)

    let minLeft = Infinity,
      minTop = Infinity,
      maxRight = -Infinity,
      maxBottom = -Infinity

    for (const element of component.elements) {
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
    return (
      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          top: minTop + "px",
          left: minLeft + "px",
          width: width + "px",
          height: height + "px",
          transform: `translate(${minLeft}px, ${top}px)`,
          cursor: "pointer",
        }}
        children={name}
        onclick={handleClick}
        className="flex items-center justify-center bg-crimson/[69%] text-white"
      />
    )
  }
}

interface ComponentSearchResult {
  elements: Set<Element>
  component: Kiru.VNode
}

function findElementNearestComponent(
  el: Element
): ComponentSearchResult | null {
  if (!el.__kiruNode) return null

  // find the nearest component
  let component: Kiru.VNode | null = null
  let n: Kiru.VNode | null = el.__kiruNode
  while (n) {
    if (typeof n.type === "function") {
      component = n
      break
    }
    n = n.parent
  }
  if (!component) return null

  // traverse & collect all of the first-of-branch elements
  const elements = collectDomNodes(component.child!)

  return { elements, component }
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

function openDevtoolsView() {
  devtoolsState.devtoolsTab.value = "Apps"
  if (devtoolsState.popupWindow.value) {
    devtoolsState.popupWindow.value.focus()
    return
  }

  isOverlayShown.value = true
}
