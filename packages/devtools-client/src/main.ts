import "./index.css"
import { mount } from "kaioken"
import { App } from "./App"
import { broadcastChannel } from "devtools-shared"

mount(App, document.getElementById("app")!).then(() => {
  broadcastChannel.send({ type: "ready" })
})
