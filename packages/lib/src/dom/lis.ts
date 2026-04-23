function binarySearch(arr: number[], value: number): number {
  let left = 0
  let right = arr.length
  while (left < right) {
    const mid = (left + right) >> 1
    if (arr[mid] < value) left = mid + 1
    else right = mid
  }
  return left
}

export function computeLIS(sequence: number[]): number[] {
  const n = sequence.length
  if (n <= 1) return n === 0 ? [] : [0]

  const tails: number[] = []
  const indices: number[] = []
  const predecessors = new Array<number>(n).fill(-1)

  for (let i = 0; i < n; i++) {
    const pos = binarySearch(tails, sequence[i])
    tails[pos] = sequence[i]
    indices[pos] = i
    if (pos > 0) predecessors[i] = indices[pos - 1]
  }

  const lis = new Array<number>(tails.length)
  let index = indices[tails.length - 1]
  for (let i = tails.length - 1; i >= 0; i--) {
    lis[i] = index
    index = predecessors[index]
  }
  return lis
}
