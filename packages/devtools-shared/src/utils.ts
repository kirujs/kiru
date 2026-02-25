import type { AppHandle } from "kiru"

export function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}

export function getNodeName(node: Kiru.VNode) {
  return (
    (node.type as any).displayName ??
    ((node.type as Function).name || "Anonymous Function")
  )
}

const $DEV_FILE_LINK = Symbol.for("kiru.devFileLink")
export const getFileLink = (
  fn: Function & { [$DEV_FILE_LINK]?: string }
): string | null => fn[$DEV_FILE_LINK] ?? null

export function isDevtoolsApp(app: AppHandle) {
  return app.name === "kiru.devtools"
}

type InferredMapEntries<T> = T extends Map<infer K, infer V> ? [K, V][] : never

export function typedMapEntries<T extends Map<any, any>>(
  map: T
): InferredMapEntries<T> {
  return Array.from(map.entries()) as InferredMapEntries<T>
}
