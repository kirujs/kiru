import type { AppHandle, AppHandleOptions } from "../appContext"
import { hydrationStack } from "../hydration.js"
import { hydrationMode, renderMode } from "../globals.js"
import { mount } from "../index.js"

interface HydrationAppContextOptions extends AppHandleOptions {
  /**
   * Configures the hydration mode
   * - "static": SSG
   * - "dynamic": SSR with lazy promise hydration
   * @default "dynamic"
   */
  hydrationMode?: "static" | "dynamic"
}

export function hydrate(
  children: JSX.Element,
  container: HTMLElement,
  options?: HydrationAppContextOptions
): AppHandle {
  hydrationStack.clear()

  const prevRenderMode = renderMode.current
  renderMode.current = "hydrate"

  const prevHydrationMode = hydrationMode.current
  hydrationMode.current = options?.hydrationMode ?? "dynamic"

  const app = mount(children, container, options)

  renderMode.current = prevRenderMode
  hydrationMode.current = prevHydrationMode

  return app
}
