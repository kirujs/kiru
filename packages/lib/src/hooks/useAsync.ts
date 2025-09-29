import { __DEV__ } from "../env.js"
import { noop, sideEffectsEnabled } from "../utils/index.js"
import { depsRequireChange, useHook } from "./utils.js"
import type { AsyncTaskState } from "../types.utils.js"

export type UseAsyncState<T> = AsyncTaskState<T, UseAsyncError> & {
  invalidate: () => void
}

export type UseAsyncCallbackContext = {
  abortSignal: AbortSignal
}

export class UseAsyncError extends Error {
  constructor(message: unknown) {
    super(message instanceof Error ? message.message : String(message))
    this.name = "UseAsyncError"
    this.cause = message
  }
}

type InternalTaskState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
  abortController: AbortController
}
/**
 * Runs an asynchronous function on initial render, or when a value provided in the [dependency
 * array](https://kirujs.dev/docs/hooks/dependency-arrays) has changed.
 *
 * @see https://kirujs.dev/docs/hooks/useAsync
 */
export function useAsync<T>(
  func: (ctx: UseAsyncCallbackContext) => Promise<T>,
  deps: unknown[]
): UseAsyncState<T> {
  if (!sideEffectsEnabled())
    return {
      data: null,
      loading: true,
      error: null,
      invalidate: noop,
    }
  return useHook(
    "useAsync",
    {
      deps,
      id: 0,
      task: null as any as InternalTaskState<T>,
      load: noop as (
        func: (ctx: UseAsyncCallbackContext) => Promise<T>
      ) => void,
    },
    ({ hook, isInit, isHMR, update }) => {
      if (__DEV__) {
        hook.dev = { devtools: { get: () => ({ value: hook.task }) } }
        if (isHMR) {
          isInit = true
        }
      }
      if (isInit) {
        hook.cleanup = () => abortTask(hook.task)
        hook.load = (func) => {
          let invalidated = false
          const abortController = new AbortController()
          abortController.signal.addEventListener("abort", () => {
            invalidated = true
          })
          const id = ++hook.id
          const task: InternalTaskState<T> = (hook.task = {
            abortController,
            data: null,
            loading: true,
            error: null,
          })
          func({ abortSignal: abortController.signal })
            .then((result: T) => {
              if (id !== hook.id) abortTask(task)
              if (invalidated) return

              task.data = result
              task.loading = false
              task.error = null
              update()
            })
            .catch((error) => {
              if (id !== hook.id) abortTask(task)
              if (invalidated) return

              task.data = null
              task.loading = false
              task.error = new UseAsyncError(error)
              update()
            })
        }
      }

      if (isInit || depsRequireChange(deps, hook.deps)) {
        abortTask(hook.task)
        hook.deps = deps
        hook.load(func)
      }

      const { abortController, ...rest } = hook.task
      return {
        ...rest,
        invalidate: () => {
          abortTask(hook.task)
          hook.load(func)
          update()
        },
      } as UseAsyncState<T>
    }
  )
}

function abortTask<T>(task: InternalTaskState<T> | null): void {
  if (task === null || task.abortController.signal.aborted) return
  task.abortController.abort()
}
