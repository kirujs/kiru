import * as kiru from "kiru"
import App from "./app"
// @ts-expect-error
import tailwindInlineCss from "inline:./style.css"
import { devtoolsEvents, devtoolsState } from "devtools-shared"

if ("window" in globalThis) {
  function init() {
    const pageRoot = document.createElement("kiru-devtools")
    pageRoot.setAttribute("style", "display: contents")
    document.body.appendChild(pageRoot)

    const shadow = pageRoot.attachShadow({ mode: "open" })
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(tailwindInlineCss)
    shadow.adoptedStyleSheets = [sheet]

    kiru.mount(kiru.createElement(App), shadow, {
      name: "kiru.devtools",
    })
    const handleMainWindowClose = () => devtoolsState.popupWindow.value?.close()
    window.addEventListener("close", handleMainWindowClose)
    window.addEventListener("beforeunload", handleMainWindowClose)

    devtoolsEvents.on("open-editor", (fileLink) => window.open(fileLink))
  }

  window.addEventListener("kiru:ready", init, { once: true })
}
