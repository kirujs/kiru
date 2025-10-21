// https://vike.dev/onRenderClient
import type { PageContextClient } from "vike/types"
import { hydrate } from "kiru/ssr/client"
import type { AppContext } from "kiru"
import { getTitle } from "./utils"
import { App } from "./App"

declare global {
  interface Window {
    __appContext?: AppContext
  }
}

export const onRenderClient = (pageContext: PageContextClient) => {
  const container = document.getElementById("page-root")!

  if (pageContext.isHydration || !window.__appContext) {
    window.__appContext = hydrate(<App pageContext={pageContext} />, container)
    return
  }

  document.title = getTitle(pageContext)
  window.__appContext.render(<App pageContext={pageContext} />)
}
