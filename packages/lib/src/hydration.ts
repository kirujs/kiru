import type { MaybeDom, SomeDom } from "./types.utils"

export const hydrationStack = {
  parentStack: [] as Array<SomeDom>,
  childIdxStack: [] as Array<number>,
  eventDeferrals: new Map<Element, Array<() => void>>(),
  parent() {
    return this.parentStack[this.parentStack.length - 1]
  },
  clear() {
    this.parentStack.length = 0
    this.childIdxStack.length = 0
  },
  pop() {
    this.parentStack.pop()
    this.childIdxStack.pop()
  },
  push(el: SomeDom) {
    this.parentStack.push(el)
    this.childIdxStack.push(0)
  },
  currentChild(): MaybeDom {
    return this.parentStack[this.parentStack.length - 1].childNodes[
      this.childIdxStack[this.childIdxStack.length - 1]
    ] as MaybeDom
  },
  bumpChildIndex() {
    this.childIdxStack[this.childIdxStack.length - 1]++
  },
  captureEvents(element: Element) {
    toggleEvtListeners(element, true)
    this.eventDeferrals.set(element, [])
  },
  resetEvents(element: Element) {
    this.eventDeferrals.delete(element)
  },
  releaseEvents(element: Element) {
    toggleEvtListeners(element, false)
    const events = this.eventDeferrals.get(element)
    while (events?.length) events.shift()!()
  },
}

const captureEvent = (e: Event) => {
  const t = e.target
  if (!e.isTrusted || !t) return
  hydrationStack.eventDeferrals
    .get(t as Element)
    ?.push(() => t.dispatchEvent(e))
}
const toggleEvtListeners = (element: Element, value: boolean) => {
  for (const key in element) {
    if (key.startsWith("on")) {
      const eventType = key.substring(2)
      element[value ? "addEventListener" : "removeEventListener"](
        eventType,
        captureEvent,
        { passive: true }
      )
    }
  }
}
