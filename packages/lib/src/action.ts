export type ActionResult<T> =
  | {
      error: ActionError
      data: null
    }
  | {
      error: null
      data: T
    }

export interface ActionConfig<T> {
  /**
   * Executes the action and returns the result.
   */
  execute: () => Promise<T>
  /**
   * Called when the action fails.
   */
  onError?: (error: ActionError) => void
}

export class ActionError extends Error {
  constructor(cause: unknown) {
    super("Error occurred during action execution", { cause })
  }
}

export function defineAction<T extends readonly unknown[], R>(
  callback: (...args: T) => ActionConfig<R>
): (...args: T) => Promise<ActionResult<R>> {
  return async (...args: T) => {
    const { execute, onError } = callback(...args)
    try {
      const data = await execute()
      return { error: null, data }
    } catch (e) {
      const error = new ActionError(e)
      onError?.(error)
      return { error, data: null }
    }
  }
}
