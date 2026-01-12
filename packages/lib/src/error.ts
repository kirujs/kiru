import { $KIRU_ERROR } from "./constants.js"
import { __DEV__ } from "./env.js"
import { findParent, noop } from "./utils/index.js"

type KiruErrorOptions =
  | string
  | {
      message: string
      /** Used to indicate that the error is fatal and should crash the application */
      fatal?: boolean
      /** Used to generate custom node stack */
      vNode?: Kiru.VNode
    }

export class KiruError extends Error {
  [$KIRU_ERROR] = true
  /** Indicates whether the error is fatal and should crash the application */
  fatal?: boolean
  /** Present if vNode is provided */
  customNodeStack?: string
  constructor(optionsOrMessage: KiruErrorOptions) {
    const message =
      typeof optionsOrMessage === "string"
        ? optionsOrMessage
        : optionsOrMessage.message
    super(message)
    if (typeof optionsOrMessage !== "string") {
      if (__DEV__ && optionsOrMessage?.vNode) {
        this.customNodeStack = captureErrorStack(optionsOrMessage.vNode)
      }
      this.fatal = optionsOrMessage?.fatal
    }
  }

  static isKiruError(error: unknown): error is KiruError {
    return error instanceof Error && (error as KiruError)[$KIRU_ERROR] === true
  }
}

function captureErrorStack(vNode: Kiru.VNode) {
  let n = vNode
  let componentFns: string[] = []
  while (n) {
    if (!n.parent) break // skip root node
    if (typeof n.type === "function") {
      componentFns.push(getComponentErrorDisplayText(n.type))
    } else if (typeof n.type === "string") {
      componentFns.push(n.type)
    }
    n = n.parent
  }
  const componentNode = (
    typeof vNode.type === "function"
      ? vNode
      : findParent(vNode, (n) => typeof n.type === "function")
  ) as (Kiru.VNode & { type: Function }) | null
  return `The above error occurred in the <${getFunctionName(
    componentNode?.type || noop
  )}> component:

${componentFns.map((x) => `   at ${x}`).join("\n")}\n`
}

function getComponentErrorDisplayText(fn: Function) {
  let str = getFunctionName(fn)
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
  return fn.toString().match(/\/\/ \[kiru_devtools\]:(.*)/)?.[1] ?? null
}
