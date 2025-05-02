export const objSet = (
  obj: Record<string, any>,
  path: string[],
  value: any
) => {
  let o = obj
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    if (i === path.length - 1) {
      o[key] = value
    } else {
      o = o[key]
    }
  }
}

export const objGet = <T>(obj: Record<string, any>, path: string[]): T => {
  return path.reduce((o, key) => o[key], obj) as T
}
