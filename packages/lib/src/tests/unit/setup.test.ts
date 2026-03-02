import { describe, it } from "node:test"
import assert from "node:assert"
import { createVNode } from "../../vNode.js"
import { node } from "../../globals.js"
import { setup } from "../../hooks/setup.js"
import { createVNodeId } from "../../utils/vdom.js"

describe("setup", () => {
  it("returns a cached setup per vNode and keeps derived signals in sync with props", () => {
    const vNode: any = createVNode("div", null, { count: 1 })
    node.current = vNode

    const first = setup<{ count: number }>()
    const second = setup<{ count: number }>()

    assert.strictEqual(first, second, "setup should be cached per vNode")

    const { derive } = first
    const count = derive((props) => props.count * 2)

    assert.strictEqual(count.value, 2, "derived signal should use initial props")

    const propSyncs = vNode.propSyncs as ((props: { count: number }) => void)[]
    assert.ok(
      Array.isArray(propSyncs) && propSyncs.length > 0,
      "propSyncs should be registered on the vNode"
    )

    const nextProps = { count: 5 }
    for (const sync of propSyncs) {
      sync(nextProps)
    }

    assert.strictEqual(
      count.value,
      10,
      "derived signal should update when propSyncs are invoked"
    )

    node.current = null
  })

  it("exposes an id signal that updates when the vNode index changes", () => {
    const parent = createVNode("div")
    const vNode: any = createVNode("span", parent, { value: 1 }, null, 0)
    node.current = vNode

    const { id } = setup<{ value: number }>()

    const initialId = id.value
    assert.strictEqual(
      initialId,
      createVNodeId(vNode),
      "initial id should be derived from the current vNode"
    )

    vNode.prev = { props: vNode.props, key: vNode.key, index: vNode.index }
    vNode.index = vNode.index + 1

    const propSyncs = vNode.propSyncs as Array<() => void>
    assert.ok(
      Array.isArray(propSyncs) && propSyncs.length > 0,
      "propSyncs should contain the id sync callback"
    )

    for (const sync of propSyncs) {
      sync()
    }

    assert.notStrictEqual(
      id.value,
      initialId,
      "id signal should update when the vNode index changes"
    )
    assert.strictEqual(
      id.value,
      createVNodeId(vNode),
      "updated id should reflect the new vNode position"
    )

    node.current = null
  })
})

