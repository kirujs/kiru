import { useKeyStroke } from "devtools-shared"
import { useRef } from "kiru"
import { inspectComponent, keyboardMap, selectedNode } from "../state"

export const useKeyboardControls = () => {
  const searchRef = useRef<HTMLInputElement>(null)

  const getMetaDataFromNode = (domNode: Element | null) => {
    if (!domNode) return null

    const id = domNode.getAttribute("data-id")
    if (id == null) return
    return keyboardMap.peek().get(id)
  }

  const setActiveFromDom = (domNode: Element | null) => {
    if (!domNode) return

    const metaData = getMetaDataFromNode(domNode)
    if (metaData == null) return

    domNode.scrollIntoView({
      behavior: "smooth",
    })
    selectedNode.value = metaData.vNode as any
  }

  const findNextSibling = (domNode: Element | null) => {
    if (!domNode || domNode === document.body) return null

    const parentEl = domNode.parentElement
    const potentialSibling =
      parentEl?.nextElementSibling?.querySelector("h2[data-id]")
    if (potentialSibling) return potentialSibling
    return findNextSibling(parentEl)
  }

  const activeFirstDom = () => {
    const first = document.querySelector("h2[data-id]")
    setActiveFromDom(first)
  }

  const activeLastDom = () => {
    const allH2 = document.querySelectorAll("h2[data-id]")
    const last = allH2.item(allH2.length - 1)
    if (last) {
      setActiveFromDom(last)
    }
  }

  useKeyStroke(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"], (e) => {
    if (inspectComponent.value) inspectComponent.value = null
    if (
      document.activeElement &&
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement != searchRef.current
    ) {
      return
    }

    e.preventDefault()
    const selectedDomNode = document.querySelector(".selected-vnode")
    if (selectedDomNode === null) {
      if (e.key === "ArrowDown") {
        activeFirstDom()
      } else if (e.key === "ArrowUp") {
        activeLastDom()
      }

      return
    }

    if (e.key === "ArrowRight") {
      const meta = getMetaDataFromNode(selectedDomNode)
      if (meta) {
        meta.setCollapsed(false)
      }
      return
    } else if (e.key === "ArrowLeft") {
      const meta = getMetaDataFromNode(selectedDomNode)
      if (meta) {
        meta.setCollapsed(true)
      }
      return
    }

    if (e.key === "ArrowDown") {
      const directChild =
        selectedDomNode?.nextElementSibling?.querySelector("h2[data-id]")
      if (directChild) {
        return setActiveFromDom(directChild)
      }

      const directSibling =
        selectedDomNode.parentElement?.nextElementSibling?.querySelector(
          "h2[data-id]"
        )
      if (directSibling) {
        return setActiveFromDom(directSibling)
      }

      const sibling = findNextSibling(selectedDomNode)
      if (sibling) {
        return setActiveFromDom(sibling)
      }

      return activeFirstDom()
    } else if (e.key === "ArrowUp") {
      const parentPrevSibling =
        selectedDomNode.parentElement?.previousElementSibling
      if (parentPrevSibling?.matches("h2[data-id]")) {
        return setActiveFromDom(parentPrevSibling)
      }

      const deepestParentSibling =
        parentPrevSibling?.querySelectorAll("h2[data-id]")
      if (
        deepestParentSibling?.length != null &&
        deepestParentSibling?.length >= 1
      ) {
        return setActiveFromDom(
          deepestParentSibling?.item?.(deepestParentSibling.length - 1)
        )
      }

      return activeLastDom()
    }
  })

  useKeyStroke("l", (e) => {
    if (e.ctrlKey) {
      e.preventDefault()
      searchRef.current?.focus({
        preventScroll: false,
      })
    }
  })

  return {
    searchRef,
  }
}
