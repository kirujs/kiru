import { describe, it } from "node:test"
import assert from "node:assert"
import {
  createOwner,
  disposeOwner,
  getCurrentOwner,
  registerOwnerCleanup,
  runWithOwner,
} from "../../../domRuntime/owner.js"

describe("domRuntime/owner", () => {
  it("runWithOwner restores previous owner", () => {
    const root = createOwner(null)
    const child = createOwner(root)
    runWithOwner(root, () => {
      runWithOwner(child, () => {
        const nested = createOwner(getCurrentOwner())
        assert.strictEqual(nested.parent, child)
      })
    })
  })

  it("disposeOwner runs cleanups depth-first on children", () => {
    const order: string[] = []
    const root = createOwner(null)
    const child = createOwner(root)
    registerOwnerCleanup(root, "root", () => order.push("root"))
    registerOwnerCleanup(child, "child", () => order.push("child"))

    disposeOwner(root)

    assert.deepStrictEqual(order, ["child", "root"])
    assert.strictEqual(root.disposed, true)
    assert.strictEqual(child.disposed, true)
    assert.strictEqual(root.children.size, 0)
  })

  it("disposeOwner is idempotent", () => {
    const root = createOwner(null)
    let runs = 0
    registerOwnerCleanup(root, "a", () => {
      runs++
    })
    disposeOwner(root)
    disposeOwner(root)
    assert.strictEqual(runs, 1)
  })
})
