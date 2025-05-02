import { KaiokenError } from "../error.js"
import { __DEV__ } from "../env.js"
import { node, nodeToCtxMap } from "../globals.js"
import { getVNodeAppContext, noop, safeStringify } from "../utils.js"
export { sideEffectsEnabled } from "../utils.js"
export {
  cleanupHook,
  depsRequireChange,
  useHook,
  useVNode,
  useAppContext,
  useHookDebugGroup,
  useHookHMRInvalidation,
  useRequestUpdate,
  HookDebugGroupAction,
  HMR_INVALIDATE_HOOK_SENTINEL_INTERNAL_USE_ONLY,
  type HookState,
  type HookCallback,
  type HookCallbackContext as HookCallbackState,
}

type HookState<T> = Kaioken.Hook<T>

const $HOOK_INVALIDATED = Symbol.for("kaioken.hookInvalidated")
const HMR_INVALIDATE_HOOK_SENTINEL_INTERNAL_USE_ONLY: HookState<any> = {
  [$HOOK_INVALIDATED]: true,
}

type DevHook<T> = HookState<T> & {
  devInvalidationValue?: string
}

let nextHookDevInvalidationValue: string | undefined
/**
 * **dev only - this is a no-op in production.**
 *
 * Used to mark a hook as invalidated on HMR.
 * Arguments passed to this function will be used to
 * determine if the hook should be re-initialized.
 * @deprecated - Hooks are now automatically reinitialized when devtools detect that the arguments changed, and can be persisted in this case with the `hook.debug.reinitUponRawArgsChanged` option.
If reinitialized in this way, the `hook.rawArgsChanged` property will be set to true.

To continue using this behavior, enable the `useRuntimeHookInvalidation` option when initializing your app context.
 *
 */
const useHookHMRInvalidation = (...values: unknown[]) => {
  if (__DEV__) {
    console.warn(
      `[kaioken]: useHookHMRInvalidation is deprecated and will be removed in a future release.
Hooks are now automatically reinitialized when devtools detect that the arguments changed, and can be persisted in this case with the \`hook.debug.reinitUponRawArgsChanged\` option.
If reinitialized in this way, the \`hook.rawArgsChanged\` property will be set to true.
      `
    )
    const ctx = getVNodeAppContext(node.current!)
    if (ctx.options?.useRuntimeHookInvalidation) {
      nextHookDevInvalidationValue = safeStringify(values)
    }
  }
}

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
  const n = node.current
  if (!n) error_hookMustBeCalledTopLevel("useRequestUpdate")
  const ctx = getVNodeAppContext(n)
  return () => ctx.requestUpdate(n)
}

/**
 * Used to obtain the 'AppContext' for the current component.
 */
const useAppContext = () => {
  if (!node.current) error_hookMustBeCalledTopLevel("useAppContext")
  const ctx = nodeToCtxMap.get(node.current)
  if (!ctx)
    error_hookMustBeCalledTopLevel(
      "[kaioken]: unable to find node's AppContext"
    )
  return ctx
}

/**
 * Used to obtain the 'VNode' for the current component.
 */
const useVNode = () => {
  const n = node.current
  if (!n) error_hookMustBeCalledTopLevel("useVNode")
  return n
}

