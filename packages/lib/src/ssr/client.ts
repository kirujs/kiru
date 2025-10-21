import type { AppContext, AppContextOptions } from "../appContext"
import { hydrationStack } from "../hydration.js"
import { renderMode } from "../globals.js"
import { mount } from "../index.js"

export function hydrate(
  children: JSX.Element,
  container: HTMLElement,
  options?: AppContextOptions
): AppContext {
  hydrationStack.clear()

  const prevRenderMode = renderMode.current
  renderMode.current = "hydrate"
  hydrationStack.captureEvents(container)

  const app = mount(children, container, options)

  renderMode.current = prevRenderMode
  hydrationStack.releaseEvents(container)

  return app
}
