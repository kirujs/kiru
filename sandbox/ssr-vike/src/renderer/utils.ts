// /pages/utils.js
// Environment: server & client

import type { PageContext } from "vike/types"

export { getTitle }

function getTitle(pageContext: PageContext) {
  // The value exported by /pages/**/+title.js is available at pageContext.config.title
  const val = pageContext.config.title
  if (typeof val === "function") {
    return val(pageContext)
  }
  return val || "Vite + Vike + TS + Kiru"
}
