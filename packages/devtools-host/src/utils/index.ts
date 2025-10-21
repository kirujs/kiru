import { isFragment } from "kiru/utils"
import { DEFAULT_ANCHOR_POS, PADDING } from "./constants"
import { Storage } from "./types"
import { useElementBounding } from "devtools-shared"

export const reinitializeAnchorPos = (
  storage: Storage,
  viewPortRef: Kiru.RefObject<HTMLElement>,
  elementBound: ReturnType<typeof useElementBounding>
) => {
  if (!viewPortRef.current) return { ...DEFAULT_ANCHOR_POS }

  const rateInWidthChange = window.innerWidth / storage.width
  const rateInHeightChange = window.innerHeight / storage.height

  let forceX: number | null = null
  let forceY: number | null = null
  if (storage.snapSide === "left") {
    forceX =
      (viewPortRef.current.offsetWidth - elementBound.width.value) * -1 +
      PADDING
  } else if (storage.snapSide === "right") {
    forceX = -PADDING
  } else if (storage.snapSide === "bottom") {
    forceY = -PADDING
  } else if (storage.snapSide === "top") {
    forceY = (window.innerHeight - elementBound.height.value) * -1 + PADDING
  }

  return {
    x: forceX ?? storage.x * rateInWidthChange,
    y: forceY ?? storage.y * rateInHeightChange,
  }
}

export const getComponentVnodeFromElement = (domNode: Element | null) => {
  if (domNode == null) return null

  let parentComponent: Kiru.VNode | null = null
  let parent = domNode?.__kiruNode?.parent
  while (parent) {
    if (typeof parent.type === "function" && !isFragment(parent)) {
      parentComponent = parent
      break
    }

    parent = parent.parent
  }

  return parentComponent as Kiru.VNode & { type: Function }
}

export const getNearestElm = (
  vNode: Kiru.VNode,
  element: HTMLElement
): Element | undefined => {
  const elementvNodeTreeUptillComponetVnode: Kiru.VNode[] = []
  const stack = [element.__kiruNode!]
  while (stack.length) {
    const node = stack.pop()
    if (node === vNode) {
      break
    }

    if (node?.dom) {
      elementvNodeTreeUptillComponetVnode.push(node)
    }

    if (node?.parent) stack.push(node.parent)
  }
  if (elementvNodeTreeUptillComponetVnode.length === 0) return undefined
  const dom =
    elementvNodeTreeUptillComponetVnode[
      elementvNodeTreeUptillComponetVnode.length - 1
    ]!.dom
  return dom instanceof Element ? dom : undefined
}
