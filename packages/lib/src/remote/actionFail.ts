/** Expected action failure — return from handlers via {@link fail}. */

export type KiruActionFail<
  Fields extends Record<string, string> = Record<string, string>,
> = {
  readonly __kiruFail: true
  readonly message: string
  readonly status?: number
  readonly code?: string
  readonly fields?: Partial<Fields>
  readonly data?: unknown
}

/** JSON body shape for {@link KiruActionFail} on the wire. */
export type KiruActionFailWire = {
  readonly __kiruFail: true
  readonly message: string
  readonly status: number
  readonly code?: string
  readonly fields?: Record<string, string>
  readonly data?: unknown
}

export function fail<Fields extends Record<string, string> = Record<string, string>>(
  options: {
    message: string
    status?: number
    code?: string
    fields?: Partial<Fields>
    data?: unknown
  }
): KiruActionFail<Fields> {
  return {
    __kiruFail: true,
    message: options.message,
    status: options.status,
    code: options.code,
    fields: options.fields,
    data: options.data,
  }
}

export function isKiruActionFail(value: unknown): value is KiruActionFail {
  return (
    !!value &&
    typeof value === "object" &&
    "__kiruFail" in value &&
    (value as { __kiruFail: unknown }).__kiruFail === true &&
    typeof (value as KiruActionFail).message === "string"
  )
}

export function sanitizeFailFields(
  fields: Partial<Record<string, string>> | undefined
): Record<string, string> | undefined {
  if (!fields) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && v) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

/** Default 422 when `fields` present, else 400; explicit `status` always wins. */
export function resolveFailHttpStatus(fail: KiruActionFail): number {
  if (fail.status !== undefined) return fail.status
  return sanitizeFailFields(fail.fields) ? 422 : 400
}

export function failWireBody(fail: KiruActionFail): KiruActionFailWire {
  const fields = sanitizeFailFields(fail.fields)
  return {
    __kiruFail: true,
    message: fail.message,
    status: resolveFailHttpStatus(fail),
    ...(fail.code !== undefined ? { code: fail.code } : {}),
    ...(fields ? { fields } : {}),
    ...(fail.data !== undefined ? { data: fail.data } : {}),
  }
}
