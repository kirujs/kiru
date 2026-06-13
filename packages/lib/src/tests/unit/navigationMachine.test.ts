import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canAcceptOutletSettled,
  createInitialMachineState,
  interceptStateFromPhase,
  isNavigatingPhase,
  transition,
  type InterceptPayload,
  type RouterMachineState,
} from "../../router/navigationMachine.js"
import type { RouteLocationSnapshot, RouteMatch } from "../../router/types.js"

const snap = (
  pathname: string,
  params: Record<string, string> = {}
): RouteLocationSnapshot => ({
  pathname,
  params,
  query: {},
  hash: "",
})

const fakeMatch = (id: string, pathname: string): RouteMatch =>
  ({
    route: { id, path: pathname },
    pathname,
    params: {},
  }) as RouteMatch

const interceptPayload = (): InterceptPayload => ({
  id: 2,
  registrationId: 1,
  background: fakeMatch("bg", "/home"),
  target: fakeMatch("tgt", "/post/1"),
})

function apply(
  state: RouterMachineState,
  event: Parameters<typeof transition>[1]
) {
  return transition(state, event).state
}

describe("navigationMachine", () => {
  it("starts idle", () => {
    const s = createInitialMachineState()
    assert.equal(s.phase.kind, "idle")
    assert.equal(s.generation, 0)
  })

  it("happy path: idle → validating → committing → awaitingOutlet → idle", () => {
    let s = createInitialMachineState()
    s = apply(s, {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/b"),
      from: snap("/a"),
    })
    assert.equal(s.phase.kind, "navigating")
    if (s.phase.kind === "navigating") assert.equal(s.phase.sub, "validating")

    s = apply(s, { type: "VALIDATION_OK", commitKind: "hard" })
    if (s.phase.kind === "navigating") assert.equal(s.phase.sub, "committing")

    s = apply(s, { type: "COMMIT_HARD" })
    if (s.phase.kind === "navigating") assert.equal(s.phase.sub, "awaitingOutlet")

    s = apply(s, { type: "OUTLET_SETTLED" })
    assert.equal(s.phase.kind, "idle")
  })

  it("cancels from validating → idle", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/b"),
      from: null,
    })
    s = apply(s, { type: "VALIDATION_CANCEL" })
    assert.equal(s.phase.kind, "idle")
  })

  it("redirect restarts validating with new id", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/a"),
      from: null,
    })
    s = apply(s, {
      type: "VALIDATION_REDIRECT",
      id: 2,
      intent: "replace",
      to: snap("/redirected"),
      from: snap("/a"),
    })
    assert.equal(s.generation, 2)
    if (s.phase.kind === "navigating") {
      assert.equal(s.phase.id, 2)
      assert.equal(s.phase.sub, "validating")
      assert.equal(s.phase.to.pathname, "/redirected")
    }
  })

  it("intercept commit → intercepted.loading", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/post/1"),
      from: snap("/"),
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "intercept" })
    s = apply(s, { type: "COMMIT_INTERCEPT", payload: interceptPayload() })
    assert.equal(s.phase.kind, "intercepted")
    if (s.phase.kind === "intercepted") assert.equal(s.phase.sub, "loading")
    assert.equal(isNavigatingPhase(s.phase), false)
  })

  it("intercept load done → ready", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/post/1"),
      from: snap("/"),
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "intercept" })
    s = apply(s, { type: "COMMIT_INTERCEPT", payload: interceptPayload() })
    s = apply(s, { type: "INTERCEPT_LOAD_DONE", data: { title: "x" } })
    if (s.phase.kind === "intercepted") {
      assert.equal(s.phase.sub, "ready")
      assert.deepEqual(s.phase.data, { title: "x" })
    }
  })

  it("hard nav from intercepted → validating", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/post/1"),
      from: snap("/"),
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "intercept" })
    s = apply(s, { type: "COMMIT_INTERCEPT", payload: interceptPayload() })
    s = apply(s, { type: "INTERCEPT_LOAD_DONE", data: {} })
    s = apply(s, {
      type: "NAV_REQUEST",
      id: 3,
      intent: "push",
      to: snap("/post/1"),
      from: snap("/"),
    })
    assert.equal(s.phase.kind, "navigating")
    if (s.phase.kind === "navigating") assert.equal(s.phase.sub, "validating")
  })

  it("dismiss intercept → idle", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/post/1"),
      from: snap("/"),
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "intercept" })
    s = apply(s, { type: "COMMIT_INTERCEPT", payload: interceptPayload() })
    s = apply(s, { type: "DISMISS_INTERCEPT" })
    assert.equal(s.phase.kind, "idle")
  })

  it("POPSTATE_NOOP clears stuck navigating", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "popstate",
      to: snap("/a"),
      from: snap("/b"),
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "hard" })
    s = apply(s, { type: "COMMIT_HARD" })
    s = apply(s, { type: "POPSTATE_NOOP" })
    assert.equal(s.phase.kind, "idle")
  })

  it("middleware error → awaitingOutlet", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/forbidden"),
      from: null,
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "error" })
    s = apply(s, { type: "COMMIT_ERROR" })
    if (s.phase.kind === "navigating") {
      assert.equal(s.phase.sub, "awaitingOutlet")
      assert.equal(s.phase.commitKind, "error")
    }
  })

  it("canAcceptOutletSettled guards pathname and params", () => {
    const phase = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/user/1", { id: "1" }),
      from: null,
    }).phase
    const awaiting = apply(
      { phase, generation: 1 },
      { type: "VALIDATION_OK", commitKind: "hard" }
    )
    const committed = apply(awaiting, { type: "COMMIT_HARD" }).phase
    assert.equal(
      canAcceptOutletSettled(committed, {
        pathname: "/user/1",
        matchParams: { id: "1" },
      }),
      true
    )
    assert.equal(
      canAcceptOutletSettled(committed, {
        pathname: "/user/2",
        matchParams: { id: "2" },
      }),
      false
    )
  })

  it("interceptStateFromPhase maps intercepted phase", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/post/1"),
      from: snap("/"),
    })
    s = apply(s, { type: "VALIDATION_OK", commitKind: "intercept" })
    s = apply(s, { type: "COMMIT_INTERCEPT", payload: interceptPayload() })
    const intercept = interceptStateFromPhase(s.phase)
    assert.ok(intercept)
    assert.equal(intercept!.registrationId, 1)
  })

  it("NAV_REQUEST supersedes prior navigating and bumps generation", () => {
    let s = apply(createInitialMachineState(), {
      type: "NAV_REQUEST",
      id: 1,
      intent: "push",
      to: snap("/a"),
      from: null,
    })
    const { state } = transition(s, {
      type: "NAV_REQUEST",
      id: 2,
      intent: "push",
      to: snap("/b"),
      from: snap("/a"),
    })
    assert.equal(state.generation, 2)
    if (state.phase.kind === "navigating") assert.equal(state.phase.id, 2)
  })
})
