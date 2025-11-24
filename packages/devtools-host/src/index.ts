import { createElement, mount } from "kiru"
import { getVNodeAppContext } from "kiru/utils"
import App from "./App"
// @ts-expect-error
import tailwindCssKiruDevToolCssInline from "inline:./style.css"
import { popup } from "./store"
import { broadcastChannel, assert } from "devtools-shared"

if ("window" in globalThis) {
  function init() {
    const pageRoot = document.createElement("kiru-devtools")
    pageRoot.setAttribute("style", "display: contents")
    document.body.appendChild(pageRoot)

    const shadow = pageRoot.attachShadow({ mode: "open" })
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(tailwindCssKiruDevToolCssInline)
    shadow.adoptedStyleSheets = [sheet]

    const appRoot = Object.assign(document.createElement("div"), {
      id: "devtools-root",
      className: "fixed flex bottom-0 right-0 z-[9999999]",
    })
    shadow.appendChild(appRoot)

    mount(createElement(App, {}), appRoot, {
      name: "kiru.devtools",
    })
    const handleMainWindowClose = () => popup.value?.close()
    window.addEventListener("close", handleMainWindowClose)
    window.addEventListener("beforeunload", handleMainWindowClose)

    broadcastChannel.addEventListener((msg) => {
      switch (msg.data.type) {
        case "update-node": {
          const n = window.__devtoolsNodeUpdatePtr
          assert(n, "failed to get node ptr")

          const app = getVNodeAppContext(n)
          assert(app, "failed to get app context")

          const s = window.__kiru.getSchedulerInterface!(app)
          assert(s, "failed to get scheduler interface")

          s.requestUpdate(n)
          window.__devtoolsNodeUpdatePtr = null
          break
        }
        case "open-editor": {
          window.open(msg.data.fileLink)
          break
        }
      }
    })
  }

  window.addEventListener("kiru:ready", init, { once: true })
}
