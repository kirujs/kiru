import "./index.css"
import { mount } from "kiru"
import { App } from "./App"
import { broadcastChannel } from "devtools-shared"

mount(<App />, document.getElementById("app")!)

broadcastChannel.send({ type: "ready" })
setInterval(() => {
  if (!window.opener) {
    window.close()
  }
}, 250)
