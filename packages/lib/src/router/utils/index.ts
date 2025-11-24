import { createElement } from "../../element.js"
import { __DEV__ } from "../../env.js"
import type {
  DefaultComponentModule,
  FormattedViteImportMap,
  RouteMatch,
  ViteImportMap,
} from "../types.internal"

export {
  formatViteImportMap,
  matchRoute,
  match404Route,
  matchModules,
  normalizePrefixPath,
  parseQuery,
  wrapWithLayouts,
}

function formatViteImportMap(
  map: ViteImportMap,
  dir: string,
  baseUrl: string
): FormattedViteImportMap {
  return Object.keys(map).reduce<FormattedViteImportMap>((acc, key) => {
    const dirIndex = key.indexOf(dir)
    if (dirIndex === -1) {
      if (__DEV__) {
        console.warn(
          `[kiru/router]: File "${key}" does not start with "${dir}".`
        )
      }
      return acc
    }

    let specificity = 0
    let k = key.slice(dirIndex + dir.length)
    while (k.startsWith("/")) {
      k = k.slice(1)
    }
    const segments: string[] = []
    const parts = k.split("/").slice(0, -1)
    const params = new Set<string>()

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part.startsWith("[...") && part.endsWith("]")) {
        if (i !== parts.length - 1) {
          throw new Error(
            `[kiru/router]: Catchall must be the folder name. Got "${key}"`
          )
        }
        const param = part.slice(4, -1)
        if (params.has(param)) {
          throw new Error(
            `[kiru/router]: Duplicate parameter "${param}" in "${key}"`
          )
        }
        params.add(param)
        segments.push(`:${param}*`)
        specificity += 1
        break
      }
      if (part.startsWith("[") && part.endsWith("]")) {
        const param = part.slice(1, -1)
        if (params.has(param)) {
          throw new Error(
            `[kiru/router]: Duplicate parameter "${param}" in "${key}"`
          )
        }
        params.add(param)
        segments.push(`:${param}`)
        specificity += 10
        continue
      }
      specificity += 100
      segments.push(part)
    }

    const value: FormattedViteImportMap[string] = {
      filePath: key,
      load: map[key],
      params: Array.from(params),
      route: "/" + parts.join("/"),
      segments,
      specificity,
    }

    return {
      ...acc,
      [baseUrl + segments.join("/")]: value,
    }
  }, {})
}

function matchRoute(
  pages: FormattedViteImportMap,
  pathSegments: string[]
): RouteMatch | null {
  const matches: RouteMatch[] = []
  outer: for (const [route, pageEntry] of Object.entries(pages)) {
    const routeSegments = pageEntry.segments
    const pathMatchingSegments = routeSegments.filter(
      (seg) => !seg.startsWith("(") && !seg.endsWith(")")
    )

    const params: Record<string, string> = {}
    let hasCatchall = false

    // Check if route matches
    for (
      let i = 0;
      i < pathMatchingSegments.length && i < pathSegments.length;
      i++
    ) {
      const routeSeg = pathMatchingSegments[i]

      if (routeSeg.startsWith(":")) {
        const key = routeSeg.slice(1)

        if (routeSeg.endsWith("*")) {
          // Catchall route - matches remaining segments
          hasCatchall = true
          const catchallKey = key.slice(0, -1) // Remove the *
          params[catchallKey] = pathSegments.slice(i).join("/")
          break
        } else {
          // Regular dynamic segment
          if (i >= pathSegments.length) {
            continue outer
          }
          params[key] = pathSegments[i]
        }
      } else {
        // Static segment
        if (routeSeg !== pathSegments[i]) {
          continue outer
        }
      }
    }

    // For non-catchall routes, ensure exact length match
    if (!hasCatchall && pathMatchingSegments.length !== pathSegments.length) {
      continue
    }

    matches.push({
      route,
      pageEntry,
      params,
      routeSegments,
    })
  }

  // Sort by specificity (highest first) and return the best match
  if (matches.length === 0) {
    return null
  }

  matches.sort((a, b) => b.pageEntry.specificity - a.pageEntry.specificity)
  return matches[0] || null
}

function match404Route(
  pages: FormattedViteImportMap,
  pathSegments: string[]
): RouteMatch | null {
  // Try to find a 404 page at each parent directory level
  // Start from the deepest level and work up to root
  for (let i = pathSegments.length; i >= 0; i--) {
    const parentSegments = pathSegments.slice(0, i)
    const fourOhFourSegments = [...parentSegments, "404"]
    const match = matchRoute(pages, fourOhFourSegments)
    if (match) {
      return match
    }
  }
  return null
}

function matchModules<T = DefaultComponentModule>(
  modules: FormattedViteImportMap<T>,
  routeSegments: string[]
) {
  return ["/", ...routeSegments].reduce((acc, _, i) => {
    const modulePath = "/" + routeSegments.slice(0, i).join("/")
    const module = modules[modulePath]

    if (!module) {
      return acc
    }

    return [...acc, module]
  }, [] as FormattedViteImportMap<T>[string][])
}

function normalizePrefixPath(path: string) {
  while (path.startsWith(".")) {
    path = path.slice(1)
  }
  path = `/${path}/`
  while (path.startsWith("//")) {
    path = path.slice(1)
  }
  while (path.endsWith("//")) {
    path = path.slice(0, -1)
  }
  return path
}

function parseQuery(
  search: string
): Record<string, string | string[] | undefined> {
  const params = new URLSearchParams(search)
  const query: Record<string, string | string[] | undefined> = {}

  for (const [key, value] of params.entries()) {
    if (query[key]) {
      // Convert to array if multiple values
      if (Array.isArray(query[key])) {
        ;(query[key] as string[]).push(value)
      } else {
        query[key] = [query[key] as string, value]
      }
    } else {
      query[key] = value
    }
  }

  return query
}

function wrapWithLayouts(
  layouts: Kiru.FC[],
  page: Kiru.FC,
  props: Record<string, unknown>
) {
  return layouts.reduceRight(
    (children, Layout) => createElement(Layout, { children }),
    createElement(page, props)
  )
}
