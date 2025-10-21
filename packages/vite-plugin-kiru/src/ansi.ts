const colors = {
  black: "\x1B[30m",
  black_bright: "\x1B[90m",
  red: "\x1B[31m",
  red_bright: "\x1B[91m",
  green: "\x1B[32m",
  green_bright: "\x1B[92m",
  yellow: "\x1B[33m",
  yellow_bright: "\x1B[93m",
  blue: "\x1B[34m",
  blue_bright: "\x1B[94m",
  magenta: "\x1B[35m",
  magenta_bright: "\x1B[95m",
  cyan: "\x1B[36m",
  cyan_bright: "\x1B[96m",
  white: "\x1B[37m",
  white_bright: "\x1B[97m",
  reset: "\x1B[0m",
}

export const ANSI = tEntries(colors).reduce((acc, [key, value]) => {
  acc[key] = (str: string) => `${value}${str}${colors.reset}`
  return acc
}, {} as Record<keyof typeof colors, (str: string) => string>)

function tEntries<T extends Record<string, any>>(
  obj: T
): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}
