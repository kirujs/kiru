import { createElement } from "../index.js"
import { Signal } from "../signals/base.js"
import { isValidTextChild, isVNode } from "../utils/index.js"

export { Content, Outlet }

/**
 * Used with SSG. Renders content to the document head via a corresponding `<Head.Outlet>` component placed in your `document.tsx`.
 * @example
 * // src/pages/index.tsx
 * export default function Index() {
 *   return (
 *     <div>
 *       <Head.Content>
 *         <title>My App - Home</title>
 *       </Head.Content>
 *       <h1>Home</h1>
 *     </div>
 *   )
 }
 */
function Content({ children }: { children: JSX.Children }) {
  if ("window" in globalThis) {
    ;(Array.isArray(children) ? children : [children])
      .filter(isVNode)
      .forEach(({ type, props }) => {
        switch (type) {
          case "title":
            const title = (
              Array.isArray(props.children) ? props.children : [props.children]
            )
              .map((c) => (Signal.isSignal(c) ? c.value : c))
              .filter(isValidTextChild)
              .join("")
            return (document.title = title)
          case "meta":
            return document
              .querySelector(`meta[name="${props.name}"]`)
              ?.setAttribute("content", String(props.content))
        }
      })
    return null
  }
  return createElement("kiru-head-content", { children })
}

/**
 * Used with SSG. Renders content to the document head from a `<Head>` component in the currently rendered page.
 * @example
 * // document.tsx
 * export default function Document() {
 *   return (
 *     <html lang="en">
 *       <head>
 *         <meta charset="utf-8" />
 *         <meta name="viewport" content="width=device-width, initial-scale=1" />
 *         <Head.Outlet />
 *       </head>
 *       <body>{children}</body>
 *     </html>
 *   )
 }
 */
function Outlet() {
  return createElement("kiru-head-outlet")
}
