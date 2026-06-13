import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveOutletDisplay } from "../../router/resolveOutletDisplay.js"
import type { RouteMatch } from "../../router/types.js"

const fakeMatch = (id: string): RouteMatch =>
  ({
    route: { id, path: `/${id}` },
    pathname: `/${id}`,
    params: {},
  }) as RouteMatch

describe("resolveOutletDisplay", () => {
  it("shows initialSubtree before hydrate gate opens", () => {
    const initial = {} as JSX.Element
    const out = resolveOutletDisplay({
      content: null,
      isPending: true,
      committedMatch: fakeMatch("a"),
      displayedMatch: fakeMatch("a"),
      previousContent: null,
      outletRenderError: null,
      hydrateGateOpen: false,
      initialSubtree: initial,
      hydrateMatch: fakeMatch("a"),
    })
    assert.equal(out, initial)
  })

  it("keeps previous content while pending on same match (SWR)", () => {
    const prev = {} as JSX.Element
    const out = resolveOutletDisplay({
      content: null,
      isPending: true,
      committedMatch: fakeMatch("b"),
      displayedMatch: fakeMatch("a"),
      previousContent: prev,
      outletRenderError: null,
      hydrateGateOpen: true,
      initialSubtree: undefined,
      hydrateMatch: fakeMatch("a"),
    })
    assert.equal(out, null)
  })

  it("SWR when displayed match matches committed", () => {
    const prev = {} as JSX.Element
    const m = fakeMatch("a")
    const out = resolveOutletDisplay({
      content: null,
      isPending: true,
      committedMatch: m,
      displayedMatch: m,
      previousContent: prev,
      outletRenderError: null,
      hydrateGateOpen: true,
      initialSubtree: undefined,
      hydrateMatch: m,
    })
    assert.equal(out, prev)
  })

  it("hides stale outlet when committed route differs from displayed", () => {
    const stale = {} as JSX.Element
    const out = resolveOutletDisplay({
      content: stale,
      isPending: false,
      committedMatch: fakeMatch("b"),
      displayedMatch: fakeMatch("a"),
      previousContent: stale,
      outletRenderError: null,
      hydrateGateOpen: true,
      initialSubtree: undefined,
      hydrateMatch: fakeMatch("a"),
    })
    assert.equal(out, null)
  })
})
