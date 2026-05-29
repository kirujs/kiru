import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import { bridgeTraceReadiness, dumpRpcTrace, flushRpcTraceSpans, rpcTrace } from "../../remote/rpcTrace.js"
import { createTraceContext } from "../../remote/actionExecution.js"
import {
  __clearRpcTraceForTests,
  __setRpcTraceEnabledForTests,
} from "../../remote/rpcTrace.js"

describe("rpcTrace", () => {
  beforeEach(() => {
    __setRpcTraceEnabledForTests(false)
    __clearRpcTraceForTests()
  })

  afterEach(() => {
    __setRpcTraceEnabledForTests(false)
    __clearRpcTraceForTests()
  })

  it("is a no-op when disabled", () => {
    rpcTrace({ channel: "loader", phase: "test" })
    assert.strictEqual(dumpRpcTrace().length, 0)
  })

  it("records events in order when enabled", () => {
    __setRpcTraceEnabledForTests(true)
    rpcTrace({ channel: "loader", phase: "a", traceId: "t1" })
    rpcTrace({ channel: "loader", phase: "b", traceId: "t1" })
    const buf = dumpRpcTrace()
    assert.strictEqual(buf.length, 2)
    assert.strictEqual(buf[0]!.phase, "a")
    assert.strictEqual(buf[1]!.phase, "b")
  })

  it("flushRpcTraceSpans merges action spans", () => {
    __setRpcTraceEnabledForTests(true)
    const tracing = createTraceContext("trace-span")
    const span = tracing.startSpan("middleware", { actionId: "r:a" })
    tracing.endSpan(span)
    flushRpcTraceSpans(tracing)
    const buf = dumpRpcTrace()
    assert.ok(buf.some((e) => e.phase === "span:middleware"))
  })

  it("bridgeTraceReadiness forwards readiness channel", () => {
    __setRpcTraceEnabledForTests(true)
    bridgeTraceReadiness("scheduler", { phase: "hydrate" })
    const buf = dumpRpcTrace()
    assert.ok(buf.some((e) => e.channel === "readiness" && e.phase === "scheduler"))
  })
})
