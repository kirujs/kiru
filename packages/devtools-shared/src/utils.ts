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

export function getNodeName(node: Kaioken.VNode) {
  return (
    (node.type as any).displayName ??
    ((node.type as Function).name || "Anonymous Function")
  )
}

export const getFileLink = (
  fn: Function & { __devtoolsFileLink?: string }
): string | null => fn.__devtoolsFileLink ?? null
