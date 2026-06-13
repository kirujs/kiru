import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createInitialMachineState,
  transition,
  type MachineEvent,
  type RouterMachineState,
} from "../../router/navigationMachine.js"
import {
  createNavigationRunner,
  type WorkflowFactory,
} from "../../router/navigationRunner.js"
import type { NavigationStep } from "../../router/navigationWorkflow.js"
import type { NavigationResult } from "../../router/types.js"
import type { NavigateInternalOptions } from "../../router/navigation.js"

function applyEvent(
  machine: RouterMachineState,
  event: MachineEvent
): RouterMachineState {
  return transition(machine, event).state
}

function stepsWorkflow(
  steps: NavigationStep[],
  finalResult: NavigationResult = { status: "committed" }
): WorkflowFactory {
  return async function* () {
    for (const step of steps) {
      yield step
    }
    return finalResult
  }
}

describe("navigationRunner", () => {
  it("applies FSM events and returns committed before outlet settles", async () => {
    let machine = createInitialMachineState()
    const runner = createNavigationRunner({
      apply: (e) => {
        machine = applyEvent(machine, e)
      },
      transitionsEnabled: false,
      buildWorkflowDeps: () => ({}) as never,
      workflowFactory: stepsWorkflow([
        {
          kind: "event",
          event: {
            type: "NAV_REQUEST",
            id: 1,
            intent: "push",
            to: { pathname: "/b", params: {}, query: {}, hash: "" },
            from: null,
          },
        },
        { kind: "event", event: { type: "VALIDATION_OK", commitKind: "hard" } },
        { kind: "event", event: { type: "COMMIT_HARD" } },
        { kind: "awaitOutlet", result: { status: "committed" } },
      ]),
    })

    const result = await runner.start(new URL("http://x/b"), {
      replace: false,
      fromPopstate: false,
    })
    assert.equal(result.status, "committed")
    assert.equal(machine.phase.kind, "navigating")
    if (machine.phase.kind === "navigating") {
      assert.equal(machine.phase.sub, "awaitingOutlet")
    }
  })

  it("notifyOutletSettled applies OUTLET_SETTLED synchronously", async () => {
    let machine = createInitialMachineState()
    let completed = false

    const runner = createNavigationRunner({
      apply: (e) => {
        machine = applyEvent(machine, e)
      },
      transitionsEnabled: false,
      buildWorkflowDeps: () => ({}) as never,
      workflowFactory: async function* () {
        yield {
          kind: "event",
          event: {
            type: "NAV_REQUEST",
            id: 1,
            intent: "push",
            to: { pathname: "/b", params: {}, query: {}, hash: "" },
            from: null,
          },
        }
        yield { kind: "event", event: { type: "VALIDATION_OK", commitKind: "hard" } }
        yield { kind: "event", event: { type: "COMMIT_HARD" } }
        yield { kind: "awaitOutlet", result: { status: "committed" } }
        completed = true
        return { status: "committed" }
      },
    })

    const nav = runner.start(new URL("http://x/b"), {
      replace: false,
      fromPopstate: false,
    })
    await new Promise<void>((r) => setTimeout(r, 0))
    assert.equal(machine.phase.kind, "navigating")

    assert.ok(runner.notifyOutletSettled())
    assert.equal(machine.phase.kind, "idle")
    await nav
    await new Promise<void>((r) => setTimeout(r, 0))
    assert.equal(completed, true)
  })

  it("onAwaitOutlet hook runs when workflow reaches awaitOutlet", async () => {
    let machine = createInitialMachineState()
    let awaitOutletHook = 0

    const runner = createNavigationRunner({
      apply: (e) => {
        machine = applyEvent(machine, e)
      },
      transitionsEnabled: false,
      buildWorkflowDeps: () => ({}) as never,
      onAwaitOutlet: () => {
        awaitOutletHook += 1
        runner.notifyOutletSettled()
      },
      workflowFactory: stepsWorkflow([
        {
          kind: "event",
          event: {
            type: "NAV_REQUEST",
            id: 1,
            intent: "push",
            to: { pathname: "/b", params: {}, query: {}, hash: "" },
            from: null,
          },
        },
        { kind: "event", event: { type: "VALIDATION_OK", commitKind: "hard" } },
        { kind: "event", event: { type: "COMMIT_HARD" } },
        { kind: "awaitOutlet", result: { status: "committed" } },
      ]),
    })

    await runner.start(new URL("http://x/b"), {
      replace: false,
      fromPopstate: false,
    })
    assert.equal(awaitOutletHook, 1)
    assert.equal(machine.phase.kind, "idle")
  })

  it("restarts workflow on redirect yield", async () => {
    const applied: MachineEvent[] = []
    let runs = 0

    const factory: WorkflowFactory = (
      url,
      _options: NavigateInternalOptions
    ) => {
      runs += 1
      if (runs === 1) {
        return (async function* () {
          yield {
            kind: "redirect",
            url: new URL("http://x/target"),
            options: { replace: true, fromPopstate: false },
          }
          return { status: "cancelled" }
        })()
      }
      return stepsWorkflow(
        [
          {
            kind: "event",
            event: {
              type: "NAV_REQUEST",
              id: 2,
              intent: "replace",
              to: { pathname: "/target", params: {}, query: {}, hash: "" },
              from: null,
            },
          },
        ],
        { status: "intercepted" }
      )(url, _options, {} as never, false)
    }

    const runner = createNavigationRunner({
      apply: (e) => {
        applied.push(e)
      },
      transitionsEnabled: false,
      buildWorkflowDeps: () => ({}) as never,
      workflowFactory: factory,
    })

    const result = await runner.start(new URL("http://x/from"), {
      replace: false,
      fromPopstate: false,
    })
    assert.equal(runs, 2)
    assert.equal(result.status, "intercepted")
    assert.equal(applied.length, 1)
    assert.equal(applied[0]?.type, "NAV_REQUEST")
  })

  it("supersede aborts prior in-flight workflow", async () => {
    let machine = createInitialMachineState()
    let releaseSlow!: () => void
    const slowGate = new Promise<void>((r) => {
      releaseSlow = r
    })
    let runs = 0

    const runner = createNavigationRunner({
      apply: (e) => {
        machine = applyEvent(machine, e)
      },
      transitionsEnabled: false,
      buildWorkflowDeps: () => ({}) as never,
      workflowFactory: async function* () {
        runs += 1
        if (runs === 1) {
          yield {
            kind: "event",
            event: {
              type: "NAV_REQUEST",
              id: 1,
              intent: "push",
              to: { pathname: "/slow", params: {}, query: {}, hash: "" },
              from: null,
            },
          }
          await slowGate
          yield { kind: "awaitOutlet", result: { status: "committed" } }
          return { status: "committed" }
        }
        yield {
          kind: "event",
          event: {
            type: "NAV_REQUEST",
            id: 2,
            intent: "push",
            to: { pathname: "/fast", params: {}, query: {}, hash: "" },
            from: null,
          },
        }
        return { status: "cancelled" }
      },
    })

    const first = runner.start(new URL("http://x/slow"), {
      replace: false,
      fromPopstate: false,
    })
    await new Promise<void>((r) => setTimeout(r, 0))

    const second = runner.start(new URL("http://x/fast"), {
      replace: false,
      fromPopstate: false,
    })
    releaseSlow()

    const firstResult = await first
    const secondResult = await second
    assert.equal(firstResult.status, "cancelled")
    assert.equal(secondResult.status, "cancelled")
    assert.equal(runs, 2)
    void machine
  })
})
