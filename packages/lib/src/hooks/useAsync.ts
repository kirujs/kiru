import { __DEV__ } from "../env.js"
import { noop } from "../utils.js"
import { depsRequireChange, sideEffectsEnabled, useHook } from "./utils.js"

export type UseAsyncState<T> = (
  | /** loading*/ {
      data: null
      loading: true
      error: null
    }
  | /** loaded */ {
      data: T
      loading: false
      error: null
    }
  | /** error */ {
      data: null
      loading: false
      error: UseAsyncError
    }
) & {
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

type AsyncTaskState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
  abortController: AbortController
}
/**
 * Runs an asynchronous function on initial render, or when a value provided in the [dependency
 * array](https://kaioken.dev/docs/hooks/dependency-arrays) has changed.
 *
 * @see https://kaioken.dev/docs/hooks/useAsync
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
      task: null as any as AsyncTaskState<T>,
      load: noop as (
        func: (ctx: UseAsyncCallbackContext) => Promise<T>
      ) => void,
    },
    ({ hook, isInit, update }) => {
      if (__DEV__) {
        hook.dev = { devtools: { get: () => ({ value: hook.task }) } }
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
          const task: AsyncTaskState<T> = (hook.task = {
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

function abortTask<T>(task: AsyncTaskState<T> | null): void {
  if (task === null || task.abortController.signal.aborted) return
  task.abortController.abort()
}
