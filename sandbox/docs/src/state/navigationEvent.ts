import { signal } from "kiru"

export const navEvent = signal(false)

if ("window" in globalThis) {
  window.addEventListener("popstate", () => {
    navEvent.value = true
    requestAnimationFrame(() => (navEvent.value = false))
  })
}
