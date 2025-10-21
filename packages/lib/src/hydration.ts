import type { MaybeDom, SomeDom } from "./types.utils"

export const hydrationStack = {
  parentStack: [] as Array<SomeDom>,
  childIdxStack: [] as Array<number>,
  eventDeferrals: new Map<Element, Array<() => void>>(),
  parent: function () {
    return this.parentStack[this.parentStack.length - 1]
  },
  clear: function () {
    this.parentStack.length = 0
    this.childIdxStack.length = 0
  },
  pop: function () {
    this.parentStack.pop()
    this.childIdxStack.pop()
  },
  push: function (el: SomeDom) {
    this.parentStack.push(el)
    this.childIdxStack.push(0)
  },
  currentChild: function () {
    return this.parentStack[this.parentStack.length - 1].childNodes[
      this.childIdxStack[this.childIdxStack.length - 1]
    ]
  },
  nextChild: function () {
    return this.parentStack[this.parentStack.length - 1].childNodes[
      this.childIdxStack[this.childIdxStack.length - 1]++
    ] as MaybeDom
  },
  bumpChildIndex: function () {
    this.childIdxStack[this.childIdxStack.length - 1]++
  },
  captureEvents: function (element: Element) {
    toggleEvtListeners(element, true)
    this.eventDeferrals.set(element, [])
  },
  resetEvents: function (element: Element) {
    this.eventDeferrals.delete(element)
  },
  releaseEvents: function (element: Element) {
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
