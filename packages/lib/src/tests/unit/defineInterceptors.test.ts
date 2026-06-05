import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { defineInterceptors } from "../../router/defineInterceptors.js"

describe("defineInterceptors", () => {
  it("returns handles with slot and path metadata", () => {
    const interceptors = defineInterceptors({
      photo: {
        path: "/photos/[id]",
        render: () => null as unknown as JSX.Element,
      },
      user: {
        path: "/users/[id]",
        render: () => null as unknown as JSX.Element,
      },
    })
    assert.equal(interceptors.photo.slot, "photo")
    assert.equal(interceptors.photo.path, "/photos/[id]")
    assert.equal(interceptors.user.slot, "user")
    assert.equal(interceptors.user.path, "/users/[id]")
    assert.equal(typeof interceptors.photo.Outlet, "function")
    assert.equal(typeof interceptors.photo.restore, "function")
  })
})
