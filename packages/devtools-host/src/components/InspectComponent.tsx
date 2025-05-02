import * as kaioken from "kaioken"
import { useEffect, useMemo, useRef } from "kaioken"
import { getComponentVnodeFromElement, getNearestElm } from "../utils"
import { vNodeContains } from "../../../lib/dist/utils.js"
import { toggleElementToVnode, popup } from "../store"
import { useDevTools } from "../hooks/useDevtools"
import {
  broadcastChannel,
  useElementBounding,
  useElementByPoint,
  useEventListener,
  useMouse,
} from "devtools-shared"

export const InspectComponent: Kaioken.FC = () => {
  const openDevTools = useDevTools()
  const { mouse } = useMouse()

  const controls = useElementByPoint({
    x: mouse.value.x,
    y: mouse.value.y,
    immediate: false,
  })
  const element = toggleElementToVnode.value ? controls.element.value : null

  const elApp = useMemo(() => {
    if (element && window.__kaioken) {
      const app = window.__kaioken.apps.find(($app) => {
        if ($app.rootNode == null || element.__kaiokenNode == null) return false
        return vNodeContains($app.rootNode, element.__kaiokenNode)
      })

      if (app?.rootNode == null) return null
      return app
    }

    return null
  }, [element])

  const vnode = useMemo(() => {
    if (element) {
      return getComponentVnodeFromElement(element)
    }

    return null
  }, [element])

  const boundingRef = useRef<Element | null>(null)
  const bounding = useElementBounding(boundingRef)

  useEffect(() => {
    const unsub = toggleElementToVnode.subscribe((toggled) => {
      controls[toggled ? "start" : "stop"]()
    })
    return unsub
  }, [])

  useEffect(() => {
    if (vnode && element) {
      boundingRef.current = getNearestElm(vnode, element) ?? null
    } else {
      boundingRef.current = null
    }
  }, [vnode, element])

  useEventListener("click", (e) => {
    if (toggleElementToVnode.value === true && vnode && elApp) {
      e.preventDefault()
      const emitSelectNode = (w: Window) => {
        w.__devtoolsSelection = { node: vnode, app: elApp }
        broadcastChannel.send({ type: "select-node" })
        broadcastChannel.send({
          type: "set-inspect-enabled",
          value: false,
        })
        toggleElementToVnode.value = false
        boundingRef.current = null
        w.focus()
      }

      if (!popup.value) {
        openDevTools().then((w) => emitSelectNode(w))
      } else {
        emitSelectNode(popup.value)
      }
    }
  })

  return (
    vnode && (
      <div
        className="bg-[crimson]/80 fixed grid place-content-center pointer-events-none z-10 top-0 left-0"
        style={{
          width: `${bounding?.width}px`,
          height: `${bounding?.height}px`,
          transform: `translate(${bounding.x}px, ${bounding.y}px)`,
        }}
      >
        <p>{vnode.type.name}</p>
      </div>
    )
  )
}
