import type { MachineEvent } from "./navigationMachine.js"
import type { NavigationResult } from "./types.js"
import type { NavigateInternalOptions } from "./navigation.js"
import { logOutletDebug } from "./outletDebug.js"
import {
  navigationWorkflow,
  type NavigationStep,
  type NavigationWorkflowDeps,
} from "./navigationWorkflow.js"

export type WorkflowFactory = (
  targetUrl: URL,
  options: NavigateInternalOptions,
  deps: NavigationWorkflowDeps,
  transitionsEnabled: boolean
) => AsyncGenerator<NavigationStep, NavigationResult>

export type NavigationRunnerDeps = {
  apply: (event: MachineEvent) => void
  buildWorkflowDeps: (input: {
    token: number
    signal: AbortSignal
    isStale: () => boolean
  }) => NavigationWorkflowDeps
  transitionsEnabled: boolean
  workflowFactory?: WorkflowFactory
  /** Called when workflow reaches awaitOutlet (outlet may already be loaded). */
  onAwaitOutlet?: () => void
}

type ActiveSession = {
  token: number
  gen: AsyncGenerator<NavigationStep, NavigationResult>
  outletWait: Promise<void> | null
  resolveOutlet: (() => void) | null
}

export function createNavigationRunner(deps: NavigationRunnerDeps) {
  const navToken = { value: 0 }
  const navAbortController: { current: AbortController | null } = {
    current: null,
  }
  let activeNavToken = 0
  let session: ActiveSession | null = null

  function isStale(token: number) {
    return token !== activeNavToken
  }

  function abortPriorSession() {
    navAbortController.current?.abort()
    if (session) {
      logOutletDebug("runner:sessionAbort", { token: session.token })
      void session.gen.return({ status: "cancelled" })
      session.resolveOutlet?.()
      session = null
    }
  }

  async function drainGenerator(
    gen: AsyncGenerator<NavigationStep, NavigationResult>,
    token: number
  ): Promise<NavigationResult> {
    let iter = await gen.next()
    while (!iter.done) {
      if (isStale(token)) {
        await gen.return({ status: "cancelled" })
        return { status: "cancelled" }
      }

      const step = iter.value

      if (step.kind === "event") {
        deps.apply(step.event)
        iter = await gen.next()
        continue
      }

      if (step.kind === "redirect") {
        await gen.return({ status: "cancelled" })
        return runWorkflow(step.url, step.options)
      }

      if (step.kind === "awaitOutlet") {
        logOutletDebug("runner:awaitOutlet", {
          token,
          resultStatus: step.result.status,
        })
        const outletPromise = new Promise<void>((resolve) => {
          if (session && session.token === token) {
            session.resolveOutlet = resolve
          } else {
            resolve()
          }
        })
        if (session && session.token === token) {
          session.outletWait = outletPromise
          queueMicrotask(() => {
            if (!isStale(token) && session?.token === token) {
              deps.onAwaitOutlet?.()
            }
          })
        }
        void (async () => {
          await outletPromise
          if (isStale(token)) {
            await gen.return({ status: "cancelled" })
            return
          }
          await gen.next()
        })()
        return step.result
      }

      iter = await gen.next()
    }

    return iter.value ?? { status: "cancelled" }
  }

  async function runWorkflow(
    targetUrl: URL,
    options: NavigateInternalOptions
  ): Promise<NavigationResult> {
    abortPriorSession()

    const navAbort = new AbortController()
    navAbortController.current = navAbort
    const token = ++navToken.value
    activeNavToken = token

    const workflowDeps = deps.buildWorkflowDeps({
      token,
      signal: navAbort.signal,
      isStale: () => isStale(token),
    })

    const createWorkflow =
      deps.workflowFactory ?? navigationWorkflow
    const gen = createWorkflow(
      targetUrl,
      options,
      workflowDeps,
      deps.transitionsEnabled
    )

    session = {
      token,
      gen,
      outletWait: null,
      resolveOutlet: null,
    }

    return drainGenerator(gen, token)
  }

  function notifyOutletSettled(): boolean {
    const hadResolver = !!session?.resolveOutlet
    logOutletDebug("runner:outletSettled", {
      token: session?.token ?? null,
      hadResolver,
    })
    if (!session?.resolveOutlet) return false
    const resolve = session.resolveOutlet
    session.resolveOutlet = null
    session.outletWait = null
    deps.apply({ type: "OUTLET_SETTLED" })
    resolve()
    return true
  }

  function getNavAbortController() {
    return navAbortController
  }

  function getNavToken() {
    return navToken
  }

  function getActiveNavToken() {
    return activeNavToken
  }

  return {
    start: runWorkflow,
    notifyOutletSettled,
    getNavAbortController,
    getNavToken,
    getActiveNavToken,
    isStale,
  }
}

export type NavigationRunner = ReturnType<typeof createNavigationRunner>
