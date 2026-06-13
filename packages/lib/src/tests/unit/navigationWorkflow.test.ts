import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { signal } from "../../signals/base.js"
import { compileRouteTree, createRoute, createRouteTree } from "../../router/index.js"
import {
  navigationWorkflow,
  type NavigationStep,
} from "../../router/navigationWorkflow.js"
import type { NavigationWorkflowDeps } from "../../router/navigationWorkflow.js"
import type { NavigationResult } from "../../router/types.js"
import { matchRoute } from "../../router/manifest.js"

async function collectSteps(
  targetUrl: URL,
  deps: NavigationWorkflowDeps
): Promise<{ steps: NavigationStep[]; result: NavigationResult }> {
  const steps: NavigationStep[] = []
  const gen = navigationWorkflow(targetUrl, {
    replace: false,
    fromPopstate: false,
  }, deps, false)
  let iter = await gen.next()
  while (!iter.done) {
    steps.push(iter.value)
    iter = await gen.next()
  }
  return { steps, result: iter.value ?? { status: "cancelled" } }
}

function eventTypes(steps: NavigationStep[]): string[] {
  return steps
    .filter((s): s is Extract<NavigationStep, { kind: "event" }> => s.kind === "event")
    .map((s) => s.event.type)
}

function minimalDeps(
  overrides: Partial<NavigationWorkflowDeps> = {}
): NavigationWorkflowDeps {
  const manifest = compileRouteTree(
    createRouteTree({
      children: [
        createRoute("/", async () => ({ default: () => null })),
        createRoute("/next", async () => ({ default: () => null })),
      ],
    })
  )
  const pathname = signal("/")
  const hash = signal("")
  const query = signal<Record<string, string[]>>({})
  const pathPolicy = { baseUrl: "", trailingSlash: "never" as const }
  const matchSig = signal(matchRoute(manifest, "/", pathPolicy))
  const params = signal<Record<string, string>>({})
  const matches = signal([])
  const historyIndex = { value: 0 }
  const scrollStack = { value: [] as [number, number][] }
  const navToken = { value: 0 }
  const navAbortController: { current: AbortController | null } = {
    current: new AbortController(),
  }

  return {
    manifest,
    resolvedPathPolicy: pathPolicy,
    normalizedBaseUrl: "",
    origin: "http://localhost",
    pathname,
    hash,
    query,
    match: matchSig,
    params,
    matches,
    requestContext: { value: {} },
    afterEachHooks: [],
    leaveByRoute: new Map(),
    updateByRoute: new Map(),
    componentEnterGuards: [],
    history: {
      pushState() {},
      replaceState() {},
      state: { index: 0 },
    } as unknown as History,
    navToken,
    navAbortController,
    historyIndex,
    scrollStack,
    saveScrollAt: () => {},
    commitLocation: (next) => {
      pathname.value = next.pathname
      hash.value = next.hash
      query.value = next.query
      const m = matchRoute(manifest, next.pathname, pathPolicy)
      matchSig.value = m
      params.value = m?.params ?? {}
    },
    setValidatedQuery: () => {},
    setValidatedRouteParams: () => {},
    buildMatchSegments: () => [],
    locationFromMatch: (m) =>
      m ? { pathname: m.pathname, params: m.params } : null,
    snapshotFromParts: (parts, p) => ({
      pathname: parts.pathname,
      params: p,
      query: parts.query,
      hash: parts.hash,
    }),
    currentLocationParts: () => ({
      pathname: pathname.peek(),
      hash: hash.peek(),
      query: query.peek(),
    }),
    setLastNavigation: () => {},
    token: 1,
    signal: navAbortController.current!.signal,
    isStale: () => false,
    ...overrides,
  }
}

describe("navigationWorkflow", () => {
  it("hard navigation yields validating → committing → awaitingOutlet events", async () => {
    const deps = minimalDeps()
    const { steps, result } = await collectSteps(
      new URL("http://localhost/next"),
      deps
    )
    assert.deepEqual(eventTypes(steps), [
      "NAV_REQUEST",
      "VALIDATION_OK",
      "COMMIT_HARD",
    ])
    assert.equal(steps.at(-1)?.kind, "awaitOutlet")
    assert.equal(result.status, "committed")
    assert.equal(deps.pathname.peek(), "/next")
  })

  it("cancelled guard yields VALIDATION_CANCEL", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/next", async () => ({ default: () => null })),
        ],
      })
    )
    const rootId = matchRoute(manifest, "/", {
      baseUrl: "",
      trailingSlash: "never",
    })!.route.id
    const deps = minimalDeps({
      manifest,
      leaveByRoute: new Map([[rootId, [() => false]]]),
    })
    const { steps, result } = await collectSteps(
      new URL("http://localhost/next"),
      deps
    )
    assert.deepEqual(eventTypes(steps), ["NAV_REQUEST", "VALIDATION_CANCEL"])
    assert.equal(result.status, "cancelled")
  })

  it("guard redirect yields redirect step", async () => {
    const manifest = compileRouteTree(
      createRouteTree({
        children: [
          createRoute("/", async () => ({ default: () => null })),
          createRoute("/next", async () => ({ default: () => null })),
        ],
      })
    )
    const rootId = matchRoute(manifest, "/", {
      baseUrl: "",
      trailingSlash: "never",
    })!.route.id
    const deps = minimalDeps({
      manifest,
      leaveByRoute: new Map([[rootId, [() => "/"]]]),
    })
    const { steps } = await collectSteps(
      new URL("http://localhost/next"),
      deps
    )
    const redirect = steps.find((s) => s.kind === "redirect")
    assert.ok(redirect)
    if (redirect?.kind === "redirect") {
      assert.equal(redirect.url.pathname, "/")
      assert.equal(redirect.options.replace, true)
    }
  })
})
