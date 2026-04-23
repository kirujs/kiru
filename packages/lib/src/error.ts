import { $DEV_FILE_LINK, $KIRU_ERROR } from "./constants.js"
import { __DEV__ } from "./env.js"

type KiruErrorOptions =
  | string
  | {
      message: string
      /** Used to indicate that the error is fatal and should crash the application */
      fatal?: boolean
      /** Used to generate custom node stack */
      node?: Kiru.KiruNode
    }

export class KiruError extends Error {
  [$KIRU_ERROR] = true
  /** Indicates whether the error is fatal and should crash the application */
  fatal?: boolean
  constructor(optionsOrMessage: KiruErrorOptions) {
    const message =
      typeof optionsOrMessage === "string"
        ? optionsOrMessage
        : optionsOrMessage.message
    super(message)
    if (typeof optionsOrMessage !== "string") {
      const node = optionsOrMessage?.node
      if (__DEV__ && node) {
        const stack = createOwnerStack(node)
        this.message = `${message}
${stack.map((item) => `    at ${item}`).join("\n")}
`
      }
      this.fatal = optionsOrMessage?.fatal
    }
  }

  static isKiruError(error: unknown): error is KiruError {
    return error instanceof Error && $KIRU_ERROR in error
  }
}

function createOwnerStack(node: Kiru.KiruNode) {
  let n = node
  let componentFns: string[] = []
  while (n) {
    if (!n.parent) break // skip root node
    if (typeof n.type === "function") {
      componentFns.push(getComponentErrorDisplayText(n.type))
    } else if (typeof n.type === "string") {
      componentFns.push(`<${n.type}>`)
    }
    n = n.parent
  }

  return componentFns
}

function getComponentErrorDisplayText(fn: Function) {
  let str = `<${getFunctionName(fn)}>`
  if (__DEV__) {
    const fileLink = getComponentFileLink(fn)
    if (fileLink) {
      str = `${str} (${fileLink})`
    }
  }
  return str
}

function getFunctionName(fn: Function) {
  return (fn as any).displayName ?? (fn.name || "Anonymous Function")
}

function getComponentFileLink(fn: Function) {
  return (fn as any)[$DEV_FILE_LINK] ?? null
}
