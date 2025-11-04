import { createElement } from "../element.js"

export { useFileRouter, type FileRouterContextType } from "./context.js"
export * from "./errors.js"
export { FileRouter, type FileRouterProps } from "./fileRouter.js"
export * from "./link.js"
export * from "./pageConfig.js"
export type * from "./types.js"

import { Content, Outlet } from "./head.js"

export const Head = {
  Content,
  Outlet,
}

export const Body = {
  Outlet: function BodyOutlet() {
    return createElement("kiru-body-outlet")
  },
}
