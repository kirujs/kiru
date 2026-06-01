/**
 * Indices into `arr` that form a longest increasing subsequence.
 * Used to minimize DOM moves during keyed list reorder.
 */
export function lisIndices(arr: readonly number[]): Set<number> {
  const n = arr.length
  if (n === 0) return new Set()

  const tails: number[] = []
  const tailIndices: number[] = []
  const predecessors: number[] = new Array(n).fill(-1)

  for (let i = 0; i < n; i++) {
    const value = arr[i]!
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid]! < value) lo = mid + 1
      else hi = mid
    }
    if (lo >= tails.length) {
      tails.push(value)
      tailIndices.push(i)
    } else {
      tails[lo] = value
      tailIndices[lo] = i
    }
    if (lo > 0) {
      predecessors[i] = tailIndices[lo - 1]!
    }
  }

  const out = new Set<number>()
  if (tailIndices.length === 0) return out
  let k = tailIndices[tailIndices.length - 1]!
  while (k >= 0) {
    out.add(k)
    k = predecessors[k]!
  }
  return out
}
