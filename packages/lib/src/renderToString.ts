import { renderMode } from "./globals.js"
import { Fragment } from "./element.js"
import { __DEV__ } from "./env.js"
import { recursiveRender, RecursiveRenderContext } from "./recursiveRender.js"

export function renderToString(element: JSX.Element) {
  const prev = renderMode.current
  renderMode.current = "string"
  let result = ""
  const ctx: RecursiveRenderContext = {
    write(chunk) {
      result += chunk
    },
  }
  recursiveRender(ctx, Fragment({ children: element }), null, 0)
  renderMode.current = prev
  return result
}
