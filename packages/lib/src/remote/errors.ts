/** Thrown from remote actions to return a structured JSON error to the client. */
export class RemoteError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(
    message: string,
    code: string,
    options?: { status?: number; details?: unknown }
  ) {
    super(message)
    this.name = "RemoteError"
    this.code = code
    this.status = options?.status ?? 400
    this.details = options?.details
  }

  toJSON(): { code: string; message: string; details?: unknown } {
    const o: { code: string; message: string; details?: unknown } = {
      code: this.code,
      message: this.message,
    }
    if (this.details !== undefined) o.details = this.details
    return o
  }
}

export function isRemoteError(e: unknown): e is RemoteError {
  return e instanceof RemoteError
}

/** Thrown by client action dispatch on non-2xx HTTP responses (no response body). */
export class RemoteDispatchError extends Error {
  readonly status: number

  constructor(status: number, message = "Action request failed") {
    super(message)
    this.name = "RemoteDispatchError"
    this.status = status
  }
}

export function isRemoteDispatchError(e: unknown): e is RemoteDispatchError {
  return e instanceof RemoteDispatchError
}
