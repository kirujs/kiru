import * as kiru from "kiru"
import { devtoolsState, getNodeName } from "devtools-shared"
const { componentSelection } = devtoolsState

const selectorEnabled = kiru.computed(() => componentSelection.value.enabled)

export function ComponentSelectorOverlay() {
  const [mousePos, disposeMousePositionTracker] = createMousePositionTracker()

  kiru.onCleanup(() => disposeMousePositionTracker())

  const currentComponent = kiru.signal<null | {
    elements: Set<Element>
    component: Kiru.VNode
  }>(null)

  const updateCurrentComponent = () => {
    const { x, y } = mousePos.value
    if (!selectorEnabled.value) return

    const element = document.elementFromPoint(x, y)
    currentComponent.value = element
      ? findElementNearestComponent(element)
      : null
  }

  kiru.effect(() => updateCurrentComponent())

  window.addEventListener("resize", updateCurrentComponent)
  kiru.onCleanup(() =>
    window.removeEventListener("resize", updateCurrentComponent)
  )

  return () => {
    const enabled = selectorEnabled.value,
      component = currentComponent.value
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
          pointerEvents: "none",
          transform: `translate(${minLeft}px, ${top}px)`,
        }}
        children={name}
        className="flex items-center justify-center bg-crimson/[69%] text-white"
      />
    )
  }
}

function createMousePositionTracker() {
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
