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

    const appRoot = Object.assign(document.createElement("div"), {
      id: "devtools-root",
      className: "fixed flex top-0 left-0 w-0 h-0 z-[9999999]",
    })
    shadow.appendChild(appRoot)

    kiru.mount(kiru.createElement(App), appRoot, {
      name: "kiru.devtools",
    })
    const handleMainWindowClose = () => devtoolsState.popupWindow.value?.close()
    window.addEventListener("close", handleMainWindowClose)
    window.addEventListener("beforeunload", handleMainWindowClose)

    devtoolsEvents.on("open-editor", (fileLink) => window.open(fileLink))
  }

  window.addEventListener("kiru:ready", init, { once: true })
}
