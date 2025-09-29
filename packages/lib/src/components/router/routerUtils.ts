export { routeMatchesPath, parsePathParams, parseSearchParams }

function routeMatchesPath(
  dynamicPathSegments: string[],
  realPathSegments: string[],
  fallthrough?: boolean
) {
  if (!fallthrough && dynamicPathSegments.length < realPathSegments.length) {
    return false
  }

  for (let i = 0; i < dynamicPathSegments.length; i++) {
    const segment = dynamicPathSegments[i]
    if (segment.startsWith(":")) {
      continue
    } else if (segment !== realPathSegments[i]) {
      return false
    }
  }

  return true
}

function parsePathParams(
  dynamicPathSegments: string[],
  realPathSegments: string[]
) {
  const params: Record<string, string> = {}
  for (let i = 0; i < dynamicPathSegments.length; i++) {
    const segment = dynamicPathSegments[i]
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = realPathSegments[i]
    }
  }
  return params
}

function parseSearchParams(search: string) {
  const parsed: Record<string, string> = {}
  const str = search.split("?")[1]
  if (!str || str === "") return parsed

  const parts = str.split("&")
  for (let i = 0; i < parts.length; i++) {
    const [key, val] = parts[i].split("=")
    parsed[key] = val
  }
  return parsed
}
