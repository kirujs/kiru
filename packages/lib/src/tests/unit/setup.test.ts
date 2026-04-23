import { describe, it } from "node:test"
import assert from "node:assert"
import { createKiruNode } from "../../ownerNode.js"
import { node } from "../../globals.js"
import { setup } from "../../hooks/setup.js"
import { createOwnerId } from "../../utils/node.js"

describe("setup", () => {
  it("returns a cached setup per owner node and keeps derived signals in sync with props", () => {
    const n = createKiruNode("div", null, { count: 1 })
    node.current = n

    const first = setup<{ count: number }>()
    const second = setup<{ count: number }>()

    assert.strictEqual(first, second, "setup should be cached per owner node")

    const { derive } = first
    const count = derive((props) => props.count * 2)

    assert.strictEqual(
      count.value,
      2,
      "derived signal should use initial props"
    )

    const propSyncs = n.propSyncs as ((props: { count: number }) => void)[]
    assert.ok(
      Array.isArray(propSyncs) && propSyncs.length > 0,
      "propSyncs should be registered on the owner node"
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

  it("exposes an id signal that updates when the owner index changes", () => {
    const parent = createKiruNode("div")
    const n = createKiruNode("span", parent, { value: 1 }, null, 0)
    node.current = n

    const { id } = setup<{ value: number }>()

    const initialId = id.value
    assert.strictEqual(
      initialId,
      createOwnerId(n),
      "initial id should be derived from the current owner node"
    )

    n.index = n.index + 1

    const propSyncs = n.propSyncs as Array<() => void>
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
      "id signal should update when the owner index changes"
    )
    assert.strictEqual(
      id.value,
      createOwnerId(n),
      "updated id should reflect the new owner position"
    )

    node.current = null
  })
})