type HookCallbackContext<T> = {
  /**
   * The current state of the hook
   */
  hook: HookState<T>
  /**
   * Indicates if this is the first time the hook has been initialized,
   * or if `state.dev.reinitUponRawArgsChanged` has been set to `true`
   * and its raw arguments were changed.
   */
  isInit: boolean
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
  vNode: Kaioken.VNode
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
  const vNode = node.current
  if (!vNode) error_hookMustBeCalledTopLevel(hookName)

  if (__DEV__) {
    if (
      currentHookName !== null &&
      !nestedHookWarnings.has(hookName + currentHookName)
    ) {
      nestedHookWarnings.add(hookName + currentHookName)
      throw new KaiokenError({
        message: `Nested primitive "useHook" calls are not supported. "${hookName}" was called inside "${currentHookName}". Strange will most certainly happen.`,
        vNode: node.current,
      })
    }
  }

  const ctx = getVNodeAppContext(vNode)
  const queueEffect = (callback: Function, opts?: { immediate?: boolean }) => {
    if (opts?.immediate) {
      ;(vNode.immediateEffects ??= []).push(callback)
      return
    }
    ;(vNode.effects ??= []).push(callback)
  }

  const index = ctx.hookIndex++

  if (__DEV__) {
    let oldHook = (
      vNode.prev ? vNode.prev.hooks?.at(index) : vNode.hooks?.at(index)
    ) as HookState<T> | undefined
    if (oldHook && $HOOK_INVALIDATED in oldHook) {
      oldHook = undefined
    }

    currentHookName = hookName

    let hook: HookState<T>
    if (!oldHook) {
      hook =
        typeof hookDataOrInitializer === "function"
          ? hookDataOrInitializer()
          : { ...hookDataOrInitializer }
      hook.name = hookName
    } else {
      hook = oldHook
      if (oldHook.name !== hookName) {
        console.warn(
          `[kaioken]: hooks must be called in the same order. Hook "${hookName}" was called in place of "${oldHook.name}". Strange things may happen.`
        )
      }
    }

    vNode.hooks ??= []
    vNode.hooks[index] = hook

    const hmrRuntimeInvalidated =
      ctx.options?.useRuntimeHookInvalidation &&
      doRuntimeHookInvalidation(vNode, hook, oldHook)

    try {
      const dev = hook.dev ?? {}
      const shouldReinit = dev?.rawArgsChanged && dev?.reinitUponRawArgsChanged
      const res = (callback as HookCallback<T>)({
        hook,
        isInit: Boolean(!oldHook || hmrRuntimeInvalidated || shouldReinit),
        update: () => ctx.requestUpdate(vNode),
        queueEffect,
        vNode,
        index,
      })
      return res
    } catch (error) {
      throw error
    } finally {
      currentHookName = null
      nextHookDevInvalidationValue = undefined
      if (hook.dev) {
        // @ts-ignore - Reset the rawArgsChanged flag
        hook.dev.rawArgsChanged = false
      }
    }
  }

  try {
    const oldHook = (
      vNode.prev ? vNode.prev.hooks?.at(index) : vNode.hooks?.at(index)
    ) as HookState<T> | undefined

    let hook: HookState<T>
    if (!oldHook) {
      hook =
        typeof hookDataOrInitializer === "function"
          ? hookDataOrInitializer()
          : { ...hookDataOrInitializer }
    } else {
      hook = oldHook
    }

    vNode.hooks ??= []
    vNode.hooks[index] = hook

    const res = (callback as HookCallback<T>)({
      hook,
      isInit: !oldHook,
      update: () => ctx.requestUpdate(vNode),
      queueEffect,
      vNode,
      index,
    })
    return res
  } catch (error) {
    throw error
  }
}

function doRuntimeHookInvalidation<T>(
  vNode: Kaioken.VNode,
  hook: HookState<T>,
  oldHook: HookState<T> | undefined
): boolean {
  if (nextHookDevInvalidationValue === undefined) return false

  let hmrInvalid = false
  const oldAsDevHook = oldHook as DevHook<T> | undefined
  const asDevHook = hook as DevHook<T>

  if (!oldAsDevHook) {
    asDevHook.devInvalidationValue = nextHookDevInvalidationValue // store our initial 'devInvalidationValue'
  } else if (
    vNode.hmrUpdated &&
    (oldAsDevHook.devInvalidationValue !== nextHookDevInvalidationValue ||
      // handle cases where we just call 'useHookHMRInvalidation()', like in `useWatch`
      (oldAsDevHook.devInvalidationValue === "[]" &&
        nextHookDevInvalidationValue === "[]"))
  ) {
    asDevHook.devInvalidationValue = nextHookDevInvalidationValue
    hmrInvalid = true
  }
  return hmrInvalid
}

function error_hookMustBeCalledTopLevel(hookName: string): never {
  throw new KaiokenError(
    `Hook "${hookName}" must be used at the top level of a component or inside another composite hook.`
  )
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
