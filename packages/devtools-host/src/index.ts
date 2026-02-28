// @ts-expect-error
import tailwindInlineCss from "inline:./style.css"

if ("window" in globalThis) {
  async function init() {
    const kiru = await import("kiru")
    const { default: App } = await import("./app")

    const { devtoolsState } = await import("devtools-shared")
    const pageRoot = document.createElement("kiru-devtools")
    pageRoot.setAttribute("style", "display: contents")
    pageRoot.tabIndex = -1
    document.body.appendChild(pageRoot)

    const shadow = pageRoot.attachShadow({
      mode: "open",
      delegatesFocus: true,
    })
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(tailwindInlineCss)
    shadow.adoptedStyleSheets = [sheet]

    kiru.mount(kiru.createElement(App), shadow, {
      name: "kiru.devtools",
    })
    const handleMainWindowClose = () => devtoolsState.popupWindow.value?.close()
    window.addEventListener("close", handleMainWindowClose)
    window.addEventListener("beforeunload", handleMainWindowClose)
  }

  window.addEventListener("kiru:ready", init, { once: true })
}
