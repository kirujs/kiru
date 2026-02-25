import { renderMode } from "./globals.js"
import { Fragment } from "./element.js"
import { headlessRender, HeadlessRenderContext } from "./headlessRender.js"

export function renderToString(element: JSX.Element) {
  const prev = renderMode.current
  renderMode.current = "string"
  let result = ""
  const ctx: HeadlessRenderContext = {
    write(chunk) {
      result += chunk
    },
  }
  headlessRender(ctx, Fragment({ children: element }), null, 0)
  renderMode.current = prev
  return result
}
