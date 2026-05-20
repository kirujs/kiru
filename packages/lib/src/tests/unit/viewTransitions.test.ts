import assert from "node:assert/strict"
import { describe, it, afterEach } from "node:test"
import { ViewTransitions } from "../../viewTransitions.js"

describe("ViewTransitions", () => {
  const prevDocument = globalThis.document

  afterEach(() => {
    ViewTransitions.stop()
    if (prevDocument === undefined) {
      // @ts-expect-error restore
      delete globalThis.document
    } else {
      globalThis.document = prevDocument
    }
  })

  it("runs callback directly when startViewTransition is unavailable", async () => {
    // @ts-expect-error no document in node
    delete globalThis.document
    let ran = false
    await ViewTransitions.run(() => {
      ran = true
    })
    assert.equal(ran, true)
  })

  it("uses document.startViewTransition when supported", async () => {
    let transitionStarted = false
    const finished = Promise.withResolvers<void>()
    globalThis.document = {
      startViewTransition(fn: () => void | Promise<void>) {
        transitionStarted = true
        void Promise.resolve(fn()).then(() => finished.resolve())
        return {
          finished: finished.promise,
          ready: finished.promise,
          updateCallbackDone: finished.promise,
          types: new Set(),
          skipTransition() {},
        }
      },
    } as Document
    let callbackRan = false
    await ViewTransitions.run(() => {
      callbackRan = true
    })
    assert.equal(transitionStarted, true)
    assert.equal(callbackRan, true)
  })

  it("queues multiple run calls through one transition", async () => {
    let runCount = 0
    const finished = Promise.withResolvers<void>()
    globalThis.document = {
      startViewTransition(fn: () => void | Promise<void>) {
        void Promise.resolve(fn()).then(() => finished.resolve())
        return {
          finished: finished.promise,
          ready: finished.promise,
          updateCallbackDone: finished.promise,
          types: new Set(),
          skipTransition() {},
        }
      },
    } as Document
    await Promise.all([
      ViewTransitions.run(() => {
        runCount += 1
      }),
      ViewTransitions.run(() => {
        runCount += 1
      }),
    ])
    assert.equal(runCount, 2)
  })
})
