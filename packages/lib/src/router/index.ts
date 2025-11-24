import { createElement } from "../element.js"
import { __DEV__ } from "../env.js"

export {
  useRequestContext,
  useFileRouter,
  type FileRouterContextType,
} from "./context.js"
export * from "./errors.js"
export { FileRouter, type FileRouterProps } from "./fileRouter.js"
export * from "./link.js"
export * from "./pageConfig.js"
export type * from "./types.js"

import { HeadContent, HeadOutlet } from "./head.js"

export const Head = {
  /**
 * - During SSG, renders content to the document head via a corresponding `<Head.Outlet>` component placed in your `document.tsx`.
 * - During CSR, updates document title.
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
  Content: HeadContent,
  /**
 * Used with SSG. Renders content to the document head from a `<Head>` component in the currently rendered page.
 * @example
 * // src/pages/document.tsx
 * export default function Document() {
 *   return (
 *     <html lang="en">
 *       <head>
 *         <meta charset="utf-8" />
 *         <meta name="viewport" content="width=device-width, initial-scale=1" />
 *         <Head.Outlet />
 *       </head>
 *       <Body.Outlet />
 *     </html>
 *   )
 }
 */
  Outlet: HeadOutlet,
}

export const Body = {
  /**
   * Used with SSG 'document' files. Renders content to the document body via a corresponding `<Body.Outlet>` component placed in your `document.tsx`.
   * @example
   * // src/pages/document.tsx
   * export default function Document() {
   *   return (
   *     <html lang="en">
   *       <head>
   *         <meta charset="utf-8" />
   *         <meta name="viewport" content="width=device-width, initial-scale=1" />
   *         <Head.Outlet />
   *       </head>
   *       <Body.Outlet />
   *     </html>
   *   )
   }
   */
  Outlet: BodyOutlet,
}

function BodyOutlet() {
  return createElement("kiru-body-outlet")
}

if (__DEV__) {
  ;(Head.Content as Kiru.FC).displayName = "Kiru.Head.Content"
  ;(Head.Outlet as Kiru.FC).displayName = "Kiru.Head.Outlet"
  ;(Body.Outlet as Kiru.FC).displayName = "Kiru.Body.Outlet"
}
