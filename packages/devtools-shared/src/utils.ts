import type { AppContext } from "kiru"
import { $DEV_FILE_LINK } from "../../lib/dist/constants.js"

export function className(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export function applyObjectChangeFromKeys(
  obj: Record<string, any>,
  keys: string[],
  value: unknown
) {
  let o = obj
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (i === keys.length - 1) {
      o[key] = value
    } else {
      o = o[key]
    }
  }
}

export function getNodeName(node: Kiru.VNode) {
  return (
    (node.type as any).displayName ??
    ((node.type as Function).name || "Anonymous Function")
  )
}

export const getFileLink = (
  fn: Function & { [$DEV_FILE_LINK]?: string }
): string | null => fn[$DEV_FILE_LINK] ?? null

export function isDevtoolsApp(app: AppContext) {
  return app.name === "kiru.devtools"
}

type InferredMapEntries<T> = T extends Map<infer K, infer V> ? [K, V][] : never

export function typedMapEntries<T extends Map<any, any>>(
  map: T
): InferredMapEntries<T> {
  return Array.from(map.entries()) as InferredMapEntries<T>
}
