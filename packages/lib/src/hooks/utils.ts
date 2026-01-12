import { KiruError } from "../error.js"
import { __DEV__ } from "../env.js"
import { hookIndex, node } from "../globals.js"
import { noop } from "../utils/index.js"
import { requestUpdate } from "../scheduler.js"
import { isHmrUpdate } from "../hmr.js"
export {
  cleanupHook,
  depsRequireChange,
  useHook,
  useVNode,
  useHookDebugGroup,
  useRequestUpdate,
  HookDebugGroupAction,
  type HookState,
  type HookCallback,
  type HookCallbackContext as HookCallbackState,
}

type HookState<T> = Kiru.Hook<T>

enum HookDebugGroupAction {
  Start = "start",
  End = "end",
}

/**
 * **dev only - this is a no-op in production.**
 *
 * Used to create 'groups' of hooks in the devtools.
 * Useful for debugging and profiling.
 */
const useHookDebugGroup = (name: string, action: HookDebugGroupAction) => {
  if (__DEV__) {
    return useHook(
      "devtools:useHookDebugGroup",
      { displayName: name, action },
      noop
    )
  }
}

/**
 * Used obtain an 'requestUpdate' function for the current component.
 */
const useRequestUpdate = () => {
  const vNode = getVNodeOrError("useRequestUpdate")
  return () => requestUpdate(vNode)
}

/**
 * Used to obtain the 'VNode' for the current component.
 */
const useVNode = () => {
  return getVNodeOrError("useVNode")
}

type HookCallbackContext<T> = {
  /**
   * The current state of the hook
   */
  hook: HookState<T>
  /**
   * Indicates if this is the first time the hook has been initialized
   */
  isInit: boolean
  /**
   * Dev mode only - indicates if the hook is being run as a result of a HMR update.
   * This is the time to clean up the previous version of the hook if necessary, ie. initial arguments changed.
   */
  isHMR?: boolean
  /**
   * Queues the current component to be re-rendered
   */
  update: () => void
  /**
   * Queues an effect to be run, either immediately or on the next render
   */
  queueEffect: (callback: Function, opts?: { immediate?: boolean }) => void
  /**
   * The VNode associated with the current component
   */
  vNode: Kiru.VNode
  /**
   * The index of the current hook.
   * You can count on this being stable across renders,
   * and unique across separate hooks in the same component.
   */
  index: number
}
type HookCallback<T> = (state: HookCallbackContext<T>) => any

let currentHookName: string | null = null
const nestedHookWarnings = new Set<string>()

function useHook<
  T extends () => Record<string, unknown>,
  U extends HookCallback<ReturnType<T>>
>(hookName: string, hookInitializer: T, callback: U): ReturnType<U>

function useHook<T extends Record<string, unknown>, U extends HookCallback<T>>(
  hookName: string,
  hookData: T,
  callback: U
): ReturnType<U>

function useHook<
  T,
  U extends T extends () => Record<string, unknown>
    ? HookCallback<ReturnType<T>>
    : HookCallback<T>
>(
  hookName: string,
  hookDataOrInitializer: HookState<T> | (() => HookState<T>),
  callback: U
): ReturnType<U> {
  const vNode = getVNodeOrError(hookName)

  if (
    __DEV__ &&
    currentHookName !== null &&
    !nestedHookWarnings.has(hookName + currentHookName)
  ) {
    nestedHookWarnings.add(hookName + currentHookName)
    throw new KiruError({
      message: `Nested primitive "useHook" calls are not supported. "${hookName}" was called inside "${currentHookName}". Strange will most certainly happen.`,
      vNode,
    })
  }

  const queueEffect = (callback: Function, opts?: { immediate?: boolean }) => {
    if (opts?.immediate) {
      ;(vNode.immediateEffects ??= []).push(callback)
      return
    }
    ;(vNode.effects ??= []).push(callback)
  }

  const index = hookIndex.current++

  let oldHook = vNode.hooks?.at(index) as HookState<T> | undefined

  if (__DEV__) {
    currentHookName = hookName

    vNode.hooks ??= []
    vNode.hookSig ??= []

    if (!vNode.hookSig[index]) {
      vNode.hookSig[index] = hookName
    } else {
      if (vNode.hookSig[index] !== hookName) {
        console.warn(
          `[kiru]: hooks must be called in the same order. Hook "${hookName}" was called in place of "${vNode.hookSig[index]}". Strange things may happen.`
        )
        oldHook?.cleanup?.()
        vNode.hooks.length = index
        vNode.hookSig.length = index
        oldHook = undefined
      }
    }

    let hook: HookState<T>
    if (!oldHook) {
      hook =
        typeof hookDataOrInitializer === "function"
          ? hookDataOrInitializer()
          : { ...hookDataOrInitializer }
      hook.name = hookName
    } else {
      hook = oldHook
    }

    vNode.hooks[index] = hook

    try {
      const res = (callback as HookCallback<T>)({
        hook,
        isInit: !oldHook,
        isHMR: isHmrUpdate(),
        update: () => requestUpdate(vNode),
        queueEffect,
        vNode,
        index,
      })
      return res
    } catch (error) {
      throw error
    } finally {
      currentHookName = null
    }
  }

  try {
    const hook: HookState<T> =
      oldHook ??
      (typeof hookDataOrInitializer === "function"
        ? hookDataOrInitializer()
        : { ...hookDataOrInitializer })

    vNode.hooks ??= []
    vNode.hooks[index] = hook

    const res = (callback as HookCallback<T>)({
      hook,
      isInit: !oldHook,
      update: () => requestUpdate(vNode),
      queueEffect,
      vNode,
      index,
    })
    return res
  } catch (error) {
    throw error
  }
}

function getVNodeOrError(hookName: string) {
  const vNode = node.current
  if (!vNode) {
    throw new KiruError(
      `Hook "${hookName}" must be used at the top level of a component or inside another composite hook.`
    )
  }
  return vNode
}

function cleanupHook(hook: { cleanup?: () => void }) {
  if (hook.cleanup) {
    hook.cleanup()
    hook.cleanup = undefined
  }
}

function depsRequireChange(a?: unknown[], b?: unknown[]) {
  return (
    a === undefined ||
    b === undefined ||
    a.length !== b.length ||
    (a.length > 0 && b.some((dep, i) => !Object.is(dep, a[i])))
  )
}
