import { __DEV__ } from "../env.js"

export function getVNodeId(vNode: Kiru.VNode): string {
  const accumulator: number[] = []
  let n: Kiru.VNode | null = vNode
  while (n) {
    accumulator.push(n.index)
    accumulator.push(n.depth)
    n = n.parent
  }
  return `k:${BigInt(accumulator.join("")).toString(36)}`
}
