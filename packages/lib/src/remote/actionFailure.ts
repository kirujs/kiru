import {
  failWireBody,
  isKiruActionFail,
  type KiruActionFail,
} from "./actionFail.js"

/** Client-side error for JSON action `fail()` responses (and legacy envelopes). */
export class ActionFailure extends Error {
  readonly status: number
  readonly code?: string
  readonly fields?: Record<string, string>
  readonly data?: unknown

  constructor(
    message: string,
    options: {
      status: number
      code?: string
      fields?: Record<string, string>
      data?: unknown
    }
  ) {
    super(message)
    this.name = "ActionFailure"
    this.status = options.status
    this.code = options.code
    this.fields = options.fields
    this.data = options.data
  }

  static fromFail(fail: KiruActionFail): ActionFailure {
    const wire = failWireBody(fail)
    return new ActionFailure(wire.message, {
      status: wire.status,
      code: wire.code,
      fields: wire.fields,
      data: wire.data,
    })
  }

  static fromWire(data: unknown): ActionFailure | null {
    if (!isKiruActionFail(data)) return null
    const wire = failWireBody(data)
    return new ActionFailure(wire.message, {
      status: wire.status,
      code: wire.code,
      fields: wire.fields,
      data: wire.data,
    })
  }

  /** Legacy `{ error: { code, message, details? } }` from internal {@link RemoteError} throws. */
  static fromLegacyEnvelope(data: unknown): ActionFailure | null {
    if (!data || typeof data !== "object" || !("error" in data)) return null
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })
      .error
    if (!err || typeof err.message !== "string") return null
    const details = err.details
    const fieldErrors =
      details &&
      typeof details === "object" &&
      "fieldErrors" in details &&
      typeof (details as { fieldErrors?: unknown }).fieldErrors === "object"
        ? ((details as { fieldErrors: Record<string, string> }).fieldErrors as Record<
            string,
            string
          >)
        : undefined
    return new ActionFailure(err.message, {
      status: 400,
      code: typeof err.code === "string" ? err.code : undefined,
      fields: fieldErrors,
    })
  }
}

export function isActionFailure(e: unknown): e is ActionFailure {
  return e instanceof ActionFailure
}
